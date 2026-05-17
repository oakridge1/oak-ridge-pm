export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { estimatingPermission: true } });
  return NextResponse.json({ estimatingPermission: user?.estimatingPermission ?? false });
}

export async function POST(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  await prisma.user.update({ where: { id: userId }, data: { estimatingPermission: true } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  await prisma.user.update({ where: { id: userId }, data: { estimatingPermission: false } });
  return NextResponse.json({ ok: true });
}
