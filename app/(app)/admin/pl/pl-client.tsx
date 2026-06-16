"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp, ChevronDown, ChevronsUpDown, Mail } from "lucide-react";
import type { PlData } from "./page";

// ── Types ─────────────────────────────────────────────────────────────────────

type PeriodMode = "month" | "quarter" | "year" | "alltime" | "custom";

interface JobRow {
  id: string;
  jobNumber: string;
  jobName: string;
  status: string;
  isSystemJob: boolean;
  contractValue: number;
  invoiced: number;
  collected: number;
  directCosts: number;
  overheadAllocation: number;
  trueProfit: number;
  marginPct: number;
}

type SortKey = keyof Omit<JobRow, "id" | "jobNumber" | "jobName" | "status" | "isSystemJob">;

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function fmtMoney(n: number) {
  return fmt.format(n);
}

function fmtPct(n: number) {
  return n.toFixed(1) + "%";
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildQueryString(mode: PeriodMode, opts: PeriodOptions): string {
  const base = `period=${mode}`;
  if (mode === "month") return `${base}&month=${opts.month}&year=${opts.year}`;
  if (mode === "quarter") return `${base}&quarter=${opts.quarter}&year=${opts.year}`;
  if (mode === "year") return `${base}&year=${opts.year}`;
  if (mode === "alltime") return base;
  if (mode === "custom") return `${base}&start=${opts.customStart}&end=${opts.customEnd}`;
  return base;
}

interface PeriodOptions {
  month: number;
  year: number;
  quarter: number;
  customStart: string;
  customEnd: string;
}

// ── Admin Nav ─────────────────────────────────────────────────────────────────

function AdminNav() {
  return (
    <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 flex-wrap">
      <a href="/admin" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Dashboard
      </a>
      <a href="/admin/users" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Users
      </a>
      <a href="/admin/receipts" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Receipts
      </a>
      <a href="/admin/overhead" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Overhead
      </a>
      <a href="/admin/owner-draws" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Owner Draws
      </a>
      <a href="/admin/contractor-payments" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Contractor Pay
      </a>
      <a
        href="/admin/pl"
        className="text-sm font-medium text-[#1e3a8a] border-b-2 border-[#1e3a8a] pb-1 -mb-5"
      >
        P&amp;L
      </a>
      <a href="/admin/settings" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Settings
      </a>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-4/6" />
      </div>
    </div>
  );
}

// ── Period Selector ───────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  mode: PeriodMode;
  opts: PeriodOptions;
  onChange: (mode: PeriodMode, opts: PeriodOptions) => void;
}

