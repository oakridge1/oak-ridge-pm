export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET — returns all BomPricing overrides
export async function GET() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const overrides = await prisma.bomPricing.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(overrides);
}

// PATCH — upsert one or more BomPricing overrides
// Body: Array<{ id: string; mat: number; lhr: number }>
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const items: { id: string; mat: number; lhr: number }[] = Array.isArray(body) ? body : [body];

  const uid = session.user.id ?? null;
  const results = await Promise.all(
    items.map(item =>
      prisma.bomPricing.upsert({
        where: { id: item.id },
        update: { mat: item.mat, lhr: item.lhr, updatedBy: uid },
        create: { id: item.id, mat: item.mat, lhr: item.lhr, updatedBy: uid },
      })
    )
  );

  return NextResponse.json(results);
}

// DELETE — remove a BomPricing override (revert to BOM default)
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await req.json();
  if (!id) return new NextResponse("id required", { status: 400 });

  await prisma.bomPricing.delete({ where: { id } }).catch(() => { /* already gone */ });
  return NextResponse.json({ ok: true });
}
