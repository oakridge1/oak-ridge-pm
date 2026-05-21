"use client";

import { useState, useTransition, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Paperclip,
  ExternalLink,
  Upload,
  Package,
} from "lucide-react";
import { addMaterial, updateMaterial, deleteMaterial } from "./materials-tab-actions";
import { useUpload } from "@/lib/use-upload";
import type { Role } from "@/app/generated/prisma/client";

type MaterialEntry = {
  id: string;
  date: Date;
  vendor: string | null;
  poNumber: string | null;
  description: string;
  amount: number;
  markupPct: number;
  fileUrl: string | null;
  fileName: string | null;
  user: { name: string | null };
};

interface MaterialsTabProps {
  job: {
    id: string;
    materialBudget: number | null;
    materials: MaterialEntry[];
  };
  role: Role;
}

function fmtMoney(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function toDateInput(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(url);
}

function EditRow({
  entry,
  jobId,
  onCancel,
}: {
  entry: MaterialEntry;
  jobId: string;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(toDateInput(entry.date));
  const [vendor, setVendor] = useState(entry.vendor ?? "");
  const [poNumber, setPoNumber] = useState(entry.poNumber ?? "");
  const [description, setDescription] = useState(entry.description);
  const [amount, setAmount] = useState(String(entry.amount));
  const [markupPct, setMarkupPct] = useState(String(entry.markupPct ?? 0));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const baseCost = parseFloat(amount) || 0;
  const markup = parseFloat(markupPct) || 0;
  const totalWithMarkup = baseCost * (1 + markup / 100);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMaterial(entry.id, jobId, { date, vendor, poNumber, description, amount, markupPct });
        onCancel();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO # (optional)"
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" required
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72] col-span-2" />
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Base Cost ($)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" min="0" placeholder="0.00"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Markup %</label>
          <input type="number" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} step="0.5" min="0" placeholder="0"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        </div>
      </div>
      {markup > 0 && (
        <p className="text-xs text-gray-500">Total w/ markup: <strong>{fmtMoney(totalWithMarkup)}</strong></p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button onClick={handleSave} disabled={pending}
          className="bg-[#002D72] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  jobId,
  role,
}: {
  entry: MaterialEntry;
  jobId: string;
  role: Role;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) return <EditRow entry={entry} jobId={jobId} onCancel={() => setEditing(false)} />;

  return (
    <div className={`flex items-start gap-3 py-3 border-b last:border-b-0 border-gray-100 ${pending ? "opacity-50" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400">{fmtDate(entry.date)}</span>
          {entry.vendor && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{entry.vendor}</span>
          )}
          {entry.poNumber && (
            <span className="text-xs font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">PO# {entry.poNumber}</span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 mt-0.5">{entry.description}</p>
        <p className="text-xs text-gray-400 mt-0.5">Added by {entry.user.name ?? "Unknown"}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {entry.fileUrl && (
          <a
            href={entry.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#002D72] transition-colors"
            title={entry.fileName ?? "Attachment"}
          >
            {isImage(entry.fileUrl) ? (
              <img src={entry.fileUrl} alt="receipt" className="w-8 h-8 rounded object-cover border border-gray-200" />
            ) : (
              <Paperclip className="w-4 h-4" />
            )}
          </a>
        )}
        <div className="text-right">
          {entry.markupPct > 0 ? (
            <>
              <p className="text-xs text-gray-400 tabular-nums">{fmtMoney(entry.amount)} base</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">{fmtMoney(entry.amount * (1 + entry.markupPct / 100))}</p>
              <p className="text-xs text-gray-400">+{entry.markupPct}%</p>
            </>
          ) : (
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmtMoney(entry.amount)}</span>
          )}
        </div>
        {role === "ADMIN" && (
          <>
            <button onClick={() => setEditing(true)} className="p-1 text-gray-400 hover:text-[#002D72] hover:bg-gray-100 rounded">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (!confirmDelete) { setConfirmDelete(true); return; }
                startTransition(() => deleteMaterial(entry.id, jobId));
              }}
              onBlur={() => setConfirmDelete(false)}
              className={`p-1 rounded text-xs ${confirmDelete ? "bg-red-600 text-white px-2" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
            >
              {confirmDelete ? "Confirm?" : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddForm({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [vendor, setVendor] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [markupPct, setMarkupPct] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { startUpload } = useUpload("materialAttachment");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!description.trim()) { setError("Description is required."); return; }
    if (!amount) { setError("Amount is required."); return; }

    let fileUrl: string | undefined;
    let fileName: string | undefined;

    if (file) {
      setUploading(true);
      try {
        const res = await startUpload([file]);
        if (res?.[0]) {
          fileUrl = res[0].ufsUrl;
          fileName = res[0].name;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "File upload failed — check the browser console for details.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    startTransition(async () => {
      try {
        await addMaterial(jobId, { date, vendor, poNumber, description, amount, markupPct, fileUrl, fileName });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-[#002D72]" />
          Add Expense
        </h3>
        <button type="button" onClick={onDone} className="p-1 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
          <input type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Home Depot"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">PO #</label>
          <input type="text" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PO-2025-001"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Wire, conduit, breakers…" required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Base Cost ($) <span className="text-red-500">*</span></label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" min="0" placeholder="0.00" required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Markup %</label>
          <input type="number" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} step="0.5" min="0" placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
          {parseFloat(markupPct) > 0 && parseFloat(amount) > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">Total: {fmtMoney(parseFloat(amount) * (1 + parseFloat(markupPct) / 100))}</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Receipt / Invoice</label>
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-[#002D72] hover:text-[#002D72] transition-colors bg-white">
            <Upload className="w-4 h-4 shrink-0" />
            <span className="truncate">{file ? file.name : "Upload file…"}</span>
            <input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <button type="submit" disabled={pending || uploading}
          className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors">
          {uploading ? "Uploading…" : pending ? "Saving…" : "Add Expense"}
        </button>
      </div>
    </form>
  );
}

export function MaterialsTab({ job, role }: MaterialsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const entries = job.materials.map((m) => ({ ...m, date: new Date(m.date) }));
  // Total ALWAYS includes all entries regardless of view — uses marked-up amounts
  const total = entries.reduce((sum, e) => sum + e.amount * (1 + (e.markupPct ?? 0) / 100), 0);
  const budget = job.materialBudget;
  const remaining = budget != null ? budget - total : null;

  const VISIBLE_COUNT = 5;
  const visibleEntries = showAll ? entries : entries.slice(0, VISIBLE_COUNT);
  const hiddenCount = entries.length - VISIBLE_COUNT;

  return (
    <div className="p-5">
      {/* Totals bar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Total Spent</p>
          <p className="text-xl font-bold text-[#002D72]">{fmtMoney(total)}</p>
        </div>
        {(role === "ADMIN" || role === "OFFICE") && budget != null && (
          <>
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Budget</p>
              <p className="text-xl font-bold text-gray-700">{fmtMoney(budget)}</p>
            </div>
            <div className={`rounded-xl px-4 py-3 flex-1 min-w-[120px] ${remaining != null && remaining < 0 ? "bg-red-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Remaining</p>
              <p className={`text-xl font-bold ${remaining != null && remaining < 0 ? "text-red-600" : "text-green-700"}`}>
                {remaining != null ? fmtMoney(remaining) : "—"}
              </p>
            </div>
          </>
        )}
      </div>

      {showForm ? (
        <AddForm jobId={job.id} onDone={() => setShowForm(false)} />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-[#002D72] hover:text-[#003d99] font-medium transition-colors mb-6"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      )}

      {/* Entry log */}
      {entries.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">No expenses logged yet.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4">
            {visibleEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} jobId={job.id} role={role} />
            ))}
          </div>
          {!showAll && hiddenCount > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowAll(true)}
                className="text-sm text-[#002D72] hover:text-[#003d99] font-medium"
              >
                View All ({entries.length} entries) — older receipts archived to Document Vault
              </button>
            </div>
          )}
          {showAll && entries.length > VISIBLE_COUNT && (
            <div className="px-4 py-3 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowAll(false)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Show less
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
