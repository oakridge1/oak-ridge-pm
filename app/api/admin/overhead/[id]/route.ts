export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const cost = await prisma.overheadCost.findUnique({ where: { id } });
  if (!cost) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ cost });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.overheadCost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as {
    category?: string;
    description?: string;
    amount?: number;
    effectiveDate?: string;
    endDate?: string | null;
    isRecurring?: boolean;
    recurringDay?: number | null;
    recurringFreq?: string | null;
    autoIncrease?: boolean;
    increaseRate?: number | null;
    increaseMonth?: number | null;
    notes?: string | null;
    receiptUrl?: string | null;
  };

  const cost = await prisma.overheadCost.update({
    where: { id },
    data: {
      ...(body.category !== undefined && { category: body.category }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.amount !== undefined && { amount: Number(body.amount) }),
      ...(body.effectiveDate !== undefined && { effectiveDate: new Date(body.effectiveDate) }),
      ...("endDate" in body && { endDate: body.endDate ? new Date(body.endDate) : null }),
      ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
      ...("recurringDay" in body && { recurringDay: body.recurringDay ?? null }),
      ...("recurringFreq" in body && { recurringFreq: body.recurringFreq ?? null }),
      ...(body.autoIncrease !== undefined && { autoIncrease: body.autoIncrease }),
      ...("increaseRate" in body && { increaseRate: body.increaseRate ?? null }),
      ...("increaseMonth" in body && { increaseMonth: body.increaseMonth ?? null }),
      ...("notes" in body && { notes: body.notes ?? null }),
      ...("receiptUrl" in body && { receiptUrl: body.receiptUrl ?? null }),
    },
  });

  return NextResponse.json({ cost });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.overheadCost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.overheadCost.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