function PeriodSelector({ mode, opts, onChange }: PeriodSelectorProps) {
  const now = new Date();

  function setMode(m: PeriodMode) {
    onChange(m, opts);
  }

  function setOpts(partial: Partial<PeriodOptions>) {
    onChange(mode, { ...opts, ...partial });
  }

  const tabs: Array<{ key: PeriodMode; label: string }> = [
    { key: "month", label: "This Month" },
    { key: "quarter", label: "This Quarter" },
    { key: "year", label: "This Year" },
    { key: "alltime", label: "All Time" },
    { key: "custom", label: "Custom Range" },
  ];

  return (
    <div className="mb-6">
      {/* Mode tabs */}
      <div className="flex gap-1 flex-wrap mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === t.key
                ? "bg-[#1e3a8a] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-controls */}
      {mode === "month" && (
        <div className="flex items-center gap-3">
          <select
            value={opts.month}
            onChange={(e) => setOpts({ month: parseInt(e.target.value, 10) })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <input
            type="number"
            value={opts.year}
            onChange={(e) => setOpts({ year: parseInt(e.target.value, 10) })}
            min={2020}
            max={2099}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      )}

      {mode === "quarter" && (
        <div className="flex items-center gap-3 flex-wrap">
          {[1, 2, 3, 4].map((q) => (
            <button
              key={q}
              onClick={() => setOpts({ quarter: q })}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                opts.quarter === q
                  ? "bg-[#1e3a8a] text-white border-[#1e3a8a]"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Q{q}
            </button>
          ))}
          <input
            type="number"
            value={opts.year}
            onChange={(e) => setOpts({ year: parseInt(e.target.value, 10) })}
            min={2020}
            max={2099}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      )}

      {mode === "year" && (
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={opts.year}
            onChange={(e) => setOpts({ year: parseInt(e.target.value, 10) })}
            min={2020}
            max={2099}
            className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      )}

      {mode === "custom" && (
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start</label>
            <input
              type="date"
              value={opts.customStart}
              onChange={(e) => setOpts({ customStart: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End</label>
            <input
              type="date"
              value={opts.customEnd}
              onChange={(e) => setOpts({ customEnd: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Revenue Card ──────────────────────────────────────────────────────────────

function RevenueCard({ data }: { data: PlData["revenue"] & { totalInvoiced: number } }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Revenue</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Total Invoiced</span>
          <span className="font-medium text-gray-900">{fmtMoney(data.totalInvoiced)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Total Collected</span>
          <span className="font-medium text-gray-900">{fmtMoney(data.totalCollected)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Outstanding</span>
          <span className={`font-medium ${data.outstanding > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {fmtMoney(data.outstanding)}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
          <span className="text-gray-700">Net Revenue</span>
          <span className="text-gray-900">{fmtMoney(data.totalInvoiced)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Direct Costs Card ─────────────────────────────────────────────────────────

function DirectCostsCard({
  directCosts,
  grossProfit,
  grossMarginPct,
}: {
  directCosts: PlData["directCosts"];
  grossProfit: number;
  grossMarginPct: number;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Direct Costs</h2>
      <div className="space-y-2 text-sm">
        {(
          [
            ["Labor", directCosts.labor],
            ["Materials", directCosts.materials],
            ["Subcontractors", directCosts.subcontractors],
            ["Equipment", directCosts.equipment],
            ["Other", directCosts.other],
          ] as [string, number][]
        ).map(([label, val]) => (
          <div key={label} className="flex justify-between">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium text-gray-900">{fmtMoney(val)}</span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
          <span className="text-gray-700">Total Direct Costs</span>
          <span className="text-gray-900">{fmtMoney(directCosts.total)}</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Gross Profit</span>
          <span className={`text-lg font-bold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
            {fmtMoney(grossProfit)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">Gross Margin</span>
          <span className={`text-sm font-medium ${grossMarginPct >= 0 ? "text-green-600" : "text-red-600"}`}>
            {fmtPct(grossMarginPct)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Overhead Card ─────────────────────────────────────────────────────────────

function OverheadCard({ overhead }: { overhead: PlData["overhead"] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Overhead</h2>
      {overhead.byCategory.length === 0 ? (
        <p className="text-sm text-gray-400">No overhead costs in this period.</p>
      ) : (
        <div className="space-y-2 text-sm">
          {overhead.byCategory.map(({ category, amount }) => (
            <div key={category} className="flex justify-between">
              <span className="text-gray-600">{category}</span>
              <span className="font-medium text-gray-900">{fmtMoney(amount)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
            <span className="text-gray-700">Total Overhead</span>
            <span className="text-gray-900">{fmtMoney(overhead.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Distributions Card ────────────────────────────────────────────────────────

function DistributionsCard({ distributions }: { distributions: PlData["distributions"] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Distributions</h2>
      {distributions.byPerson.length === 0 ? (
        <p className="text-sm text-gray-400">No distributions in this period.</p>
      ) : (
        <div className="space-y-2 text-sm">
          {distributions.byPerson.map(({ name, type, amount }) => (
            <div key={`${type}:${name}`} className="flex justify-between">
              <span className="text-gray-600">
                {name}
                <span className="ml-1.5 text-xs text-gray-400">
                  ({type === "draw" ? "Owner Draw" : "Contractor"})
                </span>
              </span>
              <span className="font-medium text-gray-900">{fmtMoney(amount)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
            <span className="text-gray-700">Total Distributions</span>
            <span className="text-gray-900">{fmtMoney(distributions.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Net Profit Banner ─────────────────────────────────────────────────────────

function NetProfitBanner({
  netProfit,
  netMarginPct,
  label,
}: {
  netProfit: number;
  netMarginPct: number;
  label: string;
}) {
  const positive = netProfit >= 0;
  return (
    <div
      className={`rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
        positive ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
      }`}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Net Profit — {label}
        </p>
        <p className={`text-3xl font-bold ${positive ? "text-green-700" : "text-red-700"}`}>
          {fmtMoney(netProfit)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-xs text-gray-500 mb-1">Net Margin</p>
        <p className={`text-2xl font-bold ${positive ? "text-green-700" : "text-red-700"}`}>
          {fmtPct(netMarginPct)}
        </p>
      </div>
    </div>
  );
}

// ── Job Profitability Table ───────────────────────────────────────────────────

function marginColor(pct: number) {
  if (pct >= 20) return "text-green-700 bg-green-50";
  if (pct >= 10) return "text-yellow-700 bg-yellow-50";
  return "text-red-700 bg-red-50";
}

function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey | null; dir: "asc" | "desc" }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400 inline ml-1" />;
  return dir === "asc"
    ? <ChevronUp className="w-3.5 h-3.5 text-[#1e3a8a] inline ml-1" />
    : <ChevronDown className="w-3.5 h-3.5 text-[#1e3a8a] inline ml-1" />;
}

function JobTable({
  jobs,
  loading,
}: {
  jobs: JobRow[];
  loading: boolean;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...jobs].sort((a, b) => {
    // system jobs always last
    if (a.isSystemJob !== b.isSystemJob) return a.isSystemJob ? 1 : -1;
    if (!sortKey) return b.invoiced - a.invoiced;
    const va = a[sortKey] as number;
    const vb = b[sortKey] as number;
    return sortDir === "asc" ? va - vb : vb - va;
  });

  const cols: Array<{ key: SortKey; label: string }> = [
    { key: "contractValue", label: "Contract Value" },
    { key: "invoiced", label: "Invoiced" },
    { key: "collected", label: "Collected" },
    { key: "directCosts", label: "Direct Costs" },
    { key: "overheadAllocation", label: "Overhead Alloc" },
    { key: "trueProfit", label: "True Profit" },
    { key: "marginPct", label: "Margin %" },
  ];

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="py-12 text-center text-sm text-gray-400 animate-pulse">Loading job data…</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                Job #
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Job Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-[#1e3a8a] select-none"
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}
                  <SortIcon col={c.key} sortKey={sortKey} dir={sortDir} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-sm text-gray-400">
                  No job data for this period.
                </td>
              </tr>
            ) : (
              sorted.map((job) => (
                <tr
                  key={job.id}
                  onClick={() => router.push(`/jobs/${job.id}#summary`)}
                  className={`cursor-pointer transition-colors ${
                    job.isSystemJob
                      ? "bg-gray-50 hover:bg-gray-100 text-gray-400"
                      : "hover:bg-blue-50"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {job.jobNumber}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-medium max-w-[200px] truncate">
                    {job.jobName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        job.status === "IN_PROGRESS"
                          ? "bg-green-100 text-green-700"
                          : job.status === "COMPLETED"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {fmtMoney(job.contractValue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {fmtMoney(job.invoiced)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {fmtMoney(job.collected)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">
                    {fmtMoney(job.directCosts)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 text-xs">
                    {fmtMoney(job.overheadAllocation)}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${job.trueProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                    {fmtMoney(job.trueProfit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {job.isSystemJob ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${marginColor(job.marginPct)}`}
                      >
                        {fmtPct(job.marginPct)}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────────

export default function PlClient({ initialData }: { initialData: PlData }) {
  const now = new Date();

  const [data, setData] = useState<PlData>(initialData);
  const [loadingData, setLoadingData] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [accountantEmail, setAccountantEmail] = useState<string>("");

  const [mode, setMode] = useState<PeriodMode>("month");
  const [opts, setOpts] = useState<PeriodOptions>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3) + 1,
    customStart: todayIso(),
    customEnd: todayIso(),
  });

  // Fetch accountant email from settings on mount
  useEffect(() => {
    fetch("/api/admin/company-settings")
      .then((r) => r.json())
      .then((d: { accountantEmail?: string }) => {
        if (d.accountantEmail) setAccountantEmail(d.accountantEmail);
      })
      .catch(() => {});
  }, []);

  const qs = buildQueryString(mode, opts);

  const fetchData = useCallback(async (queryString: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/admin/pl?${queryString}`);
      const json = await res.json() as PlData;
      setData(json);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchJobs = useCallback(async (queryString: string) => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`/api/admin/pl/jobs?${queryString}`);
      const json = await res.json() as { jobs: JobRow[]; systemJobs: JobRow[] };
      // Combine regular jobs and system jobs; system jobs render last (gray) via isSystemJob flag
      setJobs([...(json.jobs ?? []), ...(json.systemJobs ?? [])]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Initial load of jobs (data is SSR'd)
  useEffect(() => {
    fetchJobs(qs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePeriodChange(newMode: PeriodMode, newOpts: PeriodOptions) {
    setMode(newMode);
    setOpts(newOpts);
    const newQs = buildQueryString(newMode, newOpts);
    fetchData(newQs);
    fetchJobs(newQs);
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a8a]">Profit &amp; Loss</h1>
        <p className="text-sm text-gray-500 mt-1">Full financial overview by period.</p>
      </div>

      <AdminNav />

      {/* Period selector */}
      <PeriodSelector mode={mode} opts={opts} onChange={handlePeriodChange} />

      {/* Period label + Email Tax Package button */}
      {!loadingData && (
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-sm text-gray-500">
            Showing data for: <span className="font-semibold text-gray-800">{data.period.label}</span>
          </p>
          {mode === "quarter" && (
            <a
              href={`mailto:${accountantEmail}?subject=${encodeURIComponent(
                `Oak Ridge Electrical LLC — Q${opts.quarter} ${opts.year} Financial Summary`
              )}&body=${encodeURIComponent(
                `Please find attached the Q${opts.quarter} ${opts.year} financial summary for Oak Ridge Electrical LLC.`
              )}`}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-[#1e3a8a] hover:bg-[#003d99] px-3 py-1.5 rounded-lg transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              📧 Email Tax Package to Accountant
            </a>
          )}
        </div>
      )}

      {/* Summary cards */}
      {loadingData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            <RevenueCard data={data.revenue} />
            <DirectCostsCard
              directCosts={data.directCosts}
              grossProfit={data.grossProfit}
              grossMarginPct={data.grossMarginPct}
            />
            <OverheadCard overhead={data.overhead} />
            <DistributionsCard distributions={data.distributions} />
          </div>

          {/* Net Profit banner */}
          <div className="mb-8">
            <NetProfitBanner
              netProfit={data.netProfit}
              netMarginPct={data.netMarginPct}
              label={data.period.label}
            />
          </div>
        </>
      )}

      {/* Job Profitability Table */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Job Profitability</h2>
        <p className="text-xs text-gray-400 mb-3">Click a row to open the job. System jobs shown at bottom in gray.</p>
        <JobTable jobs={jobs} loading={loadingJobs} />
      </div>
    </div>
  );
}
