import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TakeoffClient } from "./takeoff-client";

export default async function TakeoffPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const canEstimate =
    session?.user?.role === "ADMIN" ||
    (session?.user as any)?.estimatingPermission === true;
  if (!canEstimate) redirect("/");

  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    select: {
      id: true,
      estimateNumber: true,
      name: true,
      laborRate: true,
      bulkMarkup: true,
      lightMarkup: true,
      permitMarkup: true,
      subMarkup: true,
      overhead: true,
      profit: true,
      nonProd: true,
      designFeePct: true,
      conditionMult: true,
      heightAdj: true,
    },
  });

  if (!estimate) redirect("/estimating");

  const drawings = await prisma.takeoffDrawing.findMany({
    where: { estimateId: id },
    orderBy: { createdAt: "asc" },
  });

  const serializedDrawings = drawings.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    markups: d.markups as any[],
    runTypes: d.runTypes as any[],
  }));

  return <TakeoffClient estimate={estimate} initialDrawings={serializedDrawings} />;
}
