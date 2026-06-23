import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportEditor } from "./report-editor";

interface PageProps {
  params: Promise<{ id: string; reportId: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { reportId } = await params;

  const [report, libraryFindings, issueCodes] = await Promise.all([
    prisma.jobReport.findUnique({
      where: { id: reportId },
      include: {
        findings: { orderBy: { sortOrder: "asc" } },
        fixtures: { orderBy: { sortOrder: "asc" } },
        summaryRows: { orderBy: { sortOrder: "asc" } },
        job: {
          select: {
            id: true,
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
    prisma.libraryFinding.findMany({
      orderBy: [{ useCount: "desc" }, { title: "asc" }],
    }),
    prisma.issueCode.findMany({
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
  ]);

  if (!report) notFound();

  return (
    <ReportEditor
      report={report}
      libraryFindings={libraryFindings}
      issueCodes={issueCodes}
    />
  );
}
