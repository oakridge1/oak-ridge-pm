export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, email, phone, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supplier = await prisma.supplier.update({
    where: { id },
    data: { name: name.trim(), email: email?.trim() || null, phone: phone?.trim() || null, notes: notes?.trim() || null },
  });
  return NextResponse.json(supplier);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
