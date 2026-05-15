export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { InspectionDoc } from "../../_templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; inspectionId: string }> }
) {
  const { id, inspectionId } = await params;
  const session = await auth();
  if (!session?.user?.active)
    return new NextResponse("Unauthorized", { status: 401 });

  const [job, inspection] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      select: { jobNumber: true, jobName: true },
    }),
    prisma.inspection.findUnique({
      where: { id: inspectionId, jobId: id },
      include: { createdBy: { select: { name: true } } },
    }),
  ]);

  if (!job || !inspection)
    return new NextResponse("Not found", { status: 404 });

  const data = {
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    type: inspection.type,
    dateCalled: inspection.dateCalled,
    dateScheduled: inspection.dateScheduled,
    inspectorName: inspection.inspectorName,
    inspectorPhone: inspection.inspectorPhone,
    result: inspection.result as "PASS" | "FAIL" | null,
    correctionNotes: inspection.correctionNotes,
    reinspectDate: inspection.reinspectDate,
    notes: inspection.notes,
    createdAt: inspection.createdAt,
    createdBy: inspection.createdBy,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(createElement(InspectionDoc, { data }) as any);
  const typeSlug = inspection.type.replace(/_/g, "-").toLowerCase();
  const fileName = `${job.jobNumber}_Inspection_${typeSlug}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
