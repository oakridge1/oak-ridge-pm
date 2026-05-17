export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const item = await prisma.stockItem.update({ where: { id }, data: body });
  return NextResponse.json(item);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  await prisma.stockItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
