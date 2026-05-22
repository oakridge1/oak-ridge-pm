import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import OverheadClient from "./overhead-client";

export default async function OverheadPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") redirect("/");

  const costs = await prisma.overheadCost.findMany({ orderBy: { effectiveDate: "desc" } });

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <OverheadClient
        initialCosts={costs.map((c) => ({
          ...c,
          effectiveDate: c.effectiveDate.toISOString(),
          endDate: c.endDate?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
