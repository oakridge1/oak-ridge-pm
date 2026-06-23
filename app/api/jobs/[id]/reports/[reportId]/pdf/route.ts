export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import fs from "fs";
import path from "path";
import {
  FieldInvestigationDoc,
  EmergencyLightingDoc,
  type FullReport,
  type ReportJobInfo,
} from "./_report-templates";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

    const { reportId } = await params;

    const [report, issueCodes] = await Promise.all([
      prisma.jobReport.findUnique({
        where: { id: reportId },
        include: {
          findings: { orderBy: { sortOrder: "asc" } },
          fixtures: { orderBy: { sortOrder: "asc" } },
          summaryRows: { orderBy: { sortOrder: "asc" } },
          job: {
            select: {
              jobNumber: true,
              jobName: true,
              gcCompany: true,
              gcContactName: true,
              gcPhone: true,
              ownerName: true,
              address: true,
              city: true,
              state: true,
              zip: true,
            },
          },
        },
      }),
      prisma.issueCode.findMany(),
    ]);

    if (!report) return new NextResponse("Not found", { status: 404 });

    const logoSrc = getLogoSrc();
    const fullReport = report as unknown as FullReport;
    const job = report.job as ReportJobInfo;

    const doc =
      report.reportType === "EMERGENCY_LIGHTING"
        ? React.createElement(EmergencyLightingDoc, { report: fullReport, job, issueCodes, logoSrc })
        : React.createElement(FieldInvestigationDoc, { report: fullReport, job, logoSrc });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(doc as any);

    const safeTitle = (report.title || "report").replace(/\s+/g, "-");
    const filename = `${report.certNumber ?? "report"}-${safeTitle}.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[Report PDF] Error generating PDF:", err);
    return new NextResponse(
      `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
