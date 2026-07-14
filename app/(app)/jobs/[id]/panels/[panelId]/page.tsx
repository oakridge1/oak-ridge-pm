import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ id: string; panelId: string }>;
}

export default async function PanelPage({ params }: PageProps) {
  const { panelId } = await params;

  const panel = await prisma.panelSchedule.findUnique({
    where: { id: panelId },
    include: {
      circuits: { orderBy: { ckt: "asc" } },
      job: { select: { id: true, jobNumber: true, jobName: true } },
    },
  });

  if (!panel) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a href={`/jobs/${panel.job.id}?tab=panels`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to {panel.job.jobName}
        </a>
      </div>
      <div className="bg-white rounded-xl border p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{panel.name}</h1>
        <p className="text-gray-500 text-sm">Circuit editor coming in step 3.</p>
        <p className="text-gray-400 text-xs mt-1">
          {panel.system} · {panel.busAmps}A {panel.mainType}
          {panel.mainType === "MB" && panel.mainAmps ? ` ${panel.mainAmps}A` : ""} · {panel.circuitCount} circuits · {panel.circuits.length} rows
        </p>
      </div>
    </div>
  );
}
