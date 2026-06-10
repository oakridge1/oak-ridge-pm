import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function PlSummaryWidget() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [payments, laborEntries, materials] = await Promise.all([
    prisma.payment.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      select: { amount: true },
    }),
    prisma.laborEntry.findMany({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      include: { user: { include: { wage: true } } },
    }),
    prisma.material.findMany({
      where: {
        createdAt: { gte: monthStart, lte: monthEnd },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      select: { amount: true },
    }),
  ]);

  const collected = payments.reduce(
    (s, p) => s + ((p.amount as unknown as { toNumber?: () => number })?.toNumber?.() ?? Number(p.amount ?? 0)),
    0
  );

  const laborCost = laborEntries.reduce((s, e) => {
    if (!e.user?.wage) return s;
    const wage = e.user.wage as { hourlyWage: number; burdenRate: number };
    return s + e.hours * wage.hourlyWage * (1 + wage.burdenRate);
  }, 0);
  const materialsCost = materials.reduce(
    (s, m) => s + ((m.amount as unknown as { toNumber?: () => number })?.toNumber?.() ?? Number(m.amount ?? 0)),
    0
  );
  const directCosts = laborCost + materialsCost;
  const grossProfit = collected - directCosts;
  const grossMarginPct = collected > 0 ? (grossProfit / collected) * 100 : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <Link href="/admin/pl" className="block">
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 hover:border-[#1e3a8a] transition-colors">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            P&amp;L — {monthLabel}
          </h3>
          <span className="text-xs text-[#1e3a8a]">View Full P&amp;L →</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-gray-400">Revenue</p>
            <p className="text-sm font-bold text-gray-900">{fmt(collected)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Direct Costs</p>
            <p className="text-sm font-bold text-gray-900">{fmt(directCosts)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Gross Profit</p>
            <p className={`text-sm font-bold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmt(grossProfit)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Gross Margin</p>
            <p
              className={`text-sm font-bold ${
                grossMarginPct >= 20
                  ? "text-green-600"
                  : grossMarginPct >= 10
                  ? "text-yellow-600"
                  : "text-red-600"
              }`}
            >
              {grossMarginPct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
