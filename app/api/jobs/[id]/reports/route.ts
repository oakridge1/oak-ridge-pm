export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ReportType } from "@/app/generated/prisma/client";

const CERT_PREFIX: Record<ReportType, string> = {
  FIELD_INVESTIGATION: "FI",
  EMERGENCY_LIGHTING: "EL",
  INFRARED_THERMAL: "IR",
};

// GET — list reports for a job (with counts). Primarily handled via the job
// page query; provided here for completeness / API access.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;

  const reports = await prisma.jobReport.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reportType: true,
      title: true,
      status: true,
      certNumber: true,
      overallResult: true,
      inspectionDate: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { findings: true, fixtures: true } },
    },
  });

  return NextResponse.json(reports);
}

// POST — create a new report with an auto-generated cert number.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (u.role !== "ADMIN" && u.role !== "OFFICE") return new NextResponse("Forbidden", { status: 403 });

  const { id: jobId } = await params;
  const body = await req.json();
  const { reportType, title } = body ?? {};

  if (!reportType || !(reportType in CERT_PREFIX)) {
    return new NextResponse("Invalid reportType", { status: 400 });
  }
  if (!title || typeof title !== "string" || !title.trim()) {
    return new NextResponse("Title required", { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return new NextResponse("Job not found", { status: 404 });

  // Cert number: PREFIX-YYYY-NNN, NNN = count of this type created this year + 1.
  const prefix = CERT_PREFIX[reportType as ReportType];
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const countThisYear = await prisma.jobReport.count({
    where: {
      reportType: reportType as ReportType,
      createdAt: { gte: yearStart, lt: yearEnd },
    },
  });
  const certNumber = `${prefix}-${year}-${String(countThisYear + 1).padStart(3, "0")}`;

  const report = await prisma.jobReport.create({
    data: {
      jobId,
      reportType: reportType as ReportType,
      title: title.trim(),
      certNumber,
      createdById: u.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ reportId: report.id }, { status: 201 });
}
