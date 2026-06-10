"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Plus,
  X,
  Upload,
  Fuel,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReceiptRecord = {
  id: string;
  imageUrl: string | null;
  vendor: string | null;
  amount: number | null;
  receiptDate: string | null;
  description: string | null;
  isFuel: boolean;
  mileage: number | null;
  createdAt: string;
  uploadedBy: { name: string | null };
  vehicle: { tag: string; make: string | null; model: string | null } | null;
};

type Vehicle = {
  id: string;
  tag: string;
  year: string | null;
  make: string | null;
  model: string | null;
  plate: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmount(val: number | null) {
  if (val == null) return "—";
  return val.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Lightbox ──────────────────────────────────────────────────────────────────

function Lightbox({
  receipts,
  startIndex,
  onClose,
}: {
  receipts: ReceiptRecord[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const r = receipts[idx];

  function prev() {
    setIdx((i) => (i - 1 + receipts.length) % receipts.length);
  }
  function next() {
    setIdx((i) => (i + 1) % receipts.length);
  }

  if (!r.imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
      >
        <X className="w-6 h-6" />
      </button>

      {receipts.filter((rec) => rec.imageUrl).length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 text-white/70 hover:text-white p-2"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-12 text-white/70 hover:text-white p-2"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div
        className="max-w-5xl max-h-[90vh] flex flex-col items-center px-16"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={r.imageUrl}
          alt={r.vendor ?? "Receipt"}
          className="max-h-[80vh] max-w-full object-contain rounded-lg"
        />
        <div className="mt-3 text-center space-y-0.5">
          {r.vendor && <p className="text-white text-sm font-medium">{r.vendor}</p>}
          <p className="text-white/70 text-sm">{fmtAmount(r.amount)}</p>
          <p className="text-white/50 text-xs">
            {r.uploadedBy.name ?? "Unknown"} · {fmtDate(r.receiptDate ?? r.createdAt)}
          </p>
        </div>
        <p className="text-white/30 text-xs mt-2">
          {idx + 1} / {receipts.length}
        </p>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
      {message}
    </div>
  );
}

// ── Upload Form ───────────────────────────────────────────────────────────────

function UploadForm({
  jobId,
  onDone,
  onSuccess,
}: {
  jobId: string;
  onDone: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [receiptDate, setReceiptDate] = useState(today());
  const [description, setDescription] = useState("");
  const [isFuel, setIsFuel] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [mileage, setMileage] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch vehicles when fuel toggle turns on
  useEffect(() => {
    if (!isFuel || vehicles.length > 0) return;
    setVehiclesLoading(true);
    fetch("/api/admin/vehicles")
      .then((r) => r.json())
      .then((data: { vehicles: Vehicle[] }) => setVehicles(data.vehicles ?? []))
      .catch(() => setVehicles([]))
      .finally(() => setVehiclesLoading(false));
  }, [isFuel, vehicles.length]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount))) {
      setError("Amount is required.");
      return;
    }
    setError(null);
    setUploading(true);

    try {
      // 1. Upload image (if provided)
      let imageUrl: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("endpoint", "receiptImage");
        const upRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (!upRes.ok) {
          const msg = await upRes.text();
          throw new Error(`Image upload failed: ${msg}`);
        }
        const upData = (await upRes.json()) as { url: string };
        imageUrl = upData.url;
      }

      // 2. POST receipt record
      const body = {
        imageUrl,
        amount: parseFloat(amount),
        vendor: vendor || undefined,
        receiptDate: receiptDate || undefined,
        description: description || undefined,
        isFuel,
        vehicleId: isFuel && vehicleId ? vehicleId : undefined,
        mileage: isFuel && mileage ? parseInt(mileage, 10) : undefined,
      };

      const res = await fetch(`/api/jobs/${jobId}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Failed to save receipt: ${msg}`);
      }

      onSuccess();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#1e3a8a]" />
          Upload Receipt
        </h3>
        <button
          type="button"
          onClick={onDone}
          className="p-1 text-gray-400 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">
          {error}
        </p>
      )}

      {/* Camera / file capture */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Receipt photo (optional)
        </label>
        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-[#1e3a8a] hover:bg-blue-50/30 transition-colors">
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="max-h-40 object-contain rounded-lg"
            />
          ) : (
            <>
              <Upload className="w-7 h-7 text-gray-300" />
              <span className="text-sm font-medium text-[#1e3a8a]">
                Take photo or choose file
              </span>
              <span className="text-xs text-gray-400">
                {file ? file.name : "JPG, PNG, HEIC up to 16MB"}
              </span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Amount <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="border border-gray-300 rounded-lg pl-6 pr-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      </div>

      {/* Vendor */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Vendor
        </label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="e.g. Home Depot, Shell"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Date
        </label>
        <input
          type="date"
          value={receiptDate}
          onChange={(e) => setReceiptDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was purchased?"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>

      {/* Fuel toggle */}
      <div className="flex items-center justify-between py-1">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
          <Fuel className="w-4 h-4 text-orange-500" />
          Fuel receipt?
        </label>
        <button
          type="button"
          onClick={() => setIsFuel((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isFuel ? "bg-[#1e3a8a]" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isFuel ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Fuel fields */}
      {isFuel && (
        <div className="space-y-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Vehicle
            </label>
            {vehiclesLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading vehicles…
              </div>
            ) : (
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] bg-white"
              >
                <option value="">— Select vehicle —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.tag}
                    {v.year ? ` · ${v.year}` : ""}
                    {v.make ? ` ${v.make}` : ""}
                    {v.model ? ` ${v.model}` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Mileage (optional)
            </label>
            <input
              type="number"
              min="0"
              value={mileage}
              onChange={(e) => setMileage(e.target.value)}
              placeholder="Current odometer reading"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="bg-[#1e3a8a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors flex items-center gap-1.5"
        >
          {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {uploading ? "Saving…" : "Save Receipt"}
        </button>
      </div>
    </form>
  );
}

// ── Receipt Card ──────────────────────────────────────────────────────────────

function ReceiptCard({
  receipt,
  onThumbnailClick,
}: {
  receipt: ReceiptRecord;
  onThumbnailClick: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-3 items-start">
      {/* Thumbnail */}
      <div className="shrink-0 w-14 h-14">
        {receipt.imageUrl ? (
          <button
            onClick={onThumbnailClick}
            className="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:opacity-80 transition-opacity"
          >
            <img
              src={receipt.imageUrl}
              alt="Receipt"
              className="w-full h-full object-cover"
            />
          </button>
        ) : (
          <div className="w-14 h-14 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
            <Receipt className="w-6 h-6 text-gray-300" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {receipt.vendor ?? "Receipt"}
              {receipt.isFuel && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-100 rounded-full px-1.5 py-0.5">
                  <Fuel className="w-2.5 h-2.5" />
                  Fuel
                </span>
              )}
            </p>
            {receipt.vehicle && (
              <p className="text-xs text-gray-400 mt-0.5">
                {receipt.vehicle.tag}
                {receipt.vehicle.make ? ` · ${receipt.vehicle.make}` : ""}
                {receipt.vehicle.model ? ` ${receipt.vehicle.model}` : ""}
                {receipt.mileage ? ` — ${receipt.mileage.toLocaleString()} mi` : ""}
              </p>
            )}
            {receipt.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{receipt.description}</p>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900 shrink-0">
            {fmtAmount(receipt.amount)}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <p className="text-xs text-gray-400">
            {fmtDate(receipt.receiptDate ?? receipt.createdAt)}
          </p>
          <span className="text-gray-200">·</span>
          <p className="text-xs text-gray-400">
            {receipt.uploadedBy.name ?? "Unknown"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

interface ReceiptsTabProps {
  jobId: string;
  userId: string;
  userRole: string;
}

export function ReceiptsTab({ jobId, userRole }: ReceiptsTabProps) {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isFieldCrew = userRole === "TEAMMATE";

  const fetchReceipts = useCallback(() => {
    setLoading(true);
    fetch(`/api/jobs/${jobId}/receipts?limit=5`)
      .then((r) => r.json())
      .then((data: { receipts: ReceiptRecord[] }) =>
        setReceipts(data.receipts ?? [])
      )
      .catch(() => setReceipts([]))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  // Only receipts with images for lightbox
  const withImages = receipts.filter((r) => r.imageUrl);

  function handleThumbnailClick(receipt: ReceiptRecord) {
    const idx = withImages.findIndex((r) => r.id === receipt.id);
    if (idx >= 0) setLightboxIdx(idx);
  }

  return (
    <div className="p-5">
      {/* Lightbox */}
      {lightboxIdx !== null && withImages.length > 0 && (
        <Lightbox
          receipts={withImages}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast} onDone={() => setToast(null)} />
      )}

      {/* Upload form or button */}
      {showForm ? (
        <UploadForm
          jobId={jobId}
          onDone={() => setShowForm(false)}
          onSuccess={() => {
            setToast("Receipt uploaded ✓");
            fetchReceipts();
          }}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 bg-[#1e3a8a] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors mb-6"
        >
          <Plus className="w-4 h-4" />
          Upload Receipt
        </button>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : receipts.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No receipts yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((r) => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              onThumbnailClick={() => handleThumbnailClick(r)}
            />
          ))}
        </div>
      )}

      {/* View all — admin/office only */}
      {!isFieldCrew && receipts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <a
            href={`/admin/receipts?jobId=${jobId}`}
            className="flex items-center gap-1.5 text-sm text-[#1e3a8a] hover:text-[#003d99] font-medium transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View all receipts
          </a>
        </div>
      )}
    </div>
  );
}
