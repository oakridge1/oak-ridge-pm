export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ── Period helpers ────────────────────────────────────────────────────────────

interface PeriodResult {
  start: Date;
  end: Date;
  label: string;
}

function getPeriodDates(searchParams: URLSearchParams): PeriodResult {
  const now = new Date();
  const period = searchParams.get("period") ?? "month";

  if (period === "month") {
    const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { start, end, label };
  }

  if (period === "quarter") {
    const quarter = parseInt(searchParams.get("quarter") ?? "1", 10);
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    const quarterStartMonth = (quarter - 1) * 3; // 0-based
    const start = new Date(year, quarterStartMonth, 1);
    const end = new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999);
    const qNames = ["Q1", "Q2", "Q3", "Q4"];
    const label = `${qNames[quarter - 1]} ${year}`;
    return { start, end, label };
  }

  if (period === "year") {
    const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    const label = `FY ${year}`;
    return { start, end, label };
  }

  if (period === "alltime") {
    const start = new Date(2000, 0, 1);
    const end = new Date(2099, 11, 31, 23, 59, 59, 999);
    return { start, end, label: "All Time" };
  }

  if (period === "custom") {
    const startStr = searchParams.get("start");
    const endStr = searchParams.get("end");
    if (!startStr || !endStr) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end, label: "Custom" };
    }
    const start = new Date(startStr + "T00:00:00");
    const end = new Date(endStr + "T23:59:59.999");
    const label = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    return { start, end, label };
  }

  // Default: current month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { start, end, label };
}

// ── Overhead helper — active costs in a period ────────────────────────────────

function getOverheadForPeriod(
  costs: Array<{
    category: string;
    amount: number;
    isRecurring: boolean;
    effectiveDate: Date;
    endDate: Date | null;
  }>,
  start: Date,
  end: Date
): { byCategory: Array<{ category: string; amount: number }>; total: number } {
  const categoryMap = new Map<string, number>();
  let total = 0;

  for (const c of costs) {
    // Non-recurring: must fall within the period
    if (!c.isRecurring) {
      if (c.effectiveDate >= start && c.effectiveDate <= end) {
        categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.amount);
        total += c.amount;
      }
      continue;
    }

    // Recurring: active if started before/during period end AND not ended before period start
    if (c.effectiveDate > end) continue;
    if (c.endDate !== null && c.endDate < start) continue;

    categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.amount);
    total += c.amount;
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { byCategory, total };
}

// ── GET /api/admin/pl ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const { start, end, label } = getPeriodDates(searchParams);

  // ── Revenue ──────────────────────────────────────────────────────────────────

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { not: "DRAFT" },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      select: { amount: true, status: true, jobId: true },
    }),
    prisma.payment.findMany({
      where: {
        date: { gte: start, lte: end },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      select: { amount: true },
    }),
  ]);

  const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount.toNumber(), 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount.toNumber(), 0);
  const outstanding = Math.max(0, totalInvoiced - totalCollected);

  // ── Direct costs — per job ───────────────────────────────────────────────────

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

  let totalLabor = 0;
  let totalMaterials = 0;
  let totalSubcontractors = 0;
  let totalEquipment = 0;
  let totalOther = 0;

  for (const job of jobs) {
    const hasActivity = job.laborEntries.length > 0 || job.materials.length > 0;

    // Labor
    let jobLabor = 0;
    for (const entry of job.laborEntries) {
      const wage = entry.user.wage;
      if (!wage) continue;
      jobLabor += entry.hours * wage.hourlyWage * (1 + wage.burdenRate);
    }
    totalLabor += jobLabor;

    // Materials
    const jobMaterials = job.materials.reduce((s, m) => s + m.amount.toNumber(), 0);
    totalMaterials += jobMaterials;

    // Only count job-level costs if job had activity in period
    if (!hasActivity) continue;

    // Subcontractors
    const subRaw = job.subcontractorCost as { toNumber?: () => number } | null;
    const jobSubs = subRaw?.toNumber?.() ?? (typeof subRaw === "number" ? subRaw : 0);
    totalSubcontractors += jobSubs;

    // Equipment
    const equipRaw = job.equipmentCost as { toNumber?: () => number } | null;
    const equipCost = equipRaw?.toNumber?.() ?? (typeof equipRaw === "number" ? equipRaw : 0);
    const equipBillPct = job.equipmentBillPct ?? 0;
    totalEquipment += equipCost * (equipBillPct / 100);

    // Other costs (JSON array)
    if (job.otherCosts && Array.isArray(job.otherCosts)) {
      for (const oc of job.otherCosts as Array<{ amount?: number }>) {
        totalOther += typeof oc.amount === "number" ? oc.amount : 0;
      }
    }
  }

  const directCostsTotal = totalLabor + totalMaterials + totalSubcontractors + totalEquipment + totalOther;

  // ── Overhead ─────────────────────────────────────────────────────────────────

  const allOverheadCosts = await prisma.overheadCost.findMany();
  const { byCategory: overheadByCategory, total: overheadTotal } = getOverheadForPeriod(
    allOverheadCosts,
    start,
    end
  );

  // ── Distributions ─────────────────────────────────────────────────────────────

  const [draws, contractorPayments] = await Promise.all([
    prisma.ownerDraw.findMany({
      where: { drawDate: { gte: start, lte: end } },
      include: { user: { select: { name: true } } },
    }),
    prisma.contractorPayment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      include: { user: { select: { name: true } } },
    }),
  ]);

  // Merge by person
  const personMap = new Map<string, { name: string; type: "draw" | "contractor"; amount: number }>();

  for (const d of draws) {
    const name = d.user.name ?? "Unknown";
    const key = `draw:${name}`;
    const existing = personMap.get(key);
    if (existing) {
      existing.amount += d.amount;
    } else {
      personMap.set(key, { name, type: "draw", amount: d.amount });
    }
  }

  for (const cp of contractorPayments) {
    const name = cp.user.name ?? "Unknown";
    const key = `contractor:${name}`;
    const existing = personMap.get(key);
    if (existing) {
      existing.amount += cp.amountUSD;
    } else {
      personMap.set(key, { name, type: "contractor", amount: cp.amountUSD });
    }
  }

  const distributionsByPerson = Array.from(personMap.values()).sort((a, b) => b.amount - a.amount);
  const distributionsTotal = distributionsByPerson.reduce((s, d) => s + d.amount, 0);

  // ── P&L summary ───────────────────────────────────────────────────────────────

  const grossProfit = totalInvoiced - directCostsTotal;
  const grossMarginPct = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0;
  const netProfit = grossProfit - overheadTotal - distributionsTotal;
  const netMarginPct = totalInvoiced > 0 ? (netProfit / totalInvoiced) * 100 : 0;

  return NextResponse.json({
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      label,
    },
    revenue: {
      totalInvoiced,
      totalCollected,
      outstanding,
    },
    directCosts: {
      labor: totalLabor,
      materials: totalMaterials,
      subcontractors: totalSubcontractors,
      equipment: totalEquipment,
      other: totalOther,
      total: directCostsTotal,
    },
    grossProfit,
    grossMarginPct,
    overhead: {
      byCategory: overheadByCategory,
      total: overheadTotal,
    },
    distributions: {
      byPerson: distributionsByPerson,
      total: distributionsTotal,
    },
    netProfit,
    netMarginPct,
  });
}
