"use client";

import { useState, useEffect } from "react";
import { Search, ShoppingCart, Plus, X, Truck, Store, Package2, Send, CheckCircle2 } from "lucide-react";

type VarConfig = { key: string; label: string; type: string; options?: string[]; placeholder?: string; required?: boolean };

type StockItem = {
  id: string;
  category: string;
  name: string;
  lingo: string | null;
  unitOfMeasure: string;
  isConsumable: boolean;
  variables: VarConfig[] | null;
  notes: string | null;
};

type StockRequest = {
  id: string;
  stockItemId: string | null;
  customItemName: string | null;
  variables: Record<string, string> | null;
  quantity: number;
  quantityUnit: string | null;
  note: string | null;
  deliveryMethod: string;
  status: string;
  createdAt: string;
  user: { name: string | null };
  stockItem: { name: string; category: string; lingo: string | null } | null;
};

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  pickupOnly: boolean;
};

interface CribTabProps {
  job: {
    id: string;
    jobNumber: string;
    jobName: string;
    address: string | null;
    city: string | null;
    state: string | null;
  };
  role: string;
  currentUserId: string;
}

const DELIVERY_OPTIONS = [
  { value: "PICKUP", label: "Pickup", icon: Store },
  { value: "DELIVERY_SITE", label: "To Site", icon: Truck },
  { value: "DELIVERY_SHOP", label: "To Shop", icon: Package2 },
];

function deliveryLabel(method: string) {
  return DELIVERY_OPTIONS.find(o => o.value === method)?.label ?? method;
}

