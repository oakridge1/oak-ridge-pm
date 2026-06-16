export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Get current month overhead total (recurring + one-time in current month)
  const overheadCosts = await prisma.overheadCost.findMany();

  let monthlyOverhead = 0;
  for (const c of overheadCosts) {
    if (!c.isRecurring) {
      if (c.effectiveDate >= monthStart && c.effectiveDate <= monthEnd) {
        monthlyOverhead += c.amount;
      }
    } else {
      if (c.effectiveDate <= monthEnd && (c.endDate === null || c.endDate >= monthStart)) {
        monthlyOverhead += c.amount;
      }
    }
  }

  // Active non-system, non-excluded jobs
  const activeJobs = await prisma.job.findMany({
    where: { isSystemJob: false, excludeFromPL: false, status: "IN_PROGRESS" },
    select: { id: true, jobNumber: true, jobName: true },
  });

  const activeJobCount = activeJobs.length;
  const allocationPerJob = activeJobCount > 0 ? monthlyOverhead / activeJobCount : 0;

  const settings = await prisma.companySettings.findUnique({
    where: { id: "singleton" },
    select: { overheadAllocMethod: true },
  });

  const method = settings?.overheadAllocMethod ?? "equal";

  return NextResponse.json({
    monthlyOverhead,
    activeJobCount,
    allocationPerJob,
    method,
    jobs: activeJobs.map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      jobName: j.jobName,
      allocation: allocationPerJob,
    })),
  });
}
