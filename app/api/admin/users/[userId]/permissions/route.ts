export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  const perms = await prisma.userPermission.findMany({ where: { userId, permission: "ORDERING" } });
  return NextResponse.json(perms);
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  const body = await req.json();
  const { scope, jobId } = body;

  // Check if already exists
  const existing = await prisma.userPermission.findFirst({
    where: { userId, permission: "ORDERING", scope: scope ?? "GLOBAL" },
  });
  if (existing) return NextResponse.json(existing);

  const perm = await prisma.userPermission.create({
    data: {
      userId,
      permission: "ORDERING",
      scope: scope ?? "GLOBAL",
      jobId: jobId ?? null,
      grantedById: session.user.id,
    },
  });
  return NextResponse.json(perm);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { userId } = await params;
  await prisma.userPermission.deleteMany({ where: { userId, permission: "ORDERING", scope: "GLOBAL" } });
  return NextResponse.json({ ok: true });
}
