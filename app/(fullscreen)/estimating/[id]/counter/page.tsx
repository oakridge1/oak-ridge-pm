import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CounterClient } from "./counter-client";

export default async function CounterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const canEstimate =
    session?.user?.role === "ADMIN" ||
    (session?.user as any)?.estimatingPermission === true;
  if (!canEstimate) redirect("/");

  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    select: { id: true, estimateNumber: true, name: true },
  });
  if (!estimate) redirect("/estimating");

  const areas = await prisma.counterArea.findMany({
    where: { estimateId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Seed a default area if none exist
  let initialAreas = areas;
  if (areas.length === 0) {
    const area = await prisma.counterArea.create({
      data: { estimateId: id, name: "Area 1", sortOrder: 0 },
    });
    initialAreas = [area];
  }

  return (
    <CounterClient
      estimate={estimate}
      initialAreas={initialAreas.map((a) => ({
        ...a,
        counts: (a.counts ?? {}) as Record<string, number>,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }))}
    />
  );
}
