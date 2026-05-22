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

  const draw = await prisma.ownerDraw.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  if (!draw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ draw });
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
    amount?: number;
    drawDate?: string;
    method?: string;
    notes?: string | null;
    receiptUrl?: string | null;
  };

  const data: {
    userId?: string;
    amount?: number;
    drawDate?: Date;
    method?: string;
    notes?: string | null;
    receiptUrl?: string | null;
  } = {};

  if (body.userId !== undefined) data.userId = body.userId;
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be greater than 0" }, { status: 400 });
    }
    data.amount = amount;
  }
  if (body.drawDate !== undefined) data.drawDate = new Date(body.drawDate);
  if (body.method !== undefined) data.method = body.method;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl;

  const draw = await prisma.ownerDraw.update({
    where: { id },
    data,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ draw });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  await prisma.ownerDraw.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
