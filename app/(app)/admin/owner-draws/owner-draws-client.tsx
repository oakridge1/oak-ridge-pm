"use client";

import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Pencil, Trash2, X, Check } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Owner = { id: string; name: string; email: string };
type Draw = {
  id: string;
  userId: string;
  amount: number;
  drawDate: string;
  method: string;
  notes: string | null;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
};

type EditForm = {
  amount: string;
  drawDate: string;
  method: string;
  notes: string;
  receiptUrl: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const METHODS = ["ATM", "Check", "Transfer", "Cash"];

const DEFAULT_METHOD: Record<string, string> = {
  "justin@oakridgeelectrical.com": "ATM",
  "beth@oakridgeelectrical.com": "Cash",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMoney(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
      <a href="/admin/owner-draws" className="text-sm font-medium text-[#1e3a8a] border-b-2 border-[#1e3a8a] pb-1 -mb-5">
        Owner Draws
      </a>
      <a href="/admin/contractor-payments" className="text-sm font-medium text-gray-500 hover:text-[#1e3a8a] transition-colors">
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

// ── Add Draw Form ─────────────────────────────────────────────────────────────

function AddDrawForm({
  owner,
  onAdded,
}: {
  owner: Owner;
  onAdded: (draw: Draw) => void;
}) {
  const defaultMethod = DEFAULT_METHOD[owner.email] ?? "ATM";
  const [amount, setAmount] = useState("");
  const [drawDate, setDrawDate] = useState(todayIso());
  const [method, setMethod] = useState(defaultMethod);
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      if (data.url) setReceiptUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/owner-draws", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: owner.id,
          amount: parsed,
          drawDate,
          method,
          notes: notes || undefined,
          receiptUrl: receiptUrl || undefined,
        }),
      });
      const data = await res.json() as { draw: Draw };
      onAdded(data.draw);
      // Reset form (keep method and date as-is for rapid entry)
      setAmount("");
      setNotes("");
      setReceiptUrl("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Log Draw</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={drawDate}
            onChange={(e) => setDrawDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>

        {/* Method */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      </div>

      {/* Receipt */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Receipt</label>
        {receiptUrl ? (
          <div className="flex items-center gap-2">
            <img src={receiptUrl} alt="receipt" className="w-10 h-10 object-cover rounded border" />
            <button
              type="button"
              onClick={() => setReceiptUrl("")}
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
        {uploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving || uploading}
          className="px-5 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] transition-colors disabled:opacity-50"
        >
          {saving ? "Logging..." : "Log Draw"}
        </button>
      </div>
    </form>
  );
}

// ── Inline Edit Row ───────────────────────────────────────────────────────────

function EditRow({
  draw,
  onSave,
  onCancel,
}: {
  draw: Draw;
  onSave: (id: string, form: EditForm) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    amount: String(draw.amount),
    drawDate: draw.drawDate.slice(0, 10),
    method: draw.method,
    notes: draw.notes ?? "",
    receiptUrl: draw.receiptUrl ?? "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof EditForm>(k: K, v: EditForm[K]) {
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

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(draw.id, form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-blue-50">
      {/* Date */}
      <td className="px-3 py-2">
        <input
          type="date"
          value={form.drawDate}
          onChange={(e) => set("drawDate", e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] w-36"
        />
      </td>
      {/* Amount */}
      <td className="px-3 py-2">
        <div className="relative w-28">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className="border border-gray-300 rounded pl-6 pr-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] w-full"
          />
        </div>
      </td>
      {/* Method */}
      <td className="px-3 py-2">
        <select
          value={form.method}
          onChange={(e) => set("method", e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </td>
      {/* Notes */}
      <td className="px-3 py-2">
        <input
          type="text"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Notes"
          className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] w-36"
        />
      </td>
      {/* Receipt */}
      <td className="px-3 py-2">
        {form.receiptUrl ? (
          <div className="flex items-center gap-1">
            <img src={form.receiptUrl} alt="receipt" className="w-8 h-8 object-cover rounded border" />
            <button
              type="button"
              onClick={() => set("receiptUrl", "")}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            disabled={uploading}
            className="text-xs text-gray-500 w-24"
          />
        )}
      </td>
      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="p-1.5 text-white bg-[#1e3a8a] rounded hover:bg-[#003d99] transition-colors disabled:opacity-50"
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="p-1.5 text-gray-500 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Owner Section ─────────────────────────────────────────────────────────────

function OwnerSection({
  owner,
  draws,
  onAdded,
  onUpdated,
  onDeleted,
}: {
  owner: Owner;
  draws: Draw[];
  onAdded: (draw: Draw) => void;
  onUpdated: (draw: Draw) => void;
  onDeleted: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const ownerDraws = draws.filter((d) => d.userId === owner.id);
  const total = ownerDraws.reduce((s, d) => s + d.amount, 0);
  const visibleDraws = showAll ? ownerDraws : ownerDraws.slice(0, 5);
  const hiddenCount = ownerDraws.length - 5;

  async function handleSave(id: string, form: EditForm) {
    const res = await fetch(`/api/admin/owner-draws/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(form.amount),
        drawDate: form.drawDate,
        method: form.method,
        notes: form.notes || null,
        receiptUrl: form.receiptUrl || null,
      }),
    });
    const data = await res.json() as { draw: Draw };
    onUpdated(data.draw);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/owner-draws/${id}`, { method: "DELETE" });
    onDeleted(id);
    setDeletingId(null);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Owner header */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-base font-bold text-[#1e3a8a]">{owner.name ?? owner.email}</h2>
        <p className="text-xs text-gray-400">{owner.email}</p>
      </div>

      {/* Add form */}
      <div className="px-5 py-4 border-b border-gray-100">
        <AddDrawForm owner={owner} onAdded={onAdded} />
      </div>

      {/* Draw history table */}
      {ownerDraws.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</th>
                <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleDraws.map((draw) => {
                if (editingId === draw.id) {
                  return (
                    <EditRow
                      key={draw.id}
                      draw={draw}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                    />
                  );
                }

                return (
                  <tr key={draw.id} className="hover:bg-gray-50 transition-colors">
                    {/* Date */}
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {formatDate(draw.drawDate)}
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-2 text-right font-mono font-medium text-gray-900 whitespace-nowrap">
                      {formatMoney(draw.amount)}
                    </td>
                    {/* Method */}
                    <td className="px-3 py-2 text-gray-600">{draw.method}</td>
                    {/* Notes */}
                    <td className="px-3 py-2 text-gray-500 text-xs max-w-[160px]">
                      {draw.notes ? (
                        <span title={draw.notes}>
                          {draw.notes.length > 40 ? draw.notes.slice(0, 40) + "..." : draw.notes}
                        </span>
                      ) : "—"}
                    </td>
                    {/* Receipt */}
                    <td className="px-3 py-2 text-center">
                      {draw.receiptUrl ? (
                        <a href={draw.receiptUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={draw.receiptUrl}
                            alt="receipt"
                            className="w-8 h-8 object-cover rounded border mx-auto hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {deletingId === draw.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600 font-medium">Delete?</span>
                            <button
                              onClick={() => handleDelete(draw.id)}
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
                              onClick={() => { setEditingId(draw.id); setDeletingId(null); }}
                              className="p-1.5 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => { setDeletingId(draw.id); setEditingId(null); }}
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

          {/* Show more / collapse */}
          {ownerDraws.length > 5 && (
            <div className="px-4 py-2 border-t border-gray-100">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-xs text-[#1e3a8a] hover:underline font-medium"
              >
                {showAll ? "Collapse" : `Show ${hiddenCount} more`}
              </button>
            </div>
          )}

          {/* Running total */}
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
            <span className="text-sm font-semibold text-gray-700">
              Total: <span className="font-mono text-[#1e3a8a]">{formatMoney(total)}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          No draws logged yet.
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OwnerDrawsClient({
  owners,
  initialDraws,
  currentYear,
}: {
  owners: Owner[];
  initialDraws: Draw[];
  currentYear: number;
}) {
  const [year, setYear] = useState(currentYear);
  const [draws, setDraws] = useState<Draw[]>(initialDraws);
  const [loading, setLoading] = useState(false);

  const fetchYear = useCallback(async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/owner-draws?year=${y}`);
      const data = await res.json() as { draws: Draw[] };
      setDraws(data.draws);
    } finally {
      setLoading(false);
    }
  }, []);

  function prevYear() {
    const y = year - 1;
    setYear(y);
    fetchYear(y);
  }

  function nextYear() {
    const y = year + 1;
    setYear(y);
    fetchYear(y);
  }

  function handleAdded(draw: Draw) {
    // Only prepend if the draw is in the current year view
    const drawYear = new Date(draw.drawDate).getUTCFullYear();
    if (drawYear === year) {
      setDraws((prev) => [draw, ...prev]);
    }
  }

  function handleUpdated(updated: Draw) {
    setDraws((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function handleDeleted(id: string) {
    setDraws((prev) => prev.filter((d) => d.id !== id));
  }

  // Summary calculations
  const justinOwner = owners.find((o) => o.email === "justin@oakridgeelectrical.com");
  const bethOwner = owners.find((o) => o.email === "beth@oakridgeelectrical.com");

  const justinTotal = justinOwner
    ? draws.filter((d) => d.userId === justinOwner.id).reduce((s, d) => s + d.amount, 0)
    : 0;
  const bethTotal = bethOwner
    ? draws.filter((d) => d.userId === bethOwner.id).reduce((s, d) => s + d.amount, 0)
    : 0;
  const combinedTotal = draws.reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a8a]">Owner Draws &amp; Distributions</h1>
        <p className="text-sm text-gray-500 mt-1">Track owner draws and distributions by year.</p>
      </div>

      <AdminNav />

      {/* Year selector */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={prevYear}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Previous year"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800 min-w-[56px] text-center">{year}</span>
        <button
          onClick={nextYear}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Next year"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
        {loading && <span className="text-xs text-gray-400 ml-2">Loading...</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
            {justinOwner?.name ?? "Justin"} YTD
          </p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{formatMoney(justinTotal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
            {bethOwner?.name ?? "Beth"} YTD
          </p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{formatMoney(bethTotal)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Combined Total</p>
          <p className="text-2xl font-bold text-[#1e3a8a]">{formatMoney(combinedTotal)}</p>
        </div>
      </div>

      {/* Per-owner sections */}
      {owners.map((owner) => (
        <OwnerSection
          key={owner.id}
          owner={owner}
          draws={draws}
          onAdded={handleAdded}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      ))}

      {owners.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          No admin users found.
        </div>
      )}
    </div>
  );
}
