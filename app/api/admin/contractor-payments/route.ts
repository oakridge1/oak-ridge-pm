export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userIdParam = searchParams.get("userId");
  const yearParam = searchParams.get("year");

  const where: {
    userId?: string;
    paymentDate?: { gte: Date; lte: Date };
  } = {};

  if (userIdParam) {
    where.userId = userIdParam;
  }

  if (yearParam) {
    const year = parseInt(yearParam, 10);
    where.paymentDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31T23:59:59`),
    };
  }

  const payments = await prisma.contractorPayment.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { paymentDate: "desc" },
  });

  return NextResponse.json({ payments });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    userId: string;
    amountUSD: number;
    amountLocal?: number;
    localCurrency?: string;
    exchangeRate?: number;
    paymentDate: string;
    payPeriodStart?: string;
    payPeriodEnd?: string;
    method: string;
    notes?: string;
    receiptUrl?: string;
  };

  if (!body.userId || !body.paymentDate || !body.method) {
    return NextResponse.json({ error: "userId, paymentDate, and method are required" }, { status: 400 });
  }

  const amountUSD = Number(body.amountUSD);
  if (isNaN(amountUSD) || amountUSD < 0) {
    return NextResponse.json({ error: "amountUSD must be >= 0" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 400 });

  const payment = await prisma.contractorPayment.create({
    data: {
      userId: body.userId,
      amountUSD,
      amountLocal: body.amountLocal !== undefined ? Number(body.amountLocal) : null,
      localCurrency: body.localCurrency ?? null,
      exchangeRate: body.exchangeRate !== undefined ? Number(body.exchangeRate) : null,
      paymentDate: new Date(body.paymentDate),
      payPeriodStart: body.payPeriodStart ? new Date(body.payPeriodStart) : null,
      payPeriodEnd: body.payPeriodEnd ? new Date(body.payPeriodEnd) : null,
      method: body.method,
      notes: body.notes ?? null,
      receiptUrl: body.receiptUrl ?? null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ payment }, { status: 201 });
}
