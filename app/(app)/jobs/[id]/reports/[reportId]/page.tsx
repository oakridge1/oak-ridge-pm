import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string; reportId: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { reportId } = await params;

  const report = await prisma.jobReport.findUnique({
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
          address: true,
          city: true,
          state: true,
        },
      },
    },
  });

  if (!report) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a href={`/jobs/${report.job.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to {report.job.jobName}
        </a>
      </div>
      <div className="bg-white rounded-xl border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{report.title}</h1>
        <p className="text-gray-500 text-sm">Report editor coming in next build.</p>
        <p className="text-gray-400 text-xs mt-1">
          Type: {report.reportType} | Status: {report.status} | Cert: {report.certNumber}
        </p>
      </div>
    </div>
  );
}
