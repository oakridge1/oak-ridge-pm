import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PlClient from "./pl-client";

// ── Types shared with client ──────────────────────────────────────────────────

export type PlData = {
  period: { start: string; end: string; label: string };
  revenue: {
    totalInvoiced: number;
    totalCollected: number;
    outstanding: number;
  };
  directCosts: {
    labor: number;
    materials: number;
    subcontractors: number;
    equipment: number;
    other: number;
    total: number;
  };
  grossProfit: number;
  grossMarginPct: number;
  overhead: {
    byCategory: Array<{ category: string; amount: number }>;
    total: number;
  };
  distributions: {
    byPerson: Array<{ name: string; type: "draw" | "contractor"; amount: number }>;
    total: number;
  };
  netProfit: number;
  netMarginPct: number;
};

export default async function PlPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") redirect("/");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // ── Revenue ──────────────────────────────────────────────────────────────────

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { not: "DRAFT" },
      },
      select: { amount: true, status: true, jobId: true },
    }),
    prisma.payment.findMany({
      where: { date: { gte: start, lte: end } },
      select: { amount: true },
    }),
  ]);

  const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount.toNumber(), 0);
  const totalCollected = payments.reduce((s, p) => s + p.amount.toNumber(), 0);
  const outstanding = Math.max(0, totalInvoiced - totalCollected);

  // ── Direct costs ─────────────────────────────────────────────────────────────

  const jobs = await prisma.job.findMany({
    where: { isSystemJob: false },
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
  let totalSubs = 0;
  let totalEquip = 0;
  let totalOther = 0;

  for (const job of jobs) {
    const hasActivity = job.laborEntries.length > 0 || job.materials.length > 0;
    for (const entry of job.laborEntries) {
      const wage = entry.user.wage;
      if (!wage) continue;
      totalLabor += entry.hours * wage.hourlyWage * (1 + wage.burdenRate);
    }
    totalMaterials += job.materials.reduce((s, m) => s + m.amount.toNumber(), 0);
    if (hasActivity) {
      const subRaw = job.subcontractorCost as { toNumber?: () => number } | null;
      totalSubs += subRaw?.toNumber?.() ?? (typeof subRaw === "number" ? subRaw : 0);
      const equipRaw = job.equipmentCost as { toNumber?: () => number } | null;
      const equipCost = equipRaw?.toNumber?.() ?? (typeof equipRaw === "number" ? equipRaw : 0);
      totalEquip += equipCost * ((job.equipmentBillPct ?? 0) / 100);
      if (job.otherCosts && Array.isArray(job.otherCosts)) {
        for (const oc of job.otherCosts as Array<{ amount?: number }>) {
          totalOther += typeof oc.amount === "number" ? oc.amount : 0;
        }
      }
    }
  }

  const directCostsTotal = totalLabor + totalMaterials + totalSubs + totalEquip + totalOther;

  // ── Overhead ─────────────────────────────────────────────────────────────────

  const allOverheadCosts = await prisma.overheadCost.findMany();
  const categoryMap = new Map<string, number>();
  let overheadTotal = 0;
  for (const c of allOverheadCosts) {
    const active =
      !c.isRecurring
        ? c.effectiveDate >= start && c.effectiveDate <= end
        : c.effectiveDate <= end && (c.endDate === null || c.endDate >= start);
    if (active) {
      categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.amount);
      overheadTotal += c.amount;
    }
  }
  const overheadByCategory = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

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

  const personMap = new Map<string, { name: string; type: "draw" | "contractor"; amount: number }>();
  for (const d of draws) {
    const name = d.user.name ?? "Unknown";
    const key = `draw:${name}`;
    const ex = personMap.get(key);
    if (ex) ex.amount += d.amount;
    else personMap.set(key, { name, type: "draw", amount: d.amount });
  }
  for (const cp of contractorPayments) {
    const name = cp.user.name ?? "Unknown";
    const key = `contractor:${name}`;
    const ex = personMap.get(key);
    if (ex) ex.amount += cp.amountUSD;
    else personMap.set(key, { name, type: "contractor", amount: cp.amountUSD });
  }
  const distributionsByPerson = Array.from(personMap.values()).sort((a, b) => b.amount - a.amount);
  const distributionsTotal = distributionsByPerson.reduce((s, d) => s + d.amount, 0);

  // ── Summary ───────────────────────────────────────────────────────────────────

  const grossProfit = totalInvoiced - directCostsTotal;
  const grossMarginPct = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0;
  const netProfit = grossProfit - overheadTotal - distributionsTotal;
  const netMarginPct = totalInvoiced > 0 ? (netProfit / totalInvoiced) * 100 : 0;

  const label = start.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const initialData: PlData = {
    period: { start: start.toISOString(), end: end.toISOString(), label },
    revenue: { totalInvoiced, totalCollected, outstanding },
    directCosts: {
      labor: totalLabor,
      materials: totalMaterials,
      subcontractors: totalSubs,
      equipment: totalEquip,
      other: totalOther,
      total: directCostsTotal,
    },
    grossProfit,
    grossMarginPct,
    overhead: { byCategory: overheadByCategory, total: overheadTotal },
    distributions: { byPerson: distributionsByPerson, total: distributionsTotal },
    netProfit,
    netMarginPct,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PlClient initialData={initialData} />
    </div>
  );
}
