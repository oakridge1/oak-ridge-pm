"use client";

import { useState, useRef } from "react";
import { ShoppingCart, X } from "lucide-react";

const OVERHEAD_CATEGORIES = [
  "Office & Shop Supplies",
  "Rent & Facilities",
  "Utilities",
  "Insurance",
  "Vehicle & Fuel",
  "Tools & Equipment",
  "Professional Services",
  "Software & Subscriptions",
  "Marketing & Advertising",
  "Taxes & Licenses",
  "Other",
];

export function ShopExpenseButton() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Office & Shop Supplies");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setAmount("");
    setDescription("");
    setCategory("Office & Shop Supplies");
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeModal() {
    setOpen(false);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !description) return;
    setSaving(true);
    try {
      let receiptUrl: string | null = null;

      // Upload receipt photo if selected
      const file = fileRef.current?.files?.[0];
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("endpoint", "receiptImage");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          receiptUrl = uploadData.url ?? null;
        }
      }

      // Post the overhead cost
      const today = new Date().toISOString();
      const res = await fetch("/api/admin/overhead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          description,
          amount: parseFloat(amount),
          effectiveDate: today,
          isRecurring: false,
          autoIncrease: false,
          receiptUrl,
        }),
      });

      if (res.ok) {
        closeModal();
        setToast(true);
        setTimeout(() => setToast(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <ShoppingCart className="w-4 h-4" />
        Log Shop Expense
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Log Shop Expense</h2>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">What was purchased *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Wire nuts, electrical tape"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 bg-white"
                >
                  {OVERHEAD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Receipt photo */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Receipt photo (optional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !amount || !description}
                  className="bg-[#002D72] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
                >
                  {saving ? "Saving…" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-green-600 text-white text-sm font-medium px-4 py-3 rounded-xl shadow-lg">
          Shop expense logged ✓
        </div>
      )}
    </>
  );
}
