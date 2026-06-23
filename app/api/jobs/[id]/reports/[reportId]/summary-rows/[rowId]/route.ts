export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string; rowId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { rowId } = await params;
  const body = await req.json();

  const data: Prisma.ReportSummaryRowUpdateInput = {};
  if (body.necArticle !== undefined) data.necArticle = body.necArticle;
  if (body.requirement !== undefined) data.requirement = body.requirement;
  if (body.status !== undefined) data.status = body.status;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  await prisma.reportSummaryRow.update({ where: { id: rowId }, data });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reportId: string; rowId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { rowId } = await params;
  await prisma.reportSummaryRow.delete({ where: { id: rowId } });

  return NextResponse.json({ ok: true });
}
