export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { RfiDoc } from "../../_templates";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; rfiId: string }> }
) {
  const { id, rfiId } = await params;
  const session = await auth();
  if (!session?.user?.active)
    return new NextResponse("Unauthorized", { status: 401 });

  const [job, rfi] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      select: { jobNumber: true, jobName: true },
    }),
    prisma.rfi.findUnique({
      where: { id: rfiId, jobId: id },
      include: { submittedBy: { select: { name: true } } },
    }),
  ]);

  if (!job || !rfi)
    return new NextResponse("Not found", { status: 404 });

  const data = {
    jobNumber: job.jobNumber,
    jobName: job.jobName,
    rfiNumber: rfi.rfiNumber,
    subject: rfi.subject,
    description: rfi.description,
    submittedTo: rfi.submittedTo,
    submittedToEmail: rfi.submittedToEmail,
    status: rfi.status as "OPEN" | "ANSWERED",
    dueDate: rfi.dueDate,
    answeredDate: rfi.answeredDate,
    answer: rfi.answer,
    createdAt: rfi.createdAt,
    submittedBy: rfi.submittedBy,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(createElement(RfiDoc, { data }) as any);
  const rfiLabel = `RFI-${String(rfi.rfiNumber).padStart(3, "0")}`;
  const fileName = `${job.jobNumber}_${rfiLabel}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
