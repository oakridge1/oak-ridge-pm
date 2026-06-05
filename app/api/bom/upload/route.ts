export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const buf = Buffer.from(await (file as File).arrayBuffer());
  const wb  = XLSX.read(buf, { type: "buffer" });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return NextResponse.json({ error: "Empty workbook" }, { status: 400 });

  type Row = { ID?: string; Category?: string; Name?: string; Unit?: string; "Base $"?: number; "Labor hrs"?: number; Markup?: string; GC?: string };
  const rows = XLSX.utils.sheet_to_json<Row>(ws);

  const valid = rows.filter(r => r.ID?.trim() && r.Category?.trim() && r.Name?.trim());
  if (valid.length === 0) {
    return NextResponse.json({ error: "No valid rows found — expected columns: ID, Category, Name, Unit, Base $, Labor hrs, Markup, GC" }, { status: 400 });
  }

  let upserted = 0;
  for (const row of valid) {
    const id   = row.ID!.trim();
    const data = {
      cat:  (row.Category ?? "").trim(),
      name: (row.Name ?? "").trim(),
      unit: (row.Unit ?? "EA").trim(),
      mat:  Number(row["Base $"] ?? 0),
      lhr:  Number(row["Labor hrs"] ?? 0),
      mk:   (row.Markup ?? "bulk").trim(),
      gc:   (row.GC ?? "").toUpperCase() === "Y",
      updatedBy: session.user.email ?? undefined,
    };
    await prisma.bomItem.upsert({ where: { id }, update: data, create: { id, ...data } });
    upserted++;
  }

  return NextResponse.json({ upserted });
}
