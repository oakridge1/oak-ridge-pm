"use client";

import { useState, useCallback, Fragment } from "react";
import {
  Flag,
  FlagOff,
  CheckCircle,
  Circle,
  Edit2,
  Trash2,
  X,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReceiptRow = {
  id: string;
  type: string;
  vendor: string | null;
  amount: number | null;
  receiptDate: string | null;
  description: string | null;
  imageUrl: string | null;
  jobId: string | null;
  job: { jobNumber: string; jobName: string } | null;
  uploadedBy: { name: string | null } | null;
  vehicleId: string | null;
  vehicle: { tag: string } | null;
  mileage: number | null;
  isFuel: boolean;
  flagged: boolean;
  flagReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  category: string | null;
  createdAt: string;
};

type Props = {
  initialReceipts: ReceiptRow[];
  jobs: { id: string; jobNumber: string; jobName: string }[];
  users: { id: string; name: string | null }[];
  vehicles: { id: string; tag: string }[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const TYPE_LABELS: Record<string, string> = {
  job: "Job",
  business: "Business",
  fuel: "Fuel",
};

// ── Stats Bar ─────────────────────────────────────────────────────────────────

function StatsBar({ receipts }: { receipts: ReceiptRow[] }) {
  const totalAmount = receipts.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const flaggedCount = receipts.filter((r) => r.flagged).length;
  const unreviewedCount = receipts.filter((r) => !r.reviewedAt).length;

  const stats = [
    { label: "Total Receipts", value: receipts.length.toString() },
    { label: "Total Amount", value: formatAmount(totalAmount) },
    { label: "Flagged", value: flaggedCount.toString(), highlight: flaggedCount > 0 },
    { label: "Unreviewed", value: unreviewedCount.toString(), highlight: unreviewedCount > 0 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3"
        >
          <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
          <p
            className={`text-lg font-bold ${
              s.highlight ? "text-red-600" : "text-[#002D72]"
            }`}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Filter Bar ────────────────────────────────────────────────────────────────

type Filters = {
  type: string;
  flagged: boolean;
  dateFrom: string;
  dateTo: string;
  jobId: string;
  uploadedById: string;
};

function FilterBar({
  jobs,
  users,
  filters,
  setFilters,
  onApply,
  loading,
}: {
  jobs: Props["jobs"];
  users: Props["users"];
  filters: Filters;
  setFilters: (f: Filters) => void;
  onApply: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Type tabs */}
        <div className="flex gap-1 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "job", label: "Job" },
            { value: "business", label: "Business" },
            { value: "fuel", label: "Fuel" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setFilters({ ...filters, type: t.value })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filters.type === t.value
                  ? "bg-[#002D72] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Flagged toggle */}
          <button
            onClick={() => setFilters({ ...filters, flagged: !filters.flagged })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filters.flagged
                ? "bg-red-100 text-red-700 border border-red-300"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            Flagged only
          </button>

          {/* More filters toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>

          {/* Apply */}
          <button
            onClick={onApply}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-[#FF5910] text-white hover:bg-orange-600 transition-colors disabled:opacity-60"
          >
            <Search className="w-3.5 h-3.5" />
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      {/* Expanded filters */}
      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date from</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date to</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Job</label>
            <select
              value={filters.jobId}
              onChange={(e) => setFilters({ ...filters, jobId: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            >
              <option value="">All jobs</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.jobName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Uploaded by</label>
            <select
              value={filters.uploadedById}
              onChange={(e) => setFilters({ ...filters, uploadedById: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            >
              <option value="">Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline Edit Form ───────────────────────────────────────────────────────────

function InlineEditForm({
  receipt,
  vehicles,
  jobs,
  onSave,
  onCancel,
}: {
  receipt: ReceiptRow;
  vehicles: Props["vehicles"];
  jobs: Props["jobs"];
  onSave: (data: Partial<ReceiptRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor: receipt.vendor ?? "",
    amount: receipt.amount?.toString() ?? "",
    receiptDate: receipt.receiptDate ? receipt.receiptDate.substring(0, 10) : "",
    description: receipt.description ?? "",
    notes: receipt.notes ?? "",
    type: receipt.type,
    category: receipt.category ?? "",
    vehicleId: receipt.vehicleId ?? "",
    mileage: receipt.mileage?.toString() ?? "",
  });

  const set = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        vendor: form.vendor || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        receiptDate: form.receiptDate ? new Date(form.receiptDate).toISOString() : null,
        description: form.description || null,
        notes: form.notes || null,
        type: form.type,
        category: form.category || null,
        vehicleId: form.vehicleId || null,
        mileage: form.mileage ? parseInt(form.mileage, 10) : null,
        isFuel: form.type === "fuel",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="bg-blue-50">
      <td colSpan={11} className="px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Vendor</label>
            <input
              type="text"
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              placeholder="Vendor name"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={form.receiptDate}
              onChange={(e) => set("receiptDate", e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            >
              <option value="job">Job</option>
              <option value="business">Business</option>
              <option value="fuel">Fuel</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              placeholder="e.g. Materials, Tools"
            />
          </div>
          {form.type === "fuel" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vehicle</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => set("vehicleId", e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                >
                  <option value="">No vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.tag}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Mileage</label>
                <input
                  type="number"
                  value={form.mileage}
                  onChange={(e) => set("mileage", e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                  placeholder="Miles"
                />
              </div>
            </>
          )}
          <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
              placeholder="Optional description"
            />
          </div>
          <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
              placeholder="Admin notes"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#002D72] text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Image Lightbox ─────────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <img
          src={url}
          alt="Receipt"
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ReceiptManagerClient({ initialReceipts, jobs, users, vehicles }: Props) {
  const [receipts, setReceipts] = useState<ReceiptRow[]>(initialReceipts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    type: "all",
    flagged: false,
    dateFrom: "",
    dateTo: "",
    jobId: "",
    uploadedById: "",
  });

  // ── Fetch with filters ──

  const applyFilters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.flagged) params.set("flagged", "true");
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.jobId) params.set("jobId", filters.jobId);
      if (filters.uploadedById) params.set("uploadedById", filters.uploadedById);

      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch receipts");
      const data: ReceiptRow[] = await res.json();
      setReceipts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ── PUT update ──

  const updateReceipt = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/receipts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update receipt");
    const updated: ReceiptRow = await res.json();
    setReceipts((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    return updated;
  }, []);

  // ── Toggle flag ──

  const toggleFlag = useCallback(
    async (receipt: ReceiptRow) => {
      try {
        await updateReceipt(receipt.id, {
          flagged: !receipt.flagged,
          flagReason: receipt.flagged ? null : "Flagged for review",
        });
      } catch {
        setError("Failed to update flag");
      }
    },
    [updateReceipt]
  );

  // ── Toggle reviewed ──

  const toggleReviewed = useCallback(
    async (receipt: ReceiptRow) => {
      try {
        await updateReceipt(receipt.id, {
          reviewedAt: receipt.reviewedAt ? null : new Date().toISOString(),
          reviewedBy: receipt.reviewedAt ? null : "admin",
        });
      } catch {
        setError("Failed to update reviewed status");
      }
    },
    [updateReceipt]
  );

  // ── Move to job ──

  const moveToJob = useCallback(
    async (receiptId: string, jobId: string) => {
      try {
        const res = await fetch(`/api/receipts/${receiptId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
        if (!res.ok) throw new Error("Failed to move receipt");
        const updated: ReceiptRow = await res.json();
        setReceipts((prev) => prev.map((r) => (r.id === receiptId ? { ...r, ...updated } : r)));
      } catch {
        setError("Failed to reassign receipt to job");
      }
    },
    []
  );

  // ── Delete ──

  const deleteReceipt = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setReceipts((prev) => prev.filter((r) => r.id !== id));
      setConfirmDelete(null);
    } catch {
      setError("Failed to delete receipt");
    }
  }, []);

  // ── Inline save ──

  const handleInlineSave = useCallback(
    async (id: string, data: Partial<ReceiptRow>) => {
      await updateReceipt(id, data as Record<string, unknown>);
      setEditingId(null);
    },
    [updateReceipt]
  );

  return (
    <>
      {lightboxUrl && (
        <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      <StatsBar receipts={receipts} />

      <FilterBar
        jobs={jobs}
        users={users}
        filters={filters}
        setFilters={setFilters}
        onApply={applyFilters}
        loading={loading}
      />

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Desktop table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#002D72] text-white text-left">
              <tr>
                <th className="px-3 py-3 font-medium w-14">Image</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Vendor</th>
                <th className="px-3 py-3 font-medium">Amount</th>
                <th className="px-3 py-3 font-medium">Job</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Uploaded By</th>
                <th className="px-3 py-3 font-medium">Vehicle</th>
                <th className="px-3 py-3 font-medium">Reviewed</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {receipts.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-gray-400 text-sm"
                  >
                    No receipts found. Try adjusting your filters.
                  </td>
                </tr>
              )}
              {receipts.map((receipt) => (
                <Fragment key={receipt.id}>
                  <tr
                    className={`transition-colors hover:bg-gray-50 ${
                      receipt.flagged ? "bg-red-50" : ""
                    } ${loading ? "opacity-60" : ""}`}
                  >
                    {/* Thumbnail */}
                    <td className="px-3 py-2">
                      {receipt.imageUrl ? (
                        <button
                          onClick={() => setLightboxUrl(receipt.imageUrl!)}
                          className="block w-12 h-12 rounded-lg overflow-hidden border border-gray-200 hover:border-[#FF5910] transition-colors flex-shrink-0"
                        >
                          <img
                            src={receipt.imageUrl}
                            alt="Receipt"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs">
                          No img
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                      {formatDate(receipt.receiptDate)}
                    </td>

                    {/* Vendor */}
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate">
                      {receipt.vendor ?? <span className="text-gray-400">—</span>}
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">
                      {formatAmount(receipt.amount)}
                    </td>

                    {/* Job — editable */}
                    <td className="px-3 py-2">
                      <select
                        value={receipt.jobId ?? ""}
                        onChange={(e) => {
                          if (e.target.value) moveToJob(receipt.id, e.target.value);
                        }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72] max-w-[160px]"
                      >
                        <option value="">No job</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.jobNumber} — {j.jobName}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Type — editable inline */}
                    <td className="px-3 py-2">
                      <select
                        value={receipt.type}
                        onChange={(e) =>
                          updateReceipt(receipt.id, {
                            type: e.target.value,
                            isFuel: e.target.value === "fuel",
                          }).catch(() => setError("Failed to update type"))
                        }
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                      >
                        <option value="job">Job</option>
                        <option value="business">Business</option>
                        <option value="fuel">Fuel</option>
                      </select>
                    </td>

                    {/* Category — editable inline */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        defaultValue={receipt.category ?? ""}
                        onBlur={(e) => {
                          const val = e.target.value.trim();
                          if (val !== (receipt.category ?? "")) {
                            updateReceipt(receipt.id, { category: val || null }).catch(() =>
                              setError("Failed to update category")
                            );
                          }
                        }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72] w-24"
                        placeholder="—"
                      />
                    </td>

                    {/* Uploaded by */}
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">
                      {receipt.uploadedBy?.name ?? "—"}
                    </td>

                    {/* Vehicle */}
                    <td className="px-3 py-2 text-xs">
                      {receipt.type === "fuel" ? (
                        receipt.vehicle?.tag ?? (
                          <span className="text-gray-400">None</span>
                        )
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>

                    {/* Reviewed */}
                    <td className="px-3 py-2">
                      <button
                        onClick={() => toggleReviewed(receipt)}
                        title={
                          receipt.reviewedAt
                            ? `Reviewed ${formatDate(receipt.reviewedAt)}`
                            : "Mark as reviewed"
                        }
                        className="transition-colors"
                      >
                        {receipt.reviewedAt ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 hover:text-green-400" />
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        {/* Flag */}
                        <button
                          onClick={() => toggleFlag(receipt)}
                          title={receipt.flagged ? "Unflag" : "Flag for review"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            receipt.flagged
                              ? "text-red-600 bg-red-100 hover:bg-red-200"
                              : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                          }`}
                        >
                          {receipt.flagged ? (
                            <FlagOff className="w-3.5 h-3.5" />
                          ) : (
                            <Flag className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() =>
                            setEditingId(editingId === receipt.id ? null : receipt.id)
                          }
                          title="Edit receipt"
                          className={`p-1.5 rounded-lg transition-colors ${
                            editingId === receipt.id
                              ? "bg-[#002D72] text-white"
                              : "text-gray-400 hover:bg-blue-50 hover:text-[#002D72]"
                          }`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirmDelete === receipt.id) {
                              deleteReceipt(receipt.id);
                            } else {
                              setConfirmDelete(receipt.id);
                            }
                          }}
                          title={
                            confirmDelete === receipt.id
                              ? "Click again to confirm delete"
                              : "Delete receipt"
                          }
                          className={`p-1.5 rounded-lg text-xs transition-colors ${
                            confirmDelete === receipt.id
                              ? "bg-red-600 text-white px-2"
                              : "text-gray-400 hover:bg-red-50 hover:text-red-500"
                          }`}
                        >
                          {confirmDelete === receipt.id ? (
                            "Confirm?"
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {editingId === receipt.id && (
                    <InlineEditForm
                      receipt={receipt}
                      vehicles={vehicles}
                      jobs={jobs}
                      onSave={(data) => handleInlineSave(receipt.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {receipts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-12 text-center text-gray-400 text-sm">
            No receipts found. Try adjusting your filters.
          </div>
        )}
        {receipts.map((receipt) => (
          <div
            key={receipt.id}
            className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
              receipt.flagged ? "border-red-300" : "border-gray-200"
            }`}
          >
            <div className="p-4">
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                {receipt.imageUrl ? (
                  <button
                    onClick={() => setLightboxUrl(receipt.imageUrl!)}
                    className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-gray-200"
                  >
                    <img
                      src={receipt.imageUrl}
                      alt="Receipt"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex-shrink-0 w-14 h-14 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs">
                    No img
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm truncate">
                      {receipt.vendor ?? "No vendor"}
                    </span>
                    {receipt.flagged && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <Flag className="w-3 h-3" />
                        Flagged
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <div>{formatDate(receipt.receiptDate)}</div>
                    <div className="font-semibold text-gray-700">
                      {formatAmount(receipt.amount)}
                    </div>
                    {receipt.job && (
                      <div>
                        {receipt.job.jobNumber} — {receipt.job.jobName}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                        {TYPE_LABELS[receipt.type] ?? receipt.type}
                      </span>
                      {receipt.category && (
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                          {receipt.category}
                        </span>
                      )}
                    </div>
                    <div>{receipt.uploadedBy?.name ?? "—"}</div>
                  </div>
                </div>
              </div>

              {/* Mobile actions */}
              <div className="mt-3 flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
                <button
                  onClick={() => toggleReviewed(receipt)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    receipt.reviewedAt
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-600"
                  }`}
                >
                  {receipt.reviewedAt ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Circle className="w-3.5 h-3.5" />
                  )}
                  {receipt.reviewedAt ? "Reviewed" : "Mark reviewed"}
                </button>

                <button
                  onClick={() => toggleFlag(receipt)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    receipt.flagged
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500"
                  }`}
                >
                  {receipt.flagged ? (
                    <FlagOff className="w-3.5 h-3.5" />
                  ) : (
                    <Flag className="w-3.5 h-3.5" />
                  )}
                  {receipt.flagged ? "Unflag" : "Flag"}
                </button>

                <button
                  onClick={() => setEditingId(editingId === receipt.id ? null : receipt.id)}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    editingId === receipt.id
                      ? "bg-[#002D72] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-[#002D72]"
                  }`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit
                </button>

                <button
                  onClick={() => {
                    if (confirmDelete === receipt.id) {
                      deleteReceipt(receipt.id);
                    } else {
                      setConfirmDelete(receipt.id);
                    }
                  }}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    confirmDelete === receipt.id
                      ? "bg-red-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-500"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmDelete === receipt.id ? "Confirm?" : "Delete"}
                </button>
              </div>

              {/* Mobile inline edit */}
              {editingId === receipt.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <MobileEditForm
                    receipt={receipt}
                    vehicles={vehicles}
                    onSave={(data) => handleInlineSave(receipt.id, data)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Mobile Edit Form ───────────────────────────────────────────────────────────

function MobileEditForm({
  receipt,
  vehicles,
  onSave,
  onCancel,
}: {
  receipt: ReceiptRow;
  vehicles: Props["vehicles"];
  onSave: (data: Partial<ReceiptRow>) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    vendor: receipt.vendor ?? "",
    amount: receipt.amount?.toString() ?? "",
    receiptDate: receipt.receiptDate ? receipt.receiptDate.substring(0, 10) : "",
    description: receipt.description ?? "",
    notes: receipt.notes ?? "",
    type: receipt.type,
    category: receipt.category ?? "",
    vehicleId: receipt.vehicleId ?? "",
    mileage: receipt.mileage?.toString() ?? "",
  });

  const set = (key: keyof typeof form, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        vendor: form.vendor || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        receiptDate: form.receiptDate ? new Date(form.receiptDate).toISOString() : null,
        description: form.description || null,
        notes: form.notes || null,
        type: form.type,
        category: form.category || null,
        vehicleId: form.vehicleId || null,
        mileage: form.mileage ? parseInt(form.mileage, 10) : null,
        isFuel: form.type === "fuel",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Vendor</label>
          <input
            type="text"
            value={form.vendor}
            onChange={(e) => set("vendor", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Date</label>
          <input
            type="date"
            value={form.receiptDate}
            onChange={(e) => set("receiptDate", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          >
            <option value="job">Job</option>
            <option value="business">Business</option>
            <option value="fuel">Fuel</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Category</label>
          <input
            type="text"
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            placeholder="e.g. Materials, Tools"
          />
        </div>
        {form.type === "fuel" && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Vehicle</label>
              <select
                value={form.vehicleId}
                onChange={(e) => set("vehicleId", e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              >
                <option value="">No vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.tag}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Mileage</label>
              <input
                type="number"
                value={form.mileage}
                onChange={(e) => set("mileage", e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[#002D72] text-white rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
}
