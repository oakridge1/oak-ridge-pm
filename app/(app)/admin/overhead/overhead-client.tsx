"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OverheadCost {
  id: string;
  category: string;
  description: string;
  amount: number;
  effectiveDate: string;
  endDate: string | null;
  isRecurring: boolean;
  recurringDay: number | null;
  recurringFreq: string | null;
  autoIncrease: boolean;
  increaseRate: number | null;
  increaseMonth: number | null;
  notes: string | null;
  receiptUrl: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface SummaryData {
  byCategory: { category: string; total: number }[];
  monthTotal: number;
  yearTotal: number;
}

interface FormState {
  category: string;
  description: string;
  amount: string;
  effectiveDate: string;
  endDate: string;
  isRecurring: boolean;
  recurringFreq: string;
  recurringDay: string;
  autoIncrease: boolean;
  increaseRate: string;
  increaseMonth: string;
  receiptUrl: string;
  notes: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Rent & Facilities",
  "Utilities",
  "Communications",
  "Insurance",
  "Vehicle Costs",
  "Tools & Equipment",
  "Office & Shop Supplies",
  "Professional Services",
  "Software & Subscriptions",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Rent & Facilities": "bg-blue-100 text-blue-800",
  "Utilities": "bg-yellow-100 text-yellow-800",
  "Communications": "bg-purple-100 text-purple-800",
  "Insurance": "bg-green-100 text-green-800",
  "Vehicle Costs": "bg-orange-100 text-orange-800",
  "Tools & Equipment": "bg-red-100 text-red-800",
  "Office & Shop Supplies": "bg-pink-100 text-pink-800",
  "Professional Services": "bg-indigo-100 text-indigo-800",
  "Software & Subscriptions": "bg-cyan-100 text-cyan-800",
  "Other": "bg-gray-100 text-gray-800",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FREQ_OPTIONS = ["Monthly", "Weekly", "Bi-weekly", "Quarterly", "Annual"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return {
    category: CATEGORIES[0],
    description: "",
    amount: "",
    effectiveDate: todayIso(),
    endDate: "",
    isRecurring: false,
    recurringFreq: "Monthly",
    recurringDay: "",
    autoIncrease: false,
    increaseRate: "",
    increaseMonth: "",
    receiptUrl: "",
    notes: "",
  };
}

function costInMonth(cost: OverheadCost, month: number, year: number): boolean {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  const effectiveDate = new Date(cost.effectiveDate);
  if (!cost.isRecurring) {
    return effectiveDate >= start && effectiveDate <= end;
  }
  const endDate = cost.endDate ? new Date(cost.endDate) : null;
  return effectiveDate <= end && (endDate == null || endDate >= start);
}

// ── Admin Nav ─────────────────────────────────────────────────────────────────

function AdminNav() {
  return (
    <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 flex-wrap">
      <a href="/admin/users" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Users
      </a>
      <a href="/admin/saved-tasks" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Saved Tasks
      </a>
      <a href="/admin/receipts" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Receipts
      </a>
      <a href="/admin/settings" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Settings
      </a>
      <a href="/admin/overhead" className="text-sm font-medium text-[#1e3a8a] border-b-2 border-[#1e3a8a] pb-1 -mb-5">
        Overhead
      </a>
      <a href="/admin/owner-draws" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Owner Draws
      </a>
      <a href="/admin/contractor-payments" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Contractor Pay
      </a>
      <a href="/admin/pl" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        P&amp;L
      </a>
    </div>
  );
}

// ── Cost Form ─────────────────────────────────────────────────────────────────

function CostForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: FormState;
  onSubmit: (form: FormState) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("endpoint", "receiptImage");
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json() as { url?: string };
      if (data.url) set("receiptUrl", data.url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Effective Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={form.effectiveDate}
            onChange={(e) => set("effectiveDate", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            required
          />
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            required
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount <span className="text-red-500">*</span></label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              required
            />
          </div>
        </div>

        {/* End Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => set("endDate", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      </div>

      {/* Recurring */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isRecurring}
            onChange={(e) => set("isRecurring", e.target.checked)}
            className="rounded"
          />
          <span className="text-sm font-medium text-gray-700">Recurring</span>
        </label>

        {form.isRecurring && (
          <div className="mt-3 ml-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <select
                  value={form.recurringFreq}
                  onChange={(e) => set("recurringFreq", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                >
                  {FREQ_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              {form.recurringFreq === "Monthly" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Day of Month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={form.recurringDay}
                    onChange={(e) => set("recurringDay", e.target.value)}
                    placeholder="1–31"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  />
                </div>
              )}
            </div>

            {/* Auto-increase */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.autoIncrease}
                onChange={(e) => set("autoIncrease", e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Auto-increase annually</span>
            </label>

            {form.autoIncrease && (
              <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Increase Rate %</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.increaseRate}
                    onChange={(e) => set("increaseRate", e.target.value)}
                    placeholder="e.g. 3.5"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Month of Increase</label>
                  <select
                    value={form.increaseMonth}
                    onChange={(e) => set("increaseMonth", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  >
                    <option value="">— select —</option>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Receipt Upload */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Receipt Image</label>
        {form.receiptUrl ? (
          <div className="flex items-center gap-2">
            <img src={form.receiptUrl} alt="receipt" className="w-12 h-12 object-cover rounded border" />
            <button
              type="button"
              onClick={() => set("receiptUrl", "")}
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-sm text-gray-600"
          />
        )}
        {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] resize-none"
        />
      </div>

      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="px-4 py-2 text-sm bg-[#1e3a8a] text-white rounded-lg hover:bg-[#003d99] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OverheadClient({ initialCosts }: { initialCosts: OverheadCost[] }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [costs, setCosts] = useState<OverheadCost[]>(initialCosts);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Fetch costs for selected month
  const fetchMonth = useCallback(async (m: number, y: number) => {
    setLoadingMonth(true);
    try {
      const res = await fetch(`/api/admin/overhead?month=${m}&year=${y}`);
      const data = await res.json() as { costs: OverheadCost[] };
      setCosts(data.costs);
    } finally {
      setLoadingMonth(false);
    }
  }, []);

  // Fetch summary
  const fetchSummary = useCallback(async (m: number, y: number) => {
    const res = await fetch(`/api/admin/overhead/summary?month=${m}&year=${y}`);
    const data = await res.json() as SummaryData;
    setSummary(data);
  }, []);

  useEffect(() => {
    fetchMonth(month, year);
    fetchSummary(month, year);
  }, [month, year, fetchMonth, fetchSummary]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  function formToPayload(form: FormState) {
    return {
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      effectiveDate: form.effectiveDate,
      endDate: form.endDate || undefined,
      isRecurring: form.isRecurring,
      recurringFreq: form.isRecurring ? form.recurringFreq : undefined,
      recurringDay: form.isRecurring && form.recurringFreq === "Monthly" && form.recurringDay
        ? parseInt(form.recurringDay, 10) : undefined,
      autoIncrease: form.isRecurring ? form.autoIncrease : false,
      increaseRate: form.isRecurring && form.autoIncrease && form.increaseRate
        ? parseFloat(form.increaseRate) : undefined,
      increaseMonth: form.isRecurring && form.autoIncrease && form.increaseMonth
        ? parseInt(form.increaseMonth, 10) : undefined,
      receiptUrl: form.receiptUrl || undefined,
      notes: form.notes || undefined,
    };
  }

  async function handleAdd(form: FormState) {
    const res = await fetch("/api/admin/overhead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    const data = await res.json() as { cost: OverheadCost };
    const newCost = data.cost;
    // Only add to visible list if it belongs in the current month view
    if (costInMonth(newCost, month, year)) {
      setCosts((prev) => [newCost, ...prev]);
    }
    setShowAddForm(false);
    fetchSummary(month, year);
  }

  async function handleEdit(id: string, form: FormState) {
    const res = await fetch(`/api/admin/overhead/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    const data = await res.json() as { cost: OverheadCost };
    const updated = data.cost;
    setCosts((prev) =>
      costInMonth(updated, month, year)
        ? prev.map((c) => (c.id === id ? updated : c))
        : prev.filter((c) => c.id !== id)
    );
    setEditingId(null);
    fetchSummary(month, year);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/overhead/${id}`, { method: "DELETE" });
    setCosts((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
    fetchSummary(month, year);
  }

  function costToForm(c: OverheadCost): FormState {
    return {
      category: c.category,
      description: c.description,
      amount: String(c.amount),
      effectiveDate: c.effectiveDate.slice(0, 10),
      endDate: c.endDate ? c.endDate.slice(0, 10) : "",
      isRecurring: c.isRecurring,
      recurringFreq: c.recurringFreq ?? "Monthly",
      recurringDay: c.recurringDay != null ? String(c.recurringDay) : "",
      autoIncrease: c.autoIncrease,
      increaseRate: c.increaseRate != null ? String(c.increaseRate) : "",
      increaseMonth: c.increaseMonth != null ? String(c.increaseMonth) : "",
      receiptUrl: c.receiptUrl ?? "",
      notes: c.notes ?? "",
    };
  }

  // Summary card values
  const monthTotal = summary?.monthTotal ?? costs.reduce((s, c) => s + c.amount, 0);
  const yearTotal = summary?.yearTotal ?? 0;
  const largestCategory = summary?.byCategory?.[0] ?? null;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a8a]">Overhead &amp; Fixed Costs</h1>
        <p className="text-sm text-gray-500 mt-1">Track recurring and one-time business overhead costs.</p>
      </div>

      <AdminNav />

      {/* Month selector + Add button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 min-w-[120px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <button
          onClick={() => { setShowAddForm((v) => !v); setEditingId(null); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Cost
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Total This Month</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{formatMoney(monthTotal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Total This Year</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{formatMoney(yearTotal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Largest Category</p>
          {largestCategory ? (
            <>
              <p className="text-sm font-bold text-gray-800">{largestCategory.category}</p>
              <p className="text-xs text-gray-500">{formatMoney(largestCategory.total)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="mb-5">
          <CostForm
            initial={emptyForm()}
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            submitLabel="Add Cost"
          />
        </div>
      )}

      {/* Cost list */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loadingMonth ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : costs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No overhead costs for {MONTH_NAMES[month - 1]} {year}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Recurring</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {costs.map((cost) => {
                  if (editingId === cost.id) {
                    return (
                      <tr key={cost.id}>
                        <td colSpan={7} className="px-4 py-4">
                          <CostForm
                            initial={costToForm(cost)}
                            onSubmit={(form) => handleEdit(cost.id, form)}
                            onCancel={() => setEditingId(null)}
                            submitLabel="Save Changes"
                          />
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={cost.id} className="hover:bg-gray-50 transition-colors">
                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[cost.category] ?? "bg-gray-100 text-gray-800"}`}>
                          {cost.category}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3 text-gray-800">{cost.description}</td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                        {formatMoney(cost.amount)}
                      </td>

                      {/* Recurring */}
                      <td className="px-4 py-3">
                        {cost.isRecurring ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-blue-600">
                              <RefreshCw className="w-3 h-3" />
                              <span className="text-xs font-medium">Recurring</span>
                            </div>
                            {cost.recurringFreq && (
                              <p className="text-xs text-gray-500">
                                {cost.recurringFreq}
                                {cost.recurringFreq === "Monthly" && cost.recurringDay != null
                                  ? ` · Day ${cost.recurringDay}` : ""}
                              </p>
                            )}
                            {cost.autoIncrease && cost.increaseRate != null && (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <TrendingUp className="w-3 h-3" />
                                <span className="text-xs">
                                  +{cost.increaseRate}%{cost.increaseMonth != null ? ` ${MONTH_NAMES[cost.increaseMonth - 1].slice(0, 3)}` : ""}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Receipt */}
                      <td className="px-4 py-3 text-center">
                        {cost.receiptUrl ? (
                          <a href={cost.receiptUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={cost.receiptUrl}
                              alt="receipt"
                              className="w-8 h-8 object-cover rounded border mx-auto hover:opacity-80 transition-opacity"
                            />
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px]">
                        {cost.notes
                          ? cost.notes.length > 40 ? cost.notes.slice(0, 40) + "…" : cost.notes
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {deletingId === cost.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600 font-medium">Delete?</span>
                              <button
                                onClick={() => handleDelete(cost.id)}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => { setEditingId(cost.id); setShowAddForm(false); }}
                                className="p-1.5 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingId(cost.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
