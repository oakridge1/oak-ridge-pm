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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Revenue: invoices (non-draft) in current month, excluding test jobs
  const invoices = await prisma.invoice.findMany({
    where: {
      date: { gte: start, lte: end },
      status: { not: "DRAFT" },
      job: { excludeFromPL: false, isSystemJob: false },
    },
    select: { amount: true },
  });

  const revenue = invoices.reduce((s, inv) => s + inv.amount.toNumber(), 0);

  // Direct costs: labor + materials for jobs with activity in period (excluding test jobs)
  const jobs = await prisma.job.findMany({
    where: { isSystemJob: false, excludeFromPL: false },
    include: {
      laborEntries: {
        where: { date: { gte: start, lte: end } },
        include: { user: { include: { wage: true } } },
      },
      materials: {
        where: { createdAt: { gte: start, lte: end } },
        select: { amount: true },
      },
    },
  });

  let directCosts = 0;
  for (const job of jobs) {
    for (const entry of job.laborEntries) {
      const wage = entry.user.wage;
      if (!wage) continue;
      directCosts += entry.hours * wage.hourlyWage * (1 + wage.burdenRate);
    }
    for (const mat of job.materials) {
      directCosts += mat.amount.toNumber();
    }
    // Include job-level costs only for jobs with activity
    const hasActivity = job.laborEntries.length > 0 || job.materials.length > 0;
    if (hasActivity) {
      const subRaw = job.subcontractorCost as { toNumber?: () => number } | null;
      directCosts += subRaw?.toNumber?.() ?? (typeof subRaw === "number" ? subRaw : 0);

      const equipRaw = job.equipmentCost as { toNumber?: () => number } | null;
      const equipCost = equipRaw?.toNumber?.() ?? (typeof equipRaw === "number" ? equipRaw : 0);
      directCosts += equipCost * ((job.equipmentBillPct ?? 0) / 100);

      if (job.otherCosts && Array.isArray(job.otherCosts)) {
        for (const oc of job.otherCosts as Array<{ amount?: number }>) {
          directCosts += typeof oc.amount === "number" ? oc.amount : 0;
        }
      }
    }
  }

  const grossProfit = revenue - directCosts;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return NextResponse.json({
    revenue,
    directCosts,
    grossProfit,
    grossMarginPct,
  });
}
