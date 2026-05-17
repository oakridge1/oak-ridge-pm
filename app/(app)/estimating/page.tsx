import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EstimatingClient } from "./estimating-client";

export default async function EstimatingPage() {
  const session = await auth();
  const canEstimate =
    session?.user?.role === "ADMIN" ||
    (session?.user as any)?.estimatingPermission === true;
  if (!canEstimate) redirect("/");

  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      designFeeUser: { select: { id: true, name: true } },
      job: { select: { id: true, jobNumber: true } },
    },
  });

  // Serialize dates
  const serialized = estimates.map(e => ({
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    awardedAt: e.awardedAt?.toISOString() ?? null,
  }));

  return <EstimatingClient estimates={serialized} isAdmin={session?.user?.role === "ADMIN"} />;
}
