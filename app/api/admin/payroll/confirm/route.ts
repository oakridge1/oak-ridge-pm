export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface PayrollRecordInput {
  userId: string;
  regularHours: number;
  otHours: number;
  grossPay: number;
  payPeriodStart: string;
  payPeriodEnd: string;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const records: PayrollRecordInput[] = body.records ?? [];
  const importedFrom: string | undefined = body.importedFrom;

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "No records to import" }, { status: 400 });
  }

  const created = await prisma.$transaction(
    records.map((r) =>
      prisma.payrollRecord.create({
        data: {
          userId: r.userId,
          regularHours: Number(r.regularHours) || 0,
          otHours: Number(r.otHours) || 0,
          grossPay: Number(r.grossPay) || 0,
          payPeriodStart: new Date(r.payPeriodStart),
          payPeriodEnd: new Date(r.payPeriodEnd),
          importedFrom: importedFrom ?? null,
          importedBy: session.user.id,
        },
      })
    )
  );

  return NextResponse.json({ imported: created.length });
}
