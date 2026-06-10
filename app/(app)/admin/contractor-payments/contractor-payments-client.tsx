"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Plus,
  Camera,
  ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ContractorPayment = {
  id: string;
  userId: string;
  amountUSD: number;
  amountLocal: number | null;
  localCurrency: string | null;
  exchangeRate: number | null;
  paymentDate: string;
  payPeriodStart: string | null;
  payPeriodEnd: string | null;
  method: string;
  notes: string | null;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
};

type User = { id: string; name: string; email: string };

interface ExtraContractor {
  id: string; // synthetic id
  name: string;
  linkedUserId?: string;
  defaultAmount: number;
  currency: string;
  schedule: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SAM_EMAIL = "sam@oakridgeelectrical.com";
const DEFAULT_USD = 560;
const METHODS = ["Wire", "Gusto", "Bank Transfer", "Cash"];
const SCHEDULES = ["Bi-weekly", "Weekly", "Monthly"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtUSD(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPHP(n: number): string {
  return "₱" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

function fmtNextDue(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
      <a href="/admin/contractor-payments" className="text-sm font-medium text-[#1e3a8a] border-b-2 border-[#1e3a8a] pb-1 -mb-5">
        Contractor Pay
      </a>
      <a href="/admin/settings" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        Settings
      </a>
      <a href="/admin/pl" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
        P&amp;L
      </a>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: "success" | "error"; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      {message}
    </div>
  );
}

// ── Payment Form ───────────────────────────────────────────────────────────────

interface PaymentFormProps {
  users: User[];
  extraContractors: ExtraContractor[];
  defaultUserId: string;
  exchangeRate: number;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  initial?: Partial<PaymentFormData>;
  submitLabel?: string;
  onCancel?: () => void;
}

interface PaymentFormData {
  userId: string;
  amountUSD: string;
  exchangeRate: string;
  paymentDate: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  method: string;
  notes: string;
  receiptUrl: string;
}

function emptyForm(defaultUserId: string, rate: number): PaymentFormData {
  return {
    userId: defaultUserId,
    amountUSD: String(DEFAULT_USD),
    exchangeRate: rate.toFixed(4),
    paymentDate: todayIso(),
    payPeriodStart: "",
    payPeriodEnd: "",
    method: "Wire",
    notes: "",
    receiptUrl: "",
  };
}

function PaymentForm({
  users,
  extraContractors,
  defaultUserId,
  exchangeRate,
  onSubmit,
  initial,
  submitLabel = "Log Payment",
  onCancel,
}: PaymentFormProps) {
  const [form, setForm] = useState<PaymentFormData>(() => ({
    ...emptyForm(defaultUserId, exchangeRate),
    ...(initial ?? {}),
  }));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PaymentFormData>(k: K, v: PaymentFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const amountUSD = parseFloat(form.amountUSD) || 0;
  const rate = parseFloat(form.exchangeRate) || 0;
  const amountPHP = amountUSD * rate;

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

  // Build contractor options: db users + extra contractors
  const allContractors: { id: string; label: string }[] = [
    ...users.map((u) => ({ id: u.id, label: `${u.name} (${u.email})` })),
    ...extraContractors
      .filter((ec) => !ec.linkedUserId)
      .map((ec) => ({ id: `extra:${ec.id}`, label: `${ec.name} (custom)` })),
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contractor */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Contractor <span className="text-red-500">*</span>
          </label>
          <select
            value={form.userId}
            onChange={(e) => set("userId", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            required
          >
            {allContractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* Amount USD */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Amount USD <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amountUSD}
              onChange={(e) => set("amountUSD", e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              required
            />
          </div>
        </div>

        {/* Exchange Rate */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Exchange Rate (USD→PHP)</label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={form.exchangeRate}
            onChange={(e) => set("exchangeRate", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>

        {/* PHP Amount (read-only) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Amount PHP (calculated)</label>
          <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700 font-medium">
            {fmtPHP(amountPHP)}
          </div>
        </div>

        {/* Payment Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Payment Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.paymentDate}
            onChange={(e) => set("paymentDate", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            required
          />
        </div>

        {/* Pay Period Start */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pay Period Start</label>
          <input
            type="date"
            value={form.payPeriodStart}
            onChange={(e) => set("payPeriodStart", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>

        {/* Pay Period End */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pay Period End</label>
          <input
            type="date"
            value={form.payPeriodEnd}
            onChange={(e) => set("payPeriodEnd", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>

        {/* Method */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
          <select
            value={form.method}
            onChange={(e) => set("method", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Optional"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>

        {/* Receipt Upload */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Receipt</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer hover:bg-gray-50 transition-colors">
              <Camera size={14} className="text-gray-500" />
              <span className="text-gray-600">{uploading ? "Uploading…" : "Capture / Upload"}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
            {form.receiptUrl && (
              <a
                href={form.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                <ExternalLink size={12} />
                View receipt
              </a>
            )}
            {form.receiptUrl && (
              <button
                type="button"
                onClick={() => set("receiptUrl", "")}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving || uploading}
          className="px-5 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a8a]/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────────

interface Props {
  users: User[];
  initialPayments: ContractorPayment[];
  currentYear: number;
}

export default function ContractorPaymentsClient({ users, initialPayments, currentYear }: Props) {
  const [year, setYear] = useState(currentYear);
  const [payments, setPayments] = useState<ContractorPayment[]>(initialPayments);
  const [loading, setLoading] = useState(false);

  // Exchange rate
  const [rateData, setRateData] = useState<{
    rate: number;
    updatedAt: string | null;
    source: string;
    error?: string;
  } | null>(null);
  const [rateLoading, setRateLoading] = useState(true);

  // UI state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [showAddContractor, setShowAddContractor] = useState(false);
  const [extraContractors, setExtraContractors] = useState<ExtraContractor[]>([]);

  // Add contractor form
  const [addContractorForm, setAddContractorForm] = useState({
    name: "",
    linkedUserId: "",
    defaultAmount: "560",
    currency: "PHP",
    schedule: "Bi-weekly",
  });

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
  }

  // Fetch exchange rate on mount
  useEffect(() => {
    setRateLoading(true);
    fetch("/api/admin/exchange-rate")
      .then((r) => r.json() as Promise<{ rate: number; updatedAt: string | null; source: string; error?: string }>)
      .then((d) => setRateData(d))
      .catch(() =>
        setRateData({ rate: 56.5, updatedAt: null, source: "fallback", error: "Network error" })
      )
      .finally(() => setRateLoading(false));
  }, []);

  const liveRate = rateData?.rate ?? 56.5;

  // Fetch payments when year changes
  const fetchPayments = useCallback(async (yr: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contractor-payments?year=${yr}`);
      const data = await res.json() as { payments: ContractorPayment[] };
      setPayments(data.payments ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (year !== currentYear) {
      fetchPayments(year);
    }
  }, [year, currentYear, fetchPayments]);

  // Sam's user object
  const samUser = users.find((u) => u.email === SAM_EMAIL);
  const defaultContractorId = samUser?.id ?? (users[0]?.id ?? "");

  // Summary calculations
  const totalUSD = payments.reduce((s, p) => s + p.amountUSD, 0);
  const totalPHP = payments.reduce((s, p) => s + (p.amountLocal ?? 0), 0);
  const activeContractors = new Set(payments.map((p) => p.userId)).size;

  const mostRecent = payments[0];
  const nextDue = mostRecent ? addDays(mostRecent.paymentDate, 14) : null;

  // Handle POST new payment
  async function handleLogPayment(form: PaymentFormData) {
    const amountUSD = parseFloat(form.amountUSD);
    const rate = parseFloat(form.exchangeRate) || liveRate;
    const amountPHP = amountUSD * rate;

    // If extra contractor, use linked userId or skip (just show toast)
    let userId = form.userId;
    if (userId.startsWith("extra:")) {
      const ec = extraContractors.find((e) => `extra:${e.id}` === userId);
      if (ec?.linkedUserId) {
        userId = ec.linkedUserId;
      } else {
        showToast("Custom contractors without a linked user cannot be saved yet.", "error");
        return;
      }
    }

    const res = await fetch("/api/admin/contractor-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        amountUSD,
        amountLocal: amountPHP,
        localCurrency: "PHP",
        exchangeRate: rate,
        paymentDate: form.paymentDate,
        payPeriodStart: form.payPeriodStart || undefined,
        payPeriodEnd: form.payPeriodEnd || undefined,
        method: form.method,
        notes: form.notes || undefined,
        receiptUrl: form.receiptUrl || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      showToast(err.error ?? "Failed to log payment", "error");
      return;
    }

    const data = await res.json() as { payment: ContractorPayment };
    if (year === currentYear) {
      setPayments((prev) => [data.payment, ...prev]);
    }
    showToast("Payment logged successfully");
  }

  // Handle PUT (edit)
  async function handleEdit(id: string, form: PaymentFormData) {
    const amountUSD = parseFloat(form.amountUSD);
    const rate = parseFloat(form.exchangeRate) || liveRate;
    const amountPHP = amountUSD * rate;

    const res = await fetch(`/api/admin/contractor-payments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountUSD,
        amountLocal: amountPHP,
        localCurrency: "PHP",
        exchangeRate: rate,
        paymentDate: form.paymentDate,
        payPeriodStart: form.payPeriodStart || null,
        payPeriodEnd: form.payPeriodEnd || null,
        method: form.method,
        notes: form.notes || null,
        receiptUrl: form.receiptUrl || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json() as { error?: string };
      showToast(err.error ?? "Failed to update payment", "error");
      return;
    }

    const data = await res.json() as { payment: ContractorPayment };
    setPayments((prev) => prev.map((p) => (p.id === id ? data.payment : p)));
    setEditingId(null);
    showToast("Payment updated");
  }

  // Handle DELETE
  async function handleDelete(id: string) {
    if (!confirm("Delete this payment? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/contractor-payments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Failed to delete payment", "error");
      return;
    }
    setPayments((prev) => prev.filter((p) => p.id !== id));
    showToast("Payment deleted");
  }

  // Handle add extra contractor
  function handleAddContractor() {
    if (!addContractorForm.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    const ec: ExtraContractor = {
      id: Date.now().toString(),
      name: addContractorForm.name.trim(),
      linkedUserId: addContractorForm.linkedUserId || undefined,
      defaultAmount: parseFloat(addContractorForm.defaultAmount) || 0,
      currency: addContractorForm.currency,
      schedule: addContractorForm.schedule,
    };
    setExtraContractors((prev) => [...prev, ec]);
    setShowAddContractor(false);
    setAddContractorForm({ name: "", linkedUserId: "", defaultAmount: "560", currency: "PHP", schedule: "Bi-weekly" });
    showToast("Contractor added to payment form");
  }

  // Table rows
  const SHOW_N = 5;
  const visiblePayments = showAll ? payments : payments.slice(0, SHOW_N);
  const hiddenCount = payments.length - SHOW_N;

  return (
    <div>
      <AdminNav />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a8a]">Contractor Payments</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear((y) => y - 1)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-700 w-12 text-center">{year}</span>
          <button
            onClick={() => setYear((y) => y + 1)}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Exchange Rate Widget */}
      <div className={`mb-6 px-4 py-3 rounded-xl border text-sm flex items-center gap-3 ${
        rateData?.error ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"
      }`}>
        <span className="text-lg">💱</span>
        {rateLoading ? (
          <span className="flex items-center gap-2 text-gray-500">
            <RefreshCw size={13} className="animate-spin" /> Loading exchange rate…
          </span>
        ) : rateData ? (
          <span className={rateData.error ? "text-amber-700" : "text-blue-800"}>
            <strong>1 USD = {rateData.rate.toFixed(4)} PHP</strong>
            {rateData.updatedAt ? (
              <span className="ml-2 text-xs text-blue-600">— Updated {new Date(rateData.updatedAt).toLocaleString()}</span>
            ) : (
              <span className="ml-2 text-xs text-amber-600"> — Rate may be outdated</span>
            )}
          </span>
        ) : null}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Paid YTD</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{fmtUSD(totalUSD)}</p>
          {totalPHP > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{fmtPHP(totalPHP)} PHP</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active Contractors</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{activeContractors}</p>
          <p className="text-xs text-gray-400 mt-0.5">with payments this year</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Next Payment Due</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">
            {nextDue ? fmtNextDue(nextDue) : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">bi-weekly from last payment</p>
        </div>
      </div>

      {/* Sam's Payment Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {samUser ? `${samUser.name}'s Payments` : "Contractor Payments"}
          </h2>
          <button
            onClick={() => setShowAddContractor((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            <Plus size={13} />
            Add Contractor
          </button>
        </div>

        {/* Add Contractor form */}
        {showAddContractor && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">New Contractor</p>
              <button onClick={() => setShowAddContractor(false)}>
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                <input
                  type="text"
                  value={addContractorForm.name}
                  onChange={(e) => setAddContractorForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Link to User</label>
                <select
                  value={addContractorForm.linkedUserId}
                  onChange={(e) => setAddContractorForm((f) => ({ ...f, linkedUserId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                >
                  <option value="">— None —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default Amount</label>
                <input
                  type="number"
                  value={addContractorForm.defaultAmount}
                  onChange={(e) => setAddContractorForm((f) => ({ ...f, defaultAmount: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                <input
                  type="text"
                  value={addContractorForm.currency}
                  onChange={(e) => setAddContractorForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pay Schedule</label>
                <select
                  value={addContractorForm.schedule}
                  onChange={(e) => setAddContractorForm((f) => ({ ...f, schedule: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                >
                  {SCHEDULES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleAddContractor}
              className="px-4 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#1e3a8a]/90 transition-colors"
            >
              Save Contractor
            </button>
          </div>
        )}

        {/* Payment Entry Form */}
        <PaymentForm
          users={users}
          extraContractors={extraContractors}
          defaultUserId={defaultContractorId}
          exchangeRate={liveRate}
          onSubmit={handleLogPayment}
          submitLabel="Log Payment"
        />
      </div>

      {/* Next Payment Indicator */}
      {nextDue && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-800 flex items-center gap-2">
          <span>📅</span>
          <span>
            Next expected payment: <strong>{fmtNextDue(nextDue)}</strong> (bi-weekly from last payment on{" "}
            {mostRecent ? fmtDate(mostRecent.paymentDate) : "—"})
          </span>
        </div>
      )}

      {/* Payment History Table */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Payment History — {year}</h2>

        {loading ? (
          <div className="text-sm text-gray-400 py-8 text-center">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center bg-white border border-gray-200 rounded-xl">
            No payments logged for {year}.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contractor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">USD</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PHP</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rate</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pay Period</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {visiblePayments.map((p) => (
                    editingId === p.id ? (
                      <tr key={p.id}>
                        <td colSpan={10} className="px-4 py-4 bg-blue-50">
                          <PaymentForm
                            users={users}
                            extraContractors={extraContractors}
                            defaultUserId={p.userId}
                            exchangeRate={p.exchangeRate ?? liveRate}
                            initial={{
                              userId: p.userId,
                              amountUSD: String(p.amountUSD),
                              exchangeRate: p.exchangeRate ? p.exchangeRate.toFixed(4) : liveRate.toFixed(4),
                              paymentDate: p.paymentDate.slice(0, 10),
                              payPeriodStart: p.payPeriodStart ? p.payPeriodStart.slice(0, 10) : "",
                              payPeriodEnd: p.payPeriodEnd ? p.payPeriodEnd.slice(0, 10) : "",
                              method: p.method,
                              notes: p.notes ?? "",
                              receiptUrl: p.receiptUrl ?? "",
                            }}
                            onSubmit={(form) => handleEdit(p.id, form)}
                            submitLabel="Save Changes"
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : (
                      <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(p.paymentDate)}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{p.user.name}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">{fmtUSD(p.amountUSD)}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800 whitespace-nowrap">
                          {p.amountLocal !== null ? fmtPHP(p.amountLocal) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">
                          {p.exchangeRate ? p.exchangeRate.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {p.payPeriodStart && p.payPeriodEnd
                            ? `${fmtShortDate(p.payPeriodStart)} – ${fmtShortDate(p.payPeriodEnd)}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.method}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{p.notes ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          {p.receiptUrl ? (
                            <a
                              href={p.receiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <ExternalLink size={14} />
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setEditingId(p.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-[#1e3a8a] transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            {/* Show more toggle */}
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-3 text-sm text-[#1e3a8a] hover:underline"
              >
                Show {hiddenCount} more payment{hiddenCount !== 1 ? "s" : ""}
              </button>
            )}
            {showAll && payments.length > SHOW_N && (
              <button
                onClick={() => setShowAll(false)}
                className="mt-3 text-sm text-[#1e3a8a] hover:underline"
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>

      {/* Running Totals */}
      {payments.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-700">
          <span className="font-semibold">YTD {year}: </span>
          <span className="font-bold text-[#1e3a8a]">{fmtUSD(totalUSD)} USD</span>
          {totalPHP > 0 && (
            <span className="text-gray-500"> ({fmtPHP(totalPHP)} PHP)</span>
          )}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
