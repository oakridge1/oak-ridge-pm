export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string; findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { findingId } = await params;
  const body = await req.json();

  const data: Prisma.ReportFindingEntryUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.body !== undefined) data.body = body.body;
  if (body.necReferences !== undefined) data.necReferences = body.necReferences;
  if (body.hazardNote !== undefined) data.hazardNote = body.hazardNote;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  await prisma.reportFindingEntry.update({ where: { id: findingId }, data });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reportId: string; findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { reportId, findingId } = await params;

  await prisma.reportFindingEntry.delete({ where: { id: findingId } });

  // Reorder remaining findings to keep sortOrder contiguous.
  const remaining = await prisma.reportFindingEntry.findMany({
    where: { reportId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await Promise.all(
    remaining.map((f, idx) => prisma.reportFindingEntry.update({ where: { id: f.id }, data: { sortOrder: idx } }))
  );

  return NextResponse.json({ ok: true });
}
