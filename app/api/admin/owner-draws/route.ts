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
    drawDate?: { gte: Date; lte: Date };
  } = {};

  if (userIdParam) {
    where.userId = userIdParam;
  }

  if (yearParam) {
    const year = parseInt(yearParam, 10);
    where.drawDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31T23:59:59`),
    };
  }

  const draws = await prisma.ownerDraw.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { drawDate: "desc" },
  });

  return NextResponse.json({ draws });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    userId: string;
    amount: number;
    drawDate: string;
    method: string;
    notes?: string;
    receiptUrl?: string;
  };

  if (!body.userId || !body.drawDate || !body.method) {
    return NextResponse.json({ error: "userId, drawDate, and method are required" }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
  }

  // Validate userId exists
  const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 400 });

  const draw = await prisma.ownerDraw.create({
    data: {
      userId: body.userId,
      amount,
      drawDate: new Date(body.drawDate),
      method: body.method,
      notes: body.notes ?? null,
      receiptUrl: body.receiptUrl ?? null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ draw }, { status: 201 });
}
