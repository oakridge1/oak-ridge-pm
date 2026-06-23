export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string; fixtureId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { fixtureId } = await params;
  const body = await req.json();

  const data: Prisma.ReportFixtureUpdateInput = {};
  if (body.location !== undefined) data.location = body.location;
  if (body.fixtureTag !== undefined) data.fixtureTag = body.fixtureTag;
  if (body.fixtureType !== undefined) data.fixtureType = body.fixtureType;
  if (body.test30sec !== undefined) data.test30sec = body.test30sec;
  if (body.test90min !== undefined) data.test90min = body.test90min;
  if (body.visualPass !== undefined) data.visualPass = body.visualPass;
  if (body.issueCodes !== undefined) data.issueCodes = body.issueCodes;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  await prisma.reportFixture.update({ where: { id: fixtureId }, data });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reportId: string; fixtureId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { fixtureId } = await params;
  await prisma.reportFixture.delete({ where: { id: fixtureId } });

  return NextResponse.json({ ok: true });
}
