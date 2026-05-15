export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ChangeOrderDoc } from "../../_templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; coId: string }> }
) {
  const { id, coId } = await params;
  const session = await auth();
  if (!session?.user?.active)
    return new NextResponse("Unauthorized", { status: 401 });

  const [job, co] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      select: { jobNumber: true, jobName: true },
    }),
    prisma.changeOrder.findUnique({
      where: { id: coId, jobId: id },
      include: { requestedBy: { select: { name: true } } },
    }),
  ]);

  if (!job || !co) return new NextResponse("Not found", { status: 404 });

  const data = {
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    coNumber: co.coNumber,
    date: co.date,
    description: co.description,
    location: co.location,
    reason: co.reason,
    requestedByName: co.requestedByName,
    requestedBy: co.requestedBy,
    estimatedHours: co.estimatedHours,
    estimatedLaborCost: co.estimatedLaborCost?.toNumber() ?? null,
    estimatedMaterials: co.estimatedMaterials?.toNumber() ?? null,
    status: co.status,
    adminNotes: co.adminNotes,
    approvedValue: co.approvedValue?.toNumber() ?? null,
    createdAt: co.createdAt,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(createElement(ChangeOrderDoc, { data }) as any);
  const safeName = co.description.slice(0, 30).replace(/[^a-z0-9]/gi, "_");
  const fileName = `${job.jobNumber}_CO${co.coNumber ?? ""}_${safeName}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
