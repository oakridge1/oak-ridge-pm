export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Handle quoted fields
  function splitLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function resolveCol(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const key = Object.keys(row).find((k) =>
      k.toLowerCase().includes(c.toLowerCase())
    );
    if (key !== undefined) return row[key] ?? "";
  }
  return "";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  // Accept field name "csv" (per spec) or "file" (legacy)
  const file = (formData.get("csv") ?? formData.get("file")) as File | null;
  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json({ error: "No CSV file provided (field: csv)" }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV is empty or malformed" }, { status: 400 });
  }

  // Load all active users for matching
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  function fuzzyMatch(csvName: string) {
    if (!csvName) return null;
    const n = normalize(csvName);
    // 1. Exact match
    let match = users.find((u) => u.name && normalize(u.name) === n);
    if (match) return match;
    // 2. Substring match (case-insensitive)
    match = users.find(
      (u) =>
        u.name &&
        (n.includes(normalize(u.name)) || normalize(u.name).includes(n))
    );
    return match ?? null;
  }

  const matched: Array<{
    csvName: string;
    userId: string;
    userName: string;
    regularHours: number;
    otHours: number;
    grossPay: number;
    payPeriodStart: string;
    payPeriodEnd: string;
  }> = [];

  const unmatched: Array<{
    csvName: string;
    regularHours: number;
    otHours: number;
    grossPay: number;
  }> = [];

  for (const row of rows) {
    const csvName = resolveCol(row, "Employee Name", "Employee", "Name").trim();
    if (!csvName) continue;

    const regularHours =
      parseFloat(resolveCol(row, "Regular Hours", "Reg Hours", "Regular")) || 0;
    const otHours =
      parseFloat(resolveCol(row, "Overtime Hours", "OT Hours", "Overtime")) || 0;
    const grossPay =
      parseFloat(
        resolveCol(row, "Gross Pay", "Gross Earnings", "Gross", "Total Pay").replace(/[$,]/g, "")
      ) || 0;
    const payPeriodStart = resolveCol(row, "Pay Period Start", "Period Start", "Start Date");
    const payPeriodEnd = resolveCol(row, "Pay Period End", "Period End", "End Date");

    const user = fuzzyMatch(csvName);
    if (user) {
      matched.push({
        csvName,
        userId: user.id,
        userName: user.name ?? csvName,
        regularHours,
        otHours,
        grossPay,
        payPeriodStart,
        payPeriodEnd,
      });
    } else {
      unmatched.push({ csvName, regularHours, otHours, grossPay });
    }
  }

  return NextResponse.json({ matched, unmatched });
}
