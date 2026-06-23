export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

// PATCH — update core report fields.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const body = await req.json();

  const data: Prisma.JobReportUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.background !== undefined) data.background = body.background;
  if (body.correctiveAction !== undefined) data.correctiveAction = body.correctiveAction;
  if (body.closingParagraph !== undefined) data.closingParagraph = body.closingParagraph;
  if (body.inspectorName !== undefined) data.inspectorName = body.inspectorName;
  if (body.inspectionDate !== undefined) data.inspectionDate = body.inspectionDate ? new Date(body.inspectionDate) : null;
  if (body.nextInspectionDate !== undefined) data.nextInspectionDate = body.nextInspectionDate ? new Date(body.nextInspectionDate) : null;
  if (body.overallResult !== undefined) data.overallResult = body.overallResult ?? null;
  if (body.analysisSections !== undefined) data.analysisSections = body.analysisSections;
  if (body.status !== undefined) data.status = body.status;

  await prisma.jobReport.update({ where: { id: reportId }, data });

  return NextResponse.json({ ok: true });
}
