"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Lock the job's bid cost rate: the simple average of the selected field crew's
 * burdened hourly cost (wage x (1 + burden)), saved on the job.
 *
 * ADMIN and OFFICE only. Only field crew with a wage above $0 count. Returns
 * just the locked rate, crew ids and date: individual wages never leave here.
 */
export async function lockBidCrew(jobId: string, userIds: string[]) {
  const session = await auth();
  if (
    !session?.user?.active ||
    (session.user.role !== "ADMIN" && session.user.role !== "OFFICE")
  ) {
    throw new Error("Only ADMIN or OFFICE can lock the bid cost rate.");
  }
  if (!Array.isArray(userIds) || userIds.some((id) => typeof id !== "string")) {
    throw new Error("Invalid crew selection.");
  }

  const [wages, rates, job] = await Promise.all([
    prisma.employeeWage.findMany({
      where: { userId: { in: userIds }, isFieldCrew: true, hourlyWage: { gt: 0 } },
      select: { userId: true, hourlyWage: true, burdenRate: true },
    }),
    prisma.companyRates.findUnique({ where: { id: "singleton" } }),
    prisma.job.findUnique({ where: { id: jobId }, select: { id: true } }),
  ]);
  if (!job) throw new Error("Job not found.");
  if (wages.length === 0) {
    throw new Error("Pick at least one field crew member with a wage set.");
  }

  const defaultBurden = rates?.defaultBurden ?? 0.35;
  const burdened = wages.map(
    (w) => w.hourlyWage * (1 + (w.burdenRate ?? defaultBurden)),
  );
  const average = burdened.reduce((s, n) => s + n, 0) / burdened.length;
  const bidCostRate = Math.round(average * 100) / 100;
  const bidCrewIds = wages.map((w) => w.userId);
  const bidCostRateSetAt = new Date();

  await prisma.job.update({
    where: { id: jobId },
    data: { bidCostRate, bidCrewIds, bidCostRateSetAt },
  });
  revalidatePath(`/jobs/${jobId}`);

  return { bidCostRate, bidCrewIds, bidCostRateSetAt: bidCostRateSetAt.toISOString() };
}