function formatVariables(vars: Record<string, string> | null) {
  if (!vars) return "";
  return Object.values(vars).filter(Boolean).join(" · ");
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function CribTab({ job, role, currentUserId }: CribTabProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [formVars, setFormVars] = useState<Record<string, string>>({});
  const [formQty, setFormQty] = useState("1");
  const [formNote, setFormNote] = useState("");
  const [formDelivery, setFormDelivery] = useState("PICKUP");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [showSendModal, setShowSendModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const canSendOrder = role === "ADMIN" || role === "FOREMAN";

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stock-items").then(r => r.json()),
      fetch(`/api/jobs/${job.id}/stock-requests`).then(r => r.json()),
      fetch("/api/admin/suppliers").then(r => r.json()),
    ]).then(([itemsData, requestsData, suppliersData]) => {
      setItems(Array.isArray(itemsData) ? itemsData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [job.id]);

  async function refreshRequests() {
    const data = await fetch(`/api/jobs/${job.id}/stock-requests`).then(r => r.json());
    setRequests(Array.isArray(data) ? data : []);
  }

  function selectItem(item: StockItem) {
    setSelectedItem(item);
    setFormVars({});
    setFormQty("1");
    setFormNote("");
    setFormDelivery("PICKUP");
    setAddError(null);
    setShowCustom(false);
  }

  async function handleAddRequest() {
    if (!selectedItem && !customName.trim()) { setAddError("Select an item or enter a custom item name."); return; }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/stock-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: selectedItem?.id ?? null,
          customItemName: customName || null,
          customCategory: customCategory || null,
          variables: Object.keys(formVars).length > 0 ? formVars : null,
          quantity: parseFloat(formQty) || 1,
          quantityUnit: selectedItem?.unitOfMeasure ?? null,
          note: formNote || null,
          deliveryMethod: formDelivery,
        }),
      });
      if (!res.ok) { const d = await res.json(); setAddError(d.error ?? "Failed to add"); return; }
      setSelectedItem(null);
      setShowCustom(false);
      setCustomName("");
      setFormQty("1");
      setFormNote("");
      await refreshRequests();
    } catch {
      setAddError("Failed to add request.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(requestId: string) {
    await fetch(`/api/jobs/${job.id}/stock-requests/${requestId}`, { method: "DELETE" });
    await refreshRequests();
  }

  const q = search.toLowerCase();
  const filteredItems = q
    ? items.filter(i => i.name.toLowerCase().includes(q) || (i.lingo?.toLowerCase().includes(q)) || i.category.toLowerCase().includes(q))
    : items;

  const materialItems = filteredItems.filter(i => !i.isConsumable);
  const consumableItems = filteredItems.filter(i => i.isConsumable);

  const materialCategories = [...new Set(materialItems.map(i => i.category))];
  const consumableCategories = [...new Set(consumableItems.map(i => i.category))];

  const pendingRequests = requests.filter(r => r.status === "PENDING");
  const sentRequests = requests.filter(r => r.status === "SENT");

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">Loading stock list…</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#002D72] flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#FF5910]" />
            The Crib
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Daily stock ordering — resets at midnight</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingRequests.length > 0 && (
            <span className="bg-[#FF5910] text-white text-xs font-bold px-2 py-1 rounded-full">
              {pendingRequests.length} item{pendingRequests.length !== 1 ? "s" : ""}
            </span>
          )}
          {canSendOrder && pendingRequests.length > 0 && (
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-1.5 bg-[#FF5910] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#e04d0e] transition-colors"
            >
              <Send className="w-4 h-4" /> Send Order
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or lingo…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
        />
      </div>

      {/* Today's Requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Today&apos;s Order ({requests.length})</h3>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div key={req.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {req.quantity} {req.quantityUnit ?? "EA"} — {req.stockItem?.name ?? req.customItemName}
                  </p>
                  {req.variables && Object.keys(req.variables).length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">{formatVariables(req.variables)}</p>
                  )}
                  {req.note && <p className="text-xs text-gray-400 mt-0.5 italic">{req.note}</p>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      req.deliveryMethod === "PICKUP" ? "bg-gray-100 text-gray-600" :
                      req.deliveryMethod === "DELIVERY_SITE" ? "bg-blue-50 text-blue-700" :
                      "bg-orange-50 text-orange-700"
                    }`}>{deliveryLabel(req.deliveryMethod)}</span>
                    <span className="text-xs text-gray-400">{req.user.name} · {timeAgo(req.createdAt)}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(req.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {sentRequests.length > 0 && (
              <div className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                {sentRequests.length} order{sentRequests.length > 1 ? "s" : ""} sent today
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item form (when item selected) */}
      {(selectedItem || showCustom) && (
        <div className="mb-6 bg-blue-50 border border-[#002D72]/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#002D72]">
              {selectedItem ? (selectedItem.lingo ?? selectedItem.name) : "Custom Item"}
            </h3>
            <button onClick={() => { setSelectedItem(null); setShowCustom(false); }} className="text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          {showCustom && (
            <div className="space-y-2 mb-3">
              <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="Item name *" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
              <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                placeholder="Category (optional)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
            </div>
          )}

          {/* Variable inputs */}
          {selectedItem?.variables && selectedItem.variables.length > 0 && (
            <div className="space-y-2 mb-3">
              {selectedItem.variables.map(v => (
                <div key={v.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{v.label}{v.required && " *"}</label>
                  {v.type === "select" && v.options ? (
                    <select
                      value={formVars[v.key] ?? ""}
                      onChange={e => setFormVars({ ...formVars, [v.key]: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                    >
                      <option value="">Select…</option>
                      {v.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formVars[v.key] ?? ""}
                      onChange={e => setFormVars({ ...formVars, [v.key]: e.target.value })}
                      placeholder={v.placeholder ?? ""}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Qty & Note */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
              <input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} min="0.5" step="0.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
              <input type="text" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Optional note…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
            </div>
          </div>

          {/* Delivery */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">Delivery</label>
            <div className="flex gap-2">
              {DELIVERY_OPTIONS.filter(o => selectedItem?.isConsumable ? o.value === "PICKUP" : true).map(opt => (
                <button key={opt.value} onClick={() => setFormDelivery(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                    formDelivery === opt.value
                      ? "bg-[#002D72] text-white border-[#002D72]"
                      : "bg-white text-gray-600 border-gray-300 hover:border-[#002D72]"
                  }`}>
                  <opt.icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}

          <button onClick={handleAddRequest} disabled={adding}
            className="w-full bg-[#002D72] text-white py-2.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors">
            {adding ? "Adding…" : "Add to Order"}
          </button>
        </div>
      )}

      {/* Custom item button */}
      {!selectedItem && !showCustom && (
        <button onClick={() => { setShowCustom(true); setSelectedItem(null); }}
          className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#002D72] hover:text-[#002D72] transition-colors">
          <Plus className="w-4 h-4" /> Add Custom Item
        </button>
      )}

      {/* Materials section */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Materials Order</h3>
        {materialCategories.map(cat => {
          const catItems = materialItems.filter(i => i.category === cat);
          return (
            <div key={cat} className="mb-4">
              <h4 className="text-xs font-semibold text-[#002D72] mb-2 uppercase tracking-wide">
                {cat} <span className="text-gray-400 font-normal normal-case">({catItems.length})</span>
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {catItems.map(item => (
                  <button key={item.id} onClick={() => selectItem(item)}
                    className={`text-left p-2.5 rounded-xl border text-sm transition-colors ${
                      selectedItem?.id === item.id
                        ? "bg-[#002D72] text-white border-[#002D72]"
                        : "bg-white border-gray-200 hover:border-[#002D72]/50 hover:bg-blue-50"
                    }`}>
                    <p className="font-medium leading-tight">{item.name}</p>
                    {item.lingo && item.lingo !== item.name && (
                      <p className={`text-xs mt-0.5 ${selectedItem?.id === item.id ? "text-blue-200" : "text-gray-400"}`}>{item.lingo}</p>
                    )}
                    {item.notes && (
                      <p className={`text-xs mt-0.5 italic ${selectedItem?.id === item.id ? "text-blue-200" : "text-orange-500"}`}>{item.notes}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Consumables section */}
      {consumableItems.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-gray-200" />
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">Consumables &amp; Safety</h3>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <p className="text-xs text-gray-400 mb-3">Pickup only — generates a separate pickup list</p>
          {consumableCategories.map(cat => {
            const catItems = consumableItems.filter(i => i.category === cat);
            return (
              <div key={cat} className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{cat}</h4>
                <div className="grid grid-cols-2 gap-2">
                  {catItems.map(item => (
                    <button key={item.id} onClick={() => selectItem(item)}
                      className={`text-left p-2.5 rounded-xl border text-sm transition-colors ${
                        selectedItem?.id === item.id
                          ? "bg-[#002D72] text-white border-[#002D72]"
                          : "bg-white border-gray-200 hover:border-[#002D72]/50 hover:bg-blue-50"
                      }`}>
                      <p className="font-medium leading-tight">{item.name}</p>
                      {item.lingo && item.lingo !== item.name && (
                        <p className={`text-xs mt-0.5 ${selectedItem?.id === item.id ? "text-blue-200" : "text-gray-400"}`}>{item.lingo}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send Order Modal */}
      {showSendModal && (
        <SendOrderModal
          job={job}
          requests={pendingRequests}
          suppliers={suppliers}
          onClose={() => setShowSendModal(false)}
          onSent={async () => {
            setShowSendModal(false);
            await refreshRequests();
          }}
        />
      )}
    </div>
  );
}

function SendOrderModal({ job, requests, suppliers, onClose, onSent }: {
  job: CribTabProps["job"];
  requests: StockRequest[];
  suppliers: Supplier[];
  onClose: () => void;
  onSent: () => void;
}) {
  const electricalSuppliers = suppliers.filter(s => !s.pickupOnly);
  const electricalRequests = requests.filter(r => r.stockItem !== null);
  const consumableRequests = requests.filter(r => r.stockItem === null && r.customItemName);
  const allPickupRequests = requests.filter(r => r.deliveryMethod === "PICKUP" && r.stockItem !== null);
  const deliveryRequests = requests.filter(r => r.deliveryMethod !== "PICKUP" && r.stockItem !== null);

  const [supplierName, setSupplierName] = useState(electricalSuppliers[0]?.name ?? "");
  const [supplierEmail, setSupplierEmail] = useState(electricalSuppliers[0]?.email ?? "");
  const [poNumber, setPoNumber] = useState(job.jobNumber);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const groups = [];

      // Electrical items group (stock items)
      if (electricalRequests.length > 0) {
        groups.push({
          supplierName,
          supplierEmail,
          deliveryMethod: "MIXED",
          requestIds: electricalRequests.map(r => r.id),
          isConsumables: false,
        });
      }

      // Custom/consumable items group
      if (consumableRequests.length > 0) {
        groups.push({
          supplierName: "Pickup",
          supplierEmail: null,
          deliveryMethod: "PICKUP",
          requestIds: consumableRequests.map(r => r.id),
          isConsumables: true,
          isPickup: true,
        });
      }

      if (groups.length === 0) { setError("No items to send."); setSending(false); return; }

      const res = await fetch(`/api/jobs/${job.id}/stock-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups, poNumber, deliveryNotes }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "Failed to send order"); return; }
      onSent();
    } catch {
      setError("Failed to send order.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-[#002D72]">Send Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <p className="font-semibold text-gray-900 mb-1">{requests.length} items · {job.jobNumber} {job.jobName}</p>
            <p className="text-gray-500 text-xs">
              {electricalRequests.length} electrical, {consumableRequests.length} custom/consumable
            </p>
          </div>

          {electricalRequests.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Electrical Supplier</h3>
              <div className="space-y-2">
                <select value={supplierName} onChange={e => {
                  setSupplierName(e.target.value);
                  const sup = electricalSuppliers.find(s => s.name === e.target.value);
                  setSupplierEmail(sup?.email ?? "");
                }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
                  {electricalSuppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  <option value="custom">Custom…</option>
                </select>
                <input type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)}
                  placeholder="Rep email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PO / Job Number *</label>
            <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Notes</label>
            <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={2} placeholder="Special instructions…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleSend} disabled={sending}
              className="flex-1 py-2.5 bg-[#FF5910] text-white rounded-xl text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60 transition-colors">
              {sending ? "Sending…" : "Send Order"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
