export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const items = await prisma.bomItem.findMany({ orderBy: [{ cat: "asc" }, { id: "asc" }] });
  return NextResponse.json(items);
}

// POST — add user-created items (custom assembly builder writeback)
// Body: Array<{ id: string; cat: string; name: string; unit: string; mat: number; lhr: number }>
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const items: { id: string; cat: string; name: string; unit: string; mat: number; lhr: number }[] =
    Array.isArray(body) ? body : [body];

  const uid = session.user.id ?? null;
  const results = await Promise.all(
    items.map(item =>
      prisma.bomItem.upsert({
        where: { id: item.id },
        update: { name: item.name, cat: item.cat, unit: item.unit, mat: item.mat, lhr: item.lhr, updatedBy: uid },
        create: {
          id: item.id, cat: item.cat, name: item.name, unit: item.unit,
          mat: item.mat, lhr: item.lhr, mk: "bulk", gc: false, updatedBy: uid,
        },
      })
    )
  );

  return NextResponse.json(results);
}

// PATCH — update a single item's editable fields (ADMIN only).
// Does NOT touch mk or gc.
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json().catch(() => null) as
    { id?: string; name?: string; cat?: string; unit?: string; mat?: number; lhr?: number } | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.bomItem.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const data: Record<string, unknown> = { updatedBy: session.user.email ?? null };
  if (body.name !== undefined) data.name = body.name;
  if (body.cat  !== undefined) data.cat  = body.cat;
  if (body.unit !== undefined) data.unit = body.unit;
  if (body.mat  !== undefined) data.mat  = body.mat;
  if (body.lhr  !== undefined) data.lhr  = body.lhr;

  const updated = await prisma.bomItem.update({ where: { id: body.id }, data });
  return NextResponse.json(updated);
}

// DELETE — remove a single item (ADMIN only). Body: { id }
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.bomItem.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.bomItem.delete({ where: { id: body.id } });
  return NextResponse.json({ success: true });
}
