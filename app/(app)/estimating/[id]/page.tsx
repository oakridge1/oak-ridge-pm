import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EstimateDetailClient } from "./estimate-client";

export default async function EstimateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const canEstimate =
    session?.user?.role === "ADMIN" ||
    (session?.user as any)?.estimatingPermission === true;
  if (!canEstimate) redirect("/");

  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      designFeeUser: { select: { id: true, name: true } },
      job: { select: { id: true, jobNumber: true } },
    },
  });

  if (!estimate) redirect("/estimating");

  // Fetch users with estimating permission (for design fee dropdown)
  const estimatingUsers = await prisma.user.findMany({
    where: { active: true, estimatingPermission: true },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // Serialize
  const serialized = {
    ...estimate,
    createdAt: estimate.createdAt.toISOString(),
    updatedAt: estimate.updatedAt.toISOString(),
    awardedAt: estimate.awardedAt?.toISOString() ?? null,
  };

  return (
    <EstimateDetailClient
      estimate={serialized}
      isAdmin={session?.user?.role === "ADMIN"}
      currentUserId={session?.user?.id ?? ""}
      estimatingUsers={estimatingUsers}
    />
  );
}
