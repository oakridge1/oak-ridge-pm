export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ── Period helpers (duplicated from parent route for isolation) ───────────────

interface PeriodResult {
  start: Date;
  end: Date;
}

function getPeriodDates(searchParams: URLSearchParams): PeriodResult {
  const now = new Date();
  const period = searchParams.get("period") ?? "month";

  if (period === "month") {
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0, 23, 59, 59, 999),
    };
  }

  if (period === "quarter") {
    const quarter = parseInt(searchParams.get("quarter") ?? "1", 10);
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    const qm = (quarter - 1) * 3;
    return {
      start: new Date(year, qm, 1),
      end: new Date(year, qm + 3, 0, 23, 59, 59, 999),
    };
  }

  if (period === "year") {
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }

  if (period === "alltime") {
    return {
      start: new Date(2000, 0, 1),
      end: new Date(2099, 11, 31, 23, 59, 59, 999),
    };
  }

  if (period === "custom") {
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    if (startStr && endStr) {
      return {
        start: new Date(startStr + "T00:00:00"),
        end: new Date(endStr + "T23:59:59.999"),
      };
    }
  }

  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function getOverheadTotal(
  costs: Array<{
    amount: number;
    isRecurring: boolean;
    effectiveDate: Date;
    endDate: Date | null;
  }>,
  start: Date,
  end: Date
): number {
  let total = 0;
  for (const c of costs) {
    if (!c.isRecurring) {
      if (c.effectiveDate >= start && c.effectiveDate <= end) total += c.amount;
      continue;
    }
    if (c.effectiveDate > end) continue;
    if (c.endDate !== null && c.endDate < start) continue;
    total += c.amount;
  }
  return total;
}

// ── GET /api/admin/pl/jobs ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { start, end } = getPeriodDates(searchParams);

  // Fetch all overhead costs for allocation
  const allOverheadCosts = await prisma.overheadCost.findMany();
  const totalOverhead = getOverheadTotal(allOverheadCosts, start, end);

  // Fetch all jobs with period-filtered related data (exclude test/excluded jobs)
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { isSystemJob: true },
        { isSystemJob: false, excludeFromPL: false },
      ],
    },
    include: {
      laborEntries: {
        where: { date: { gte: start, lte: end } },
        include: { user: { include: { wage: true } } },
      },
      materials: {
        where: { createdAt: { gte: start, lte: end } },
        select: { amount: true },
      },
      invoices: {
        where: {
          date: { gte: start, lte: end },
          status: { not: "DRAFT" },
        },
        select: { amount: true },
      },
      payments: {
        where: { date: { gte: start, lte: end } },
        select: { amount: true },
      },
    },
  });

  // Count active non-system, non-excluded jobs for overhead allocation
  const activeJobCount = jobs.filter(
    (j) => !j.isSystemJob && !j.excludeFromPL && (j.status === "ACTIVE" || j.status === "COMPLETED")
  ).length;

  const overheadAllocation =
    activeJobCount > 0 ? totalOverhead / activeJobCount : 0;

  const jobRows = jobs.map((job) => {
    const contractValue = (() => {
      const cv = job.contractValue as { toNumber?: () => number } | null;
      return cv?.toNumber?.() ?? (typeof cv === "number" ? cv : 0);
    })();

    const invoiced = job.invoices.reduce((s, inv) => s + inv.amount.toNumber(), 0);
    const collected = job.payments.reduce((s, p) => s + p.amount.toNumber(), 0);

    // Direct costs
    let labor = 0;
    for (const entry of job.laborEntries) {
      const wage = entry.user.wage;
      if (!wage) continue;
      labor += entry.hours * wage.hourlyWage * (1 + wage.burdenRate);
    }

    const materials = job.materials.reduce((s, m) => s + m.amount.toNumber(), 0);

    const hasActivity = job.laborEntries.length > 0 || job.materials.length > 0;

    let subcontractors = 0;
    let equipment = 0;
    let other = 0;

    if (hasActivity && !job.isSystemJob) {
      const subRaw = job.subcontractorCost as { toNumber?: () => number } | null;
      subcontractors = subRaw?.toNumber?.() ?? (typeof subRaw === "number" ? subRaw : 0);

      const equipRaw = job.equipmentCost as { toNumber?: () => number } | null;
      const equipCost = equipRaw?.toNumber?.() ?? (typeof equipRaw === "number" ? equipRaw : 0);
      const equipBillPct = job.equipmentBillPct ?? 0;
      equipment = equipCost * (equipBillPct / 100);

      if (job.otherCosts && Array.isArray(job.otherCosts)) {
        for (const oc of job.otherCosts as Array<{ amount?: number }>) {
          other += typeof oc.amount === "number" ? oc.amount : 0;
        }
      }
    }

    const directCosts = labor + materials + subcontractors + equipment + other;
    const alloc = (job.isSystemJob || job.excludeFromPL) ? 0 : overheadAllocation;
    const trueProfit = invoiced - directCosts - alloc;
    const marginPct = invoiced > 0 ? (trueProfit / invoiced) * 100 : 0;

    return {
      id: job.id,
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      status: job.status,
      isSystemJob: job.isSystemJob,
      contractValue,
      invoiced,
      collected,
      directCosts,
      overheadAllocation: alloc,
      trueProfit,
      marginPct,
    };
  });

  const regularJobs = jobRows
    .filter((r) => !r.isSystemJob)
    .sort((a, b) => b.invoiced - a.invoiced);

  const systemJobRows = jobRows
    .filter((r) => r.isSystemJob)
    .sort((a, b) => b.invoiced - a.invoiced);

  return NextResponse.json({ jobs: regularJobs, systemJobs: systemJobRows });
}
