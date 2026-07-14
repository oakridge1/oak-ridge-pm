import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PanelEditor } from "./panel-editor";

interface PageProps {
  params: Promise<{ id: string; panelId: string }>;
}

export default async function PanelPage({ params }: PageProps) {
  const { panelId } = await params;
  const session = await auth();
  if (!session?.user?.active) redirect("/login");

  const [panel, libraryEntries] = await Promise.all([
    prisma.panelSchedule.findUnique({
      where: { id: panelId },
      include: {
        circuits: { orderBy: { ckt: "asc" } },
        job: { select: { id: true, jobNumber: true, jobName: true, address: true, city: true, state: true, zip: true } },
      },
    }),
    prisma.circuitLibrary.findMany({ orderBy: [{ useCount: "desc" }, { label: "asc" }] }),
  ]);

  if (!panel) notFound();

  return (
    <PanelEditor
      panel={panel}
      libraryEntries={libraryEntries}
      role={session.user.role}
      currentUserName={session.user.name ?? session.user.email ?? "Unknown"}
    />
  );
}
