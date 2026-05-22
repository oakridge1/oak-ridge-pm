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
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const payment = await prisma.contractorPayment.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ payment });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await req.json() as {
    userId?: string;
    amountUSD?: number;
    amountLocal?: number | null;
    localCurrency?: string | null;
    exchangeRate?: number | null;
    paymentDate?: string;
    payPeriodStart?: string | null;
    payPeriodEnd?: string | null;
    method?: string;
    notes?: string | null;
    receiptUrl?: string | null;
  };

  const data: {
    userId?: string;
    amountUSD?: number;
    amountLocal?: number | null;
    localCurrency?: string | null;
    exchangeRate?: number | null;
    paymentDate?: Date;
    payPeriodStart?: Date | null;
    payPeriodEnd?: Date | null;
    method?: string;
    notes?: string | null;
    receiptUrl?: string | null;
  } = {};

  if (body.userId !== undefined) data.userId = body.userId;
  if (body.amountUSD !== undefined) {
    const amountUSD = Number(body.amountUSD);
    if (isNaN(amountUSD) || amountUSD < 0) {
      return NextResponse.json({ error: "amountUSD must be >= 0" }, { status: 400 });
    }
    data.amountUSD = amountUSD;
  }
  if (body.amountLocal !== undefined) data.amountLocal = body.amountLocal !== null ? Number(body.amountLocal) : null;
  if (body.localCurrency !== undefined) data.localCurrency = body.localCurrency;
  if (body.exchangeRate !== undefined) data.exchangeRate = body.exchangeRate !== null ? Number(body.exchangeRate) : null;
  if (body.paymentDate !== undefined) data.paymentDate = new Date(body.paymentDate);
  if (body.payPeriodStart !== undefined) data.payPeriodStart = body.payPeriodStart ? new Date(body.payPeriodStart) : null;
  if (body.payPeriodEnd !== undefined) data.payPeriodEnd = body.payPeriodEnd ? new Date(body.payPeriodEnd) : null;
  if (body.method !== undefined) data.method = body.method;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl;

  const payment = await prisma.contractorPayment.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ payment });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await prisma.contractorPayment.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
