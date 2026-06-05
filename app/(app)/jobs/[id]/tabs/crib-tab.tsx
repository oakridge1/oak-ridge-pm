"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, ShoppingCart, Plus, X, Truck, Store, Package2, Send, CheckCircle2, ChevronDown, ChevronUp, Clock, Layers, ChevronLeft } from "lucide-react";

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
  customCategory: string | null;
  variables: Record<string, string> | null;
  quantity: number;
  quantityUnit: string | null;
  note: string | null;
  deliveryMethod: string;
  status: string;
  createdAt: string;
  conductorGroupId: string | null;
  approvalRequestId: string | null;
  isConsumableOverride: boolean;
  user: { name: string | null };
  stockItem: { name: string; category: string; lingo: string | null; isConsumable: boolean } | null;
};

type ApprovalRequest = {
  id: string;
  status: string;
  createdAt: string;
  requestedBy: { name: string | null; email: string | null };
  requests: StockRequest[];
};

type Supplier = {
  id:         string;
  name:       string;
  email:      string | null;
  pickupOnly: boolean;
  contacts?:  Array<{ id: string; name: string; email: string; isPrimary: boolean }>;
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

// Wire size buckets for THHN/XHHW/THWN
const THHN_SMALL_SIZES = ["14", "12", "10", "8", "6"];
const THHN_LARGE_SIZES = ["4", "3", "2", "1", "1/0", "2/0", "3/0", "4/0", "250MCM", "350MCM", "500MCM"];
const THHN_ALL_SIZES = [...THHN_SMALL_SIZES, ...THHN_LARGE_SIZES, "Custom"];
const THHN_COLORS = ["Black", "Red", "Blue", "White", "Green", "Brown", "Orange", "Yellow", "Gray", "Other"];
const THHN_REEL_SIZES = ["500ft", "1000ft", "2500ft", "Custom footage"];

// MC/Romex size buckets
const MC_SMALL_SIZES_14_12 = ["14/2", "14/3", "12/2", "12/3"];
const MC_MEDIUM_SIZES = ["10/2", "10/3", "8/3"];
const MC_LARGE_SIZES = ["6/3"];
const MC_ALL_SIZES = [...MC_SMALL_SIZES_14_12, ...MC_MEDIUM_SIZES, ...MC_LARGE_SIZES, "Custom"];
const MC_ROLL_SIZES = ["250ft", "Custom footage"];

const ALL_CATEGORIES = [
  "Wire & Cable", "Low Voltage", "Conduit — Other Types", "EMT Conduit", "EMT Fittings",
  "MC / AC Cable Fittings", "Boxes", "Mud / Plaster Rings", "Wire Connectors", "Grounding",
  "Staples & Fasteners", "Panels & Breakers", "Devices & Receptacles", "Lighting",
  "Tape & Sealants", "Misc Hardware & Specialty", "Strut & Hangers", "Consumables & Safety",
  "PVC Conduit Fittings", "Rigid / IMC Fittings", "Flex Conduit Fittings", "Liquid Tight Fittings",
];

const UOM_OPTIONS = ["EA", "FT", "C", "M", "PK", "Roll", "Bag", "Box", "Sticks", "Pairs", "Tubes"];

function isThhnItem(item: StockItem) {
  return item.name.includes("THHN") || item.name.includes("XHHW") || item.name.includes("THWN") || item.name.includes("SIMpull");
}

function isMcRomexItem(item: StockItem) {
  return item.name.includes("MC Cable") || item.name.includes("Romex") || item.name.includes("NM-B") || item.name.includes("UF-B");
}

function formatVariables(vars: Record<string, string> | null) {
  if (!vars) return "";
  return Object.values(vars).filter(Boolean).join(" · ");
}

function formatRequestDisplay(req: StockRequest): string {
  const name = req.stockItem?.name ?? req.customItemName ?? "Custom Item";
  const vars = req.variables ? formatVariables(req.variables) : "";
  const qtyStr = req.quantityUnit
    ? `${req.quantity} ${req.quantityUnit}`
    : `${req.quantity}`;
  return `${qtyStr} — ${name}${vars ? ` — ${vars}` : ""}`;
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

// Smart wire form for THHN/XHHW
function ThhnWireForm({
  vars,
  setVars,
  multiMode,
  setMultiMode,
  conductors,
  setConductors,
}: {
  vars: Record<string, string>;
  setVars: (v: Record<string, string>) => void;
  multiMode: boolean;
  setMultiMode: (v: boolean) => void;
  conductors: Array<{ color: string; otherColor?: string }>;
  setConductors: (c: Array<{ color: string; otherColor?: string }>) => void;
}) {
  const size = vars.size ?? "";
  const isLarge = THHN_LARGE_SIZES.includes(size);
  const isSmall = THHN_SMALL_SIZES.includes(size);
  const orderType = vars.orderType ?? "footage";

  return (
    <div className="space-y-2">
      {/* Size */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Wire Size *</label>
        <select value={size} onChange={e => setVars({ ...vars, size: e.target.value, material: "", orderType: "footage", footage: "", rollSize: "" })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
          <option value="">Select size…</option>
          {THHN_ALL_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Multi-conductor toggle */}
      <button type="button" onClick={() => setMultiMode(!multiMode)}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${multiMode ? "bg-[#002D72] text-white border-[#002D72]" : "border-gray-300 text-gray-600 hover:border-[#002D72]"}`}>
        <Layers className="w-3 h-3" />
        Multi-Conductor {multiMode ? "ON" : "OFF"}
      </button>

      {/* CU/AL toggle (large sizes only) */}
      {isLarge && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Material</label>
          <div className="flex gap-2">
            {["CU", "AL"].map(m => (
              <button key={m} type="button" onClick={() => setVars({ ...vars, material: m })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${vars.material === m ? "bg-[#002D72] text-white border-[#002D72]" : "bg-white text-gray-600 border-gray-300 hover:border-[#002D72]"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color (always shown) */}
      {!multiMode && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Color *</label>
          <select value={vars.color ?? ""} onChange={e => setVars({ ...vars, color: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
            <option value="">Select color…</option>
            {THHN_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {/* Multi-conductor section */}
      {multiMode && size && (
        <div className="border border-[#002D72]/20 rounded-lg p-3 bg-blue-50/50">
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs font-medium text-gray-700">Conductors</label>
            <select value={String(conductors.length)} onChange={e => {
              const n = parseInt(e.target.value);
              const newC = Array.from({ length: n }, (_, i) => conductors[i] ?? { color: "" });
              setConductors(newC);
            }} className="border border-gray-300 rounded px-2 py-1 text-xs bg-white">
              {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
              <option value="custom">Custom</option>
            </select>
          </div>
          {conductors.map((c, i) => (
            <div key={i} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-gray-500 w-24 shrink-0">Conductor {i + 1}</span>
              <select value={c.color} onChange={e => {
                const newC = [...conductors];
                newC[i] = { ...c, color: e.target.value };
                setConductors(newC);
              }} className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs bg-white">
                <option value="">Color…</option>
                {THHN_COLORS.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
              {c.color === "Other" && (
                <input type="text" value={c.otherColor ?? ""} onChange={e => {
                  const newC = [...conductors];
                  newC[i] = { ...c, otherColor: e.target.value };
                  setConductors(newC);
                }} placeholder="Color name" className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Order type / footage / reel */}
      {size && (isLarge || isSmall) && (
        <>
          {isLarge ? (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Order Type</label>
              <div className="flex gap-2">
                {["footage", "reel"].map(t => (
                  <button key={t} type="button" onClick={() => setVars({ ...vars, orderType: t, footage: "", rollSize: "" })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${orderType === t ? "bg-[#002D72] text-white border-[#002D72]" : "bg-white text-gray-600 border-gray-300 hover:border-[#002D72]"}`}>
                    {t === "footage" ? "By Footage" : "By Reel"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {(isSmall || orderType === "footage") && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Footage (ft) * <span className="text-gray-400 font-normal">per ft</span></label>
              <input type="text" value={vars.footage ?? ""} onChange={e => setVars({ ...vars, footage: e.target.value })}
                placeholder="e.g. 250" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
            </div>
          )}
          {isLarge && orderType === "reel" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reel Size * <span className="text-gray-400 font-normal">per roll</span></label>
              <select value={vars.rollSize ?? ""} onChange={e => setVars({ ...vars, rollSize: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
                <option value="">Select…</option>
                {THHN_REEL_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {vars.rollSize === "Custom footage" && (
                <input type="text" value={vars.footage ?? ""} onChange={e => setVars({ ...vars, footage: e.target.value })}
                  placeholder="Custom footage (ft)" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Smart wire form for MC Cable / Romex
function McRomexWireForm({ vars, setVars }: { vars: Record<string, string>; setVars: (v: Record<string, string>) => void }) {
  const size = vars.size ?? "";
  const isSmall = MC_SMALL_SIZES_14_12.includes(size);
  const isMedium = MC_MEDIUM_SIZES.includes(size);
  const isLarge = MC_LARGE_SIZES.includes(size);

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Size / Conductors *</label>
        <select value={size} onChange={e => setVars({ ...vars, size: e.target.value, rollSize: "", footage: "" })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
          <option value="">Select size…</option>
          {MC_ALL_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {size && (isSmall || isMedium) && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Roll Size * <span className="text-gray-400 font-normal">per roll</span></label>
          <select value={vars.rollSize ?? ""} onChange={e => setVars({ ...vars, rollSize: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
            <option value="">Select…</option>
            {MC_ROLL_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {vars.rollSize === "Custom footage" && (
            <input type="text" value={vars.footage ?? ""} onChange={e => setVars({ ...vars, footage: e.target.value })}
              placeholder="Custom footage (ft)" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
          )}
        </div>
      )}

      {size && isLarge && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Footage needed (ft) * <span className="text-gray-400 font-normal">per ft</span></label>
          <input type="text" value={vars.footage ?? ""} onChange={e => setVars({ ...vars, footage: e.target.value })}
            placeholder="e.g. 150" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
        </div>
      )}
    </div>
  );
}

// Inline expand form for a single item
function ItemExpandForm({
  item,
  onAdd,
  onCancel,
}: {
  item: StockItem;
  onAdd: (data: {
    variables: Record<string, string> | null;
    quantity: number;
    note: string | null;
    quantityUnit: string;
    conductorGroupId?: string | null;
    extraRequests?: Array<{ variables: Record<string, string>; quantity: number; quantityUnit: string; note: string | null; conductorGroupId: string }>;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [formVars, setFormVars] = useState<Record<string, string>>({});
  const [formQty, setFormQty] = useState("1");
  const [formNote, setFormNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [multiMode, setMultiMode] = useState(false);
  const [conductors, setConductors] = useState<Array<{ color: string; otherColor?: string }>>(
    [{ color: "" }, { color: "" }, { color: "" }]
  );

  const isThhn = isThhnItem(item);
  const isMcRomex = isMcRomexItem(item);
  const hasSpecialForm = isThhn || isMcRomex;

  // Determine unit for display
  const getUnit = (): string => {
    if (isThhn) {
      const size = formVars.size ?? "";
      const isLarge = THHN_LARGE_SIZES.includes(size);
      const orderType = formVars.orderType ?? "footage";
      if (isLarge && orderType === "reel") return formVars.rollSize ?? "Rolls";
      return "FT";
    }
    if (isMcRomex) {
      const size = formVars.size ?? "";
      const isLarge = MC_LARGE_SIZES.includes(size);
      if (isLarge) return "FT";
      return formVars.rollSize ? "Rolls" : "Rolls";
    }
    return item.unitOfMeasure;
  };

  async function handleAdd() {
    setError(null);
    setAdding(true);
    try {
      if (isThhn && multiMode) {
        // Multi-conductor: generate N requests with shared conductorGroupId
        const groupId = crypto.randomUUID();
        const validConductors = conductors.filter(c => c.color);
        if (validConductors.length < 2) { setError("Select color for at least 2 conductors."); setAdding(false); return; }
        if (!formVars.size) { setError("Select wire size."); setAdding(false); return; }

        const extraRequests = validConductors.slice(1).map(c => ({
          variables: { ...formVars, color: c.color === "Other" ? (c.otherColor ?? "Other") : c.color },
          quantity: parseFloat(formQty) || 1,
          quantityUnit: getUnit(),
          note: formNote || null,
          conductorGroupId: groupId,
        }));

        const firstConductor = validConductors[0];
        await onAdd({
          variables: { ...formVars, color: firstConductor.color === "Other" ? (firstConductor.otherColor ?? "Other") : firstConductor.color },
          quantity: parseFloat(formQty) || 1,
          note: formNote || null,
          quantityUnit: getUnit(),
          conductorGroupId: groupId,
          extraRequests,
        });
      } else {
        await onAdd({
          variables: Object.keys(formVars).length > 0 ? formVars : null,
          quantity: parseFloat(formQty) || 1,
          note: formNote || null,
          quantityUnit: getUnit(),
        });
      }
    } catch {
      setError("Failed to add item.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-blue-50 border border-[#002D72]/20 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-[#002D72]">{item.lingo ?? item.name}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
      </div>

      {/* Variable form */}
      <div className="space-y-2 mb-3">
        {isThhn ? (
          <ThhnWireForm
            vars={formVars}
            setVars={setFormVars}
            multiMode={multiMode}
            setMultiMode={setMultiMode}
            conductors={conductors}
            setConductors={setConductors}
          />
        ) : isMcRomex ? (
          <McRomexWireForm vars={formVars} setVars={setFormVars} />
        ) : (
          item.variables && item.variables.length > 0 && item.variables.map(v => (
            <div key={v.key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{v.label}{v.required && " *"}</label>
              {v.type === "select" && v.options ? (
                <select value={formVars[v.key] ?? ""} onChange={e => setFormVars({ ...formVars, [v.key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
                  <option value="">Select…</option>
                  {v.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type="text" value={formVars[v.key] ?? ""} onChange={e => setFormVars({ ...formVars, [v.key]: e.target.value })}
                  placeholder={v.placeholder ?? ""}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Qty + Note */}
      {!(isThhn && multiMode) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Qty <span className="text-gray-400 font-normal">({getUnit()})</span></label>
            <input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} min="0.5" step="0.5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
            <input type="text" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Optional…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
          </div>
        </div>
      )}

      {isThhn && multiMode && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Footage / Qty <span className="text-gray-400 font-normal">({getUnit()})</span></label>
            <input type="number" value={formQty} onChange={e => setFormQty(e.target.value)} min="1" step="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
            <input type="text" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Optional…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {hasSpecialForm && !isThhn && !isMcRomex && null}

      <button onClick={handleAdd} disabled={adding}
        className="w-full bg-[#002D72] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors">
        {adding ? "Adding…" : isThhn && multiMode ? `Add ${conductors.filter(c => c.color).length} Conductors to Order` : "Add to Order"}
      </button>
    </div>
  );
}

// Inline category-level custom adder (compact form)
function CategoryCustomAdder({
  catName,
  items,
  onAdd,
  onCancel,
}: {
  catName: string;
  items: StockItem[];
  onAdd: (data: {
    customItemName: string;
    customCategory: string;
    variables: null;
    quantity: number;
    quantityUnit: string;
    note: string | null;
    saveToMasterList: boolean;
    isConsumableOverride: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [uom, setUom] = useState("EA");
  const [isConsumable, setIsConsumable] = useState(false);
  const [saveToMaster, setSaveToMaster] = useState(false);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suppress unused warning
  void items;

  async function handleAdd() {
    if (!name.trim()) { setError("Item name is required."); return; }
    setAdding(true);
    setError(null);
    try {
      await onAdd({
        customItemName: name.trim(),
        customCategory: catName,
        variables: null,
        quantity: parseFloat(qty) || 1,
        quantityUnit: uom,
        note: note || null,
        saveToMasterList: saveToMaster,
        isConsumableOverride: isConsumable,
      });
    } catch {
      setError("Failed to add item.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mt-2 mb-3 bg-orange-50 border border-[#FF5910]/20 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[#FF5910]">Custom {catName}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X className="w-3.5 h-3.5" /></button>
      </div>
      <div className="space-y-2">
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Item name *"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">UOM</label>
            <select value={uom} onChange={e => setUom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30">
              {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
          </div>
        </div>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isConsumable} onChange={e => setIsConsumable(e.target.checked)}
              className="rounded border-gray-300 text-[#FF5910]" />
            Consumable (pickup)
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={saveToMaster} onChange={e => setSaveToMaster(e.target.checked)}
              className="rounded border-gray-300 text-[#002D72]" />
            Save to Master
          </label>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleAdd} disabled={adding}
          className="w-full bg-[#FF5910] text-white py-1.5 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60 transition-colors">
          {adding ? "Adding…" : "Add to Order"}
        </button>
      </div>
    </div>
  );
}

// Custom item form (full — used for global "Add Custom Item")
function CustomItemForm({
  items,
  suppliers,
  onAdd,
  onCancel,
}: {
  items: StockItem[];
  suppliers: Supplier[];
  onAdd: (data: {
    customItemName: string;
    customCategory: string;
    variables: null;
    quantity: number;
    quantityUnit: string;
    note: string | null;
    saveToMasterList: boolean;
    isConsumableOverride: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Misc Hardware & Specialty");
  const [lingo, setLingo] = useState("");
  const [sku, setSku] = useState("");
  const [uom, setUom] = useState("EA");
  const [isConsumable, setIsConsumable] = useState(false);
  const [saveToMaster, setSaveToMaster] = useState(false);
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suppress unused warnings for lingo/sku (kept for UI completeness)
  void lingo;
  void sku;
  void suppliers;

  // Get unique categories from items plus default list
  const existingCats = [...new Set(items.map(i => i.category))];
  const allCats = [...new Set([...existingCats, ...ALL_CATEGORIES])].sort();

  async function handleAdd() {
    if (!name.trim()) { setError("Item name is required."); return; }
    setAdding(true);
    setError(null);
    try {
      await onAdd({
        customItemName: name.trim(),
        customCategory: category,
        variables: null,
        quantity: parseFloat(qty) || 1,
        quantityUnit: uom,
        note: note || null,
        saveToMasterList: saveToMaster,
        isConsumableOverride: isConsumable,
      });
    } catch {
      setError("Failed to add item.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mb-4 bg-orange-50 border border-[#FF5910]/20 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-[#FF5910]">Custom Item</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30">
              {allCats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Unit of Measure</label>
            <select value={uom} onChange={e => setUom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30">
              {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Item name *"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={lingo} onChange={e => setLingo(e.target.value)} placeholder="Trade name / lingo (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
          <input type="text" value={sku} onChange={e => setSku(e.target.value)} placeholder="SKU (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
            <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Note</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5910]/30" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={isConsumable} onChange={e => setIsConsumable(e.target.checked)}
              className="rounded border-gray-300 text-[#FF5910]" />
            Is Consumable (pickup list)
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked={saveToMaster} onChange={e => setSaveToMaster(e.target.checked)}
              className="rounded border-gray-300 text-[#002D72]" />
            Save to Master List
          </label>
        </div>
        {saveToMaster && (
          <p className="text-xs text-[#002D72] bg-blue-50 rounded px-2 py-1">
            This item will be permanently added to the stock list after ordering. Admin will be notified.
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button onClick={handleAdd} disabled={adding}
          className="w-full bg-[#FF5910] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#e04d0e] disabled:opacity-60 transition-colors">
          {adding ? "Adding…" : "Add to Order"}
        </button>
      </div>
    </div>
  );
}

export function CribTab({ job, role, currentUserId }: CribTabProps) {
  const [items, setItems] = useState<StockItem[]>([]);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const [categoryCustomExpanded, setCategoryCustomExpanded] = useState<string | null>(null);

  // suppress unused warning
  void currentUserId;

  const canReviewApprovals = role === "ADMIN" || role === "FOREMAN";

  const refreshRequests = useCallback(async () => {
    const data = await fetch(`/api/jobs/${job.id}/stock-requests`).then(r => r.json());
    setRequests(Array.isArray(data) ? data : []);
  }, [job.id]);

  const refreshApprovals = useCallback(async () => {
    if (!canReviewApprovals) return;
    const data = await fetch(`/api/jobs/${job.id}/stock-requests/pending-approval`).then(r => r.json());
    setPendingApprovals(Array.isArray(data) ? data : []);
  }, [job.id, canReviewApprovals]);

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

    if (canReviewApprovals) {
      fetch(`/api/jobs/${job.id}/stock-requests/pending-approval`).then(r => r.json())
        .then(data => setPendingApprovals(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [job.id, canReviewApprovals]);

  async function handleAddFromExpand(item: StockItem, data: {
    variables: Record<string, string> | null;
    quantity: number;
    note: string | null;
    quantityUnit: string;
    conductorGroupId?: string | null;
    extraRequests?: Array<{ variables: Record<string, string>; quantity: number; quantityUnit: string; note: string | null; conductorGroupId: string }>;
  }) {
    // Post the primary request
    await fetch(`/api/jobs/${job.id}/stock-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockItemId: item.id,
        variables: data.variables,
        quantity: data.quantity,
        quantityUnit: data.quantityUnit,
        note: data.note,
        deliveryMethod: "PICKUP",
        conductorGroupId: data.conductorGroupId ?? null,
      }),
    });

    // Post extra conductor requests if multi-conductor
    if (data.extraRequests && data.extraRequests.length > 0) {
      for (const extra of data.extraRequests) {
        await fetch(`/api/jobs/${job.id}/stock-requests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockItemId: item.id,
            variables: extra.variables,
            quantity: extra.quantity,
            quantityUnit: extra.quantityUnit,
            note: extra.note,
            deliveryMethod: "PICKUP",
            conductorGroupId: extra.conductorGroupId,
          }),
        });
      }
    }

    setExpandedItemId(null);
    await refreshRequests();
  }

  async function handleAddCustom(data: {
    customItemName: string;
    customCategory: string;
    variables: null;
    quantity: number;
    quantityUnit: string;
    note: string | null;
    saveToMasterList: boolean;
    isConsumableOverride: boolean;
  }) {
    await fetch(`/api/jobs/${job.id}/stock-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customItemName: data.customItemName,
        customCategory: data.customCategory,
        variables: null,
        quantity: data.quantity,
        quantityUnit: data.quantityUnit,
        note: data.note,
        deliveryMethod: "PICKUP",
        saveToMasterList: data.saveToMasterList,
        isConsumableOverride: data.isConsumableOverride,
      }),
    });
    setShowCustom(false);
    setCategoryCustomExpanded(null);
    await refreshRequests();
  }

  async function handleDelete(requestId: string) {
    await fetch(`/api/jobs/${job.id}/stock-requests/${requestId}`, { method: "DELETE" });
    await refreshRequests();
  }

  async function handleApprove(approvalId: string) {
    await fetch(`/api/jobs/${job.id}/stock-approval/${approvalId}/approve`, { method: "POST" });
    await refreshApprovals();
    await refreshRequests();
  }

  async function handleReject(approvalId: string) {
    const reason = prompt("Reason for rejection (optional):") ?? "";
    await fetch(`/api/jobs/${job.id}/stock-approval/${approvalId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    await refreshApprovals();
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
  const pendingApprovalRequestsToday = requests.filter(r => r.status === "PENDING_APPROVAL");
  const sentRequests = requests.filter(r => r.status === "SENT");

  // Group conductor requests
  const conductorGroups: Record<string, StockRequest[]> = {};
  const ungroupedRequests: StockRequest[] = [];
  for (const req of pendingRequests) {
    if (req.conductorGroupId) {
      if (!conductorGroups[req.conductorGroupId]) conductorGroups[req.conductorGroupId] = [];
      conductorGroups[req.conductorGroupId].push(req);
    } else {
      ungroupedRequests.push(req);
    }
  }

  function renderCategory(catItems: StockItem[], catName: string) {
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < catItems.length; i += 2) {
      const left = catItems[i];
      const right = catItems[i + 1];
      const isLeftExpanded = expandedItemId === left?.id;
      const isRightExpanded = right && expandedItemId === right?.id;
      const expandedItem = isLeftExpanded ? left : (isRightExpanded ? right : null);

      rows.push(
        <div key={`row-${i}`} className="grid grid-cols-2 gap-2 mb-2">
          {left && (
            <button onClick={() => {
              setExpandedItemId(expandedItemId === left.id ? null : left.id);
              setCategoryCustomExpanded(null);
            }}
              className={`text-left p-2.5 rounded-xl border text-sm transition-colors ${
                isLeftExpanded ? "bg-[#002D72] text-white border-[#002D72]" : "bg-white border-gray-200 hover:border-[#002D72]/50 hover:bg-blue-50"
              }`}>
              <p className="font-medium leading-tight">{left.name}</p>
              {left.lingo && left.lingo !== left.name && (
                <p className={`text-xs mt-0.5 ${isLeftExpanded ? "text-blue-200" : "text-gray-400"}`}>{left.lingo}</p>
              )}
              {left.notes && (
                <p className={`text-xs mt-0.5 italic ${isLeftExpanded ? "text-blue-200" : "text-orange-500"}`}>{left.notes}</p>
              )}
              {isLeftExpanded && <ChevronUp className="w-3 h-3 mt-1 opacity-70" />}
              {!isLeftExpanded && <ChevronDown className="w-3 h-3 mt-1 opacity-30" />}
            </button>
          )}
          {right ? (
            <button onClick={() => {
              setExpandedItemId(expandedItemId === right.id ? null : right.id);
              setCategoryCustomExpanded(null);
            }}
              className={`text-left p-2.5 rounded-xl border text-sm transition-colors ${
                isRightExpanded ? "bg-[#002D72] text-white border-[#002D72]" : "bg-white border-gray-200 hover:border-[#002D72]/50 hover:bg-blue-50"
              }`}>
              <p className="font-medium leading-tight">{right.name}</p>
              {right.lingo && right.lingo !== right.name && (
                <p className={`text-xs mt-0.5 ${isRightExpanded ? "text-blue-200" : "text-gray-400"}`}>{right.lingo}</p>
              )}
              {right.notes && (
                <p className={`text-xs mt-0.5 italic ${isRightExpanded ? "text-blue-200" : "text-orange-500"}`}>{right.notes}</p>
              )}
              {isRightExpanded && <ChevronUp className="w-3 h-3 mt-1 opacity-70" />}
              {!isRightExpanded && <ChevronDown className="w-3 h-3 mt-1 opacity-30" />}
            </button>
          ) : <div />}
        </div>
      );

      if (expandedItem) {
        rows.push(
          <div key={`expand-${expandedItem.id}`} className="mb-3 -mt-1">
            <ItemExpandForm
              item={expandedItem}
              onAdd={(data) => handleAddFromExpand(expandedItem, data)}
              onCancel={() => setExpandedItemId(null)}
            />
          </div>
        );
      }
    }

    // Category-level custom adder button
    if (categoryCustomExpanded === catName) {
      rows.push(
        <CategoryCustomAdder
          key={`cat-custom-${catName}`}
          catName={catName}
          items={catItems}
          onAdd={handleAddCustom}
          onCancel={() => setCategoryCustomExpanded(null)}
        />
      );
    } else {
      rows.push(
        <button
          key={`cat-custom-btn-${catName}`}
          onClick={() => {
            setCategoryCustomExpanded(catName);
            setExpandedItemId(null);
            setShowCustom(false);
          }}
          className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-gray-200 rounded-lg text-xs text-gray-400 hover:border-[#FF5910]/40 hover:text-[#FF5910] transition-colors">
          <Plus className="w-3 h-3" /> Add Custom {catName}
        </button>
      );
    }

    return rows;
  }

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
          {pendingApprovals.length > 0 && canReviewApprovals && (
            <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Clock className="w-3 h-3" /> {pendingApprovals.length} pending
            </span>
          )}
          {(pendingRequests.length > 0 || pendingApprovalRequestsToday.length > 0) && (
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-1.5 bg-[#FF5910] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#e04d0e] transition-colors">
              <Send className="w-4 h-4" /> Send Order
            </button>
          )}
        </div>
      </div>

      {/* Approval message */}
      {approvalMessage && (
        <div className="mb-4 bg-yellow-50 border border-yellow-300 rounded-xl px-3 py-2 text-sm text-yellow-800">
          {approvalMessage}
        </div>
      )}

      {/* Pending approvals section (Foreman/Admin only) */}
      {canReviewApprovals && pendingApprovals.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-yellow-700 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Approval ({pendingApprovals.length})
          </h3>
          <div className="space-y-3">
            {pendingApprovals.map(approval => (
              <div key={approval.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">{approval.requestedBy.name ?? "Unknown"}</p>
                  <span className="text-xs text-gray-400">{timeAgo(approval.createdAt)}</span>
                </div>
                <div className="space-y-1 mb-3">
                  {approval.requests.map(req => (
                    <p key={req.id} className="text-xs text-gray-700">
                      • {formatRequestDisplay(req)}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(approval.id)}
                    className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                    Approve & Send
                  </button>
                  <button onClick={() => handleReject(approval.id)}
                    className="flex-1 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or lingo…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 focus:border-[#002D72]"
        />
      </div>

      {/* Today's Requests */}
      {requests.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Today&apos;s Order ({pendingRequests.length})</h3>
          <div className="space-y-2">
            {/* Ungrouped requests */}
            {ungroupedRequests.map(req => (
              <div key={req.id} className="flex items-start gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {req.quantity} {req.quantityUnit ?? "EA"} — {req.stockItem?.name ?? req.customItemName}
                  </p>
                  {req.variables && Object.keys(req.variables).length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">{formatVariables(req.variables)}</p>
                  )}
                  {req.note && <p className="text-xs text-gray-400 mt-0.5 italic">{req.note}</p>}
                  <span className="text-xs text-gray-400">{req.user.name} · {timeAgo(req.createdAt)}</span>
                </div>
                <button onClick={() => handleDelete(req.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Conductor groups */}
            {Object.entries(conductorGroups).map(([groupId, groupReqs]) => (
              <ConductorGroupCard key={groupId} groupId={groupId} requests={groupReqs} onDelete={handleDelete} />
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

      {/* Custom item button */}
      {!showCustom && (
        <button onClick={() => { setShowCustom(true); setExpandedItemId(null); setCategoryCustomExpanded(null); }}
          className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#002D72] hover:text-[#002D72] transition-colors">
          <Plus className="w-4 h-4" /> Add Custom Item
        </button>
      )}

      {/* Custom item form */}
      {showCustom && (
        <CustomItemForm
          items={items}
          suppliers={suppliers}
          onAdd={handleAddCustom}
          onCancel={() => setShowCustom(false)}
        />
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
              {renderCategory(catItems, cat)}
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
                {renderCategory(catItems, cat)}
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
          role={role}
          onClose={() => setShowSendModal(false)}
          onSent={async (pendingApproval) => {
            setShowSendModal(false);
            await refreshRequests();
            if (pendingApproval) {
              setApprovalMessage("Order submitted for approval! The Foreman and Admin will be notified.");
            }
          }}
        />
      )}
    </div>
  );
}

// Conductor group card
function ConductorGroupCard({ groupId, requests, onDelete }: {
  groupId: string;
  requests: StockRequest[];
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  // suppress unused warning
  void groupId;
  return (
    <div className="bg-white border border-[#002D72]/20 rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <div>
          <p className="text-sm font-semibold text-[#002D72]">THHN Multi-Conductor Set ({requests.length} conductors)</p>
          <p className="text-xs text-gray-400">{requests[0]?.variables?.size ?? ""} AWG — {requests[0]?.variables?.footage ? `${requests[0].variables.footage} ft each` : ""}</p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1">
          {requests.map((req, i) => (
            <div key={req.id} className="flex items-center justify-between">
              <p className="text-xs text-gray-700">Conductor {i + 1}: {req.variables?.color ?? "—"} — {req.quantity} {req.quantityUnit ?? "FT"}</p>
              <button onClick={() => onDelete(req.id)} className="p-1 text-gray-300 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SendOrderModal({ job, requests, suppliers, role, onClose, onSent }: {
  job: CribTabProps["job"];
  requests: StockRequest[];
  suppliers: Supplier[];
  role: string;
  onClose: () => void;
  onSent: (pendingApproval?: boolean) => void;
}) {
  const electricalSuppliers = suppliers.filter(s => !s.pickupOnly);

  // Correct routing: consumable if stock item is consumable, OR isConsumableOverride is set
  const electricalRequests = requests.filter(r =>
    !(r.stockItem?.isConsumable ?? false) && !r.isConsumableOverride
  );
  const consumableRequests = requests.filter(r =>
    (r.stockItem?.isConsumable ?? false) || r.isConsumableOverride
  );

  // Step 1: delivery method selection; Step 2: rest of form
  const [step, setStep] = useState<1 | 2>(1);
  const [supplierName, setSupplierName] = useState(electricalSuppliers[0]?.name ?? "");
  const [supplierEmail, setSupplierEmail] = useState(
    electricalSuppliers[0]?.contacts?.find(c => c.isPrimary)?.email ?? electricalSuppliers[0]?.email ?? ""
  );
  const [poNumber, setPoNumber] = useState(job.jobNumber);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'ORDER' | 'QUOTE' | 'COMPETITIVE_QUOTE'>('ORDER');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [ccForemanOn, setCcForemanOn] = useState(true);

  const jobAddress = [job.address, job.city, job.state].filter(Boolean).join(", ");

  const isTeammate = role === "TEAMMATE";

  // Jump to step 2 immediately when a quote mode is selected (no delivery step needed)
  useEffect(() => {
    if (orderType !== 'ORDER') {
      setStep(2);
    }
  }, [orderType]);

  const deliveryOptions = [
    { value: "PICKUP", label: "Pickup", icon: Store, subtitle: "Items picked up at supplier" },
    { value: "DELIVERY_SITE", label: "Delivery to Site", icon: Truck, subtitle: jobAddress || "Job site address" },
    { value: "DELIVERY_SHOP", label: "Delivery to Shop", icon: Package2, subtitle: "209 W. River Rd, Hooksett, NH 03106" },
  ];

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      // Confirmation dialog for quote modes
      if (orderType !== 'ORDER') {
        const vendorList =
          orderType === 'COMPETITIVE_QUOTE'
            ? selectedVendors.join(', ')
            : supplierName;

        const confirmed = window.confirm(
          `You are sending a QUOTE REQUEST — not a purchase order.\n\n` +
          `Vendor(s): ${vendorList}\n\n` +
          `No materials will be ordered until you review ` +
          `and approve the quoted pricing.\n\n` +
          `Send quote request?`
        );
        if (!confirmed) { setSending(false); return; }
      }

      const electricalIds = electricalRequests.map(r => r.id);

      type OrderGroup = {
        supplierName:       string;
        supplierEmail:      string | null;
        deliveryMethod:     string;
        requestIds:         string[];
        isConsumables:      boolean;
        orderType:          string;
        additionalCcEmails: string[];
        ccForeman:          boolean;
      };

      let groups: OrderGroup[];

      if (orderType === 'COMPETITIVE_QUOTE') {
        groups = selectedVendors.map(vendorName => {
          const supplier = suppliers.find(s => s.name === vendorName);
          return {
            supplierName:       vendorName,
            supplierEmail:      supplier?.email ?? '',
            deliveryMethod:     'QUOTE',
            requestIds:         electricalIds,
            isConsumables:      false,
            orderType:          'COMPETITIVE_QUOTE',
            additionalCcEmails: ccEmails,
            ccForeman:          ccForemanOn,
          };
        });
        if (groups.length === 0) { setError("Please select at least one vendor."); setSending(false); return; }
      } else if (orderType === 'QUOTE') {
        groups = [{
          supplierName:       supplierName,
          supplierEmail:      supplierEmail,
          deliveryMethod:     'QUOTE',
          requestIds:         electricalIds,
          isConsumables:      false,
          orderType:          'QUOTE',
          additionalCcEmails: ccEmails,
          ccForeman:          ccForemanOn,
        }];
      } else {
        groups = [];
        if (electricalRequests.length > 0) {
          groups.push({
            supplierName:       supplierName,
            supplierEmail:      supplierEmail,
            deliveryMethod:     deliveryMethod ?? 'PICKUP',
            requestIds:         electricalIds,
            isConsumables:      false,
            orderType:          'ORDER',
            additionalCcEmails: ccEmails,
            ccForeman:          ccForemanOn,
          });
        }
        if (consumableRequests.length > 0) {
          groups.push({
            supplierName:       'Pickup',
            supplierEmail:      null,
            deliveryMethod:     'PICKUP',
            requestIds:         consumableRequests.map(r => r.id),
            isConsumables:      true,
            orderType:          'ORDER',
            additionalCcEmails: ccEmails,
            ccForeman:          ccForemanOn,
          });
        }
      }

      if (groups.length === 0) { setError("No items to send."); setSending(false); return; }

      const res = await fetch(`/api/jobs/${job.id}/stock-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups, poNumber, deliveryNotes, deliveryMethod: deliveryMethod ?? "PICKUP" }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.message ?? data.error ?? "Failed to send order"); return; }

      if (data.pendingApproval) {
        onSent(true);
      } else {
        onSent(false);
      }
    } catch {
      setError("Failed to send order.");
    } finally {
      setSending(false);
    }
  }

  const submitLabel =
    orderType === 'COMPETITIVE_QUOTE'
      ? selectedVendors.length > 0
        ? `Send to ${selectedVendors.length} Vendor${selectedVendors.length !== 1 ? 's' : ''}`
        : 'Select Vendors'
      : orderType === 'QUOTE'
      ? 'Send Quote Request'
      : isTeammate
      ? 'Submit for Approval'
      : 'Send Order';

  const submitDisabled = sending || (orderType === 'COMPETITIVE_QUOTE' && selectedVendors.length === 0);
  const submitColor = orderType === 'ORDER'
    ? 'bg-[#FF5910] hover:bg-[#e04d0e]'
    : 'bg-[#1a3a5c] hover:bg-[#2e5a8c]';

  const submitDesc = (orderType === 'ORDER' && isTeammate)
    ? "Your order will be submitted for approval. The Foreman and Admin will be notified to review."
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-[#002D72]">Send Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
        </div>

        {step === 1 && (
          <div className="p-4 space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-gray-900 mb-1">{requests.length} items · {job.jobNumber} {job.jobName}</p>
              <p className="text-gray-500 text-xs">
                {electricalRequests.length} electrical, {consumableRequests.length} consumable
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-3">How are you receiving the materials?</label>
              <div className="space-y-2">
                {deliveryOptions.map(opt => (
                  <button key={opt.value} onClick={() => setDeliveryMethod(opt.value)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                      deliveryMethod === opt.value
                        ? "bg-[#002D72]/5 border-[#002D72]"
                        : "bg-white border-gray-200 hover:border-[#002D72]/40"
                    }`}>
                    <div className={`p-2 rounded-lg ${deliveryMethod === opt.value ? "bg-[#002D72] text-white" : "bg-gray-100 text-gray-500"}`}>
                      <opt.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${deliveryMethod === opt.value ? "text-[#002D72]" : "text-gray-800"}`}>{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.subtitle}</p>
                    </div>
                    {deliveryMethod === opt.value && (
                      <div className="ml-auto w-4 h-4 rounded-full bg-[#002D72] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">(Consumables always go to pickup list regardless)</p>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!deliveryMethod}
              className="w-full py-3 bg-[#002D72] text-white rounded-xl text-sm font-medium hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              Continue →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="p-4 space-y-4">
            {orderType === 'ORDER' && (
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-[#002D72] hover:underline">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}

            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-semibold text-gray-900 mb-1">{requests.length} items · {job.jobNumber} {job.jobName}</p>
              <p className="text-gray-500 text-xs">
                {electricalRequests.length} electrical
                {orderType === 'ORDER' && `, ${consumableRequests.length} consumable · ${deliveryOptions.find(o => o.value === deliveryMethod)?.label}`}
              </p>
            </div>

            {/* Order type selector */}
            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-gray-500 block mb-2">
                Order Type
              </label>
              <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                {([
                  { value: 'ORDER' as const,            label: 'Order' },
                  { value: 'QUOTE' as const,            label: 'Quote Request' },
                  { value: 'COMPETITIVE_QUOTE' as const, label: 'Competitive Quote' },
                ]).map((t, i, arr) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setOrderType(t.value)}
                    className={`flex-1 py-2 px-3 text-sm font-semibold transition-colors ${
                      i < arr.length - 1 ? 'border-r border-gray-300' : ''
                    } ${
                      orderType === t.value
                        ? 'bg-[#1a3a5c] text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1 italic">
                {orderType === 'ORDER' && 'Purchase order — materials will be ordered'}
                {orderType === 'QUOTE' && 'Request pricing from one vendor — not an order'}
                {orderType === 'COMPETITIVE_QUOTE' && 'Send to multiple vendors — looking for best pricing'}
              </p>
            </div>

            {/* Supplier — single dropdown for ORDER/QUOTE, multi-checklist for COMPETITIVE_QUOTE */}
            {electricalRequests.length > 0 && (
              orderType !== 'COMPETITIVE_QUOTE' ? (
                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Electrical Supplier</h3>
                  <div className="space-y-2">
                    <select value={supplierName} onChange={e => {
                      setSupplierName(e.target.value);
                      const sup = electricalSuppliers.find(s => s.name === e.target.value);
                      const primaryContact = sup?.contacts?.find(c => c.isPrimary);
                      setSupplierEmail(primaryContact?.email ?? sup?.email ?? "");
                      setCcEmails([]);
                    }} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30">
                      {electricalSuppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      <option value="custom">Custom…</option>
                    </select>
                    <input type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)}
                      placeholder="Rep email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase text-gray-500 block mb-2">
                    Select Vendors <span className="text-gray-400 font-normal normal-case ml-1">(choose multiple)</span>
                  </label>
                  <div className="border border-gray-300 rounded-lg overflow-hidden divide-y divide-gray-100">
                    {suppliers.filter(s => !s.pickupOnly).map(s => (
                      <label key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedVendors.includes(s.name)}
                          onChange={e => {
                            setSelectedVendors(prev =>
                              e.target.checked
                                ? [...prev, s.name]
                                : prev.filter(v => v !== s.name)
                            );
                          }}
                          className="w-4 h-4 accent-[#1a3a5c]"
                        />
                        <span className="text-sm text-gray-800">{s.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedVendors.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      {selectedVendors.length} vendor{selectedVendors.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )
            )}

            {/* CC selector */}
            <div>
              <label className="text-xs font-bold tracking-widest uppercase text-gray-500 block mb-2">
                CC (additional recipients)
              </label>

              {/* Selected CC chips */}
              {ccEmails.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {ccEmails.map(email => (
                    <span key={email} className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                      {email}
                      <button
                        type="button"
                        onClick={() => setCcEmails(prev => prev.filter(e => e !== email))}
                        className="text-blue-400 hover:text-blue-700 ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Supplier contacts dropdown (single-supplier modes only) */}
              {orderType !== 'COMPETITIVE_QUOTE' && (() => {
                const currentSupplier = electricalSuppliers.find(s => s.name === supplierName);
                const availableContacts = (currentSupplier?.contacts ?? []).filter(
                  c => c.email !== supplierEmail && !ccEmails.includes(c.email)
                );
                return availableContacts.length > 0 ? (
                  <select
                    value=""
                    onChange={e => {
                      if (e.target.value) setCcEmails(prev => [...prev, e.target.value]);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                  >
                    <option value="">+ Add contact from {supplierName}…</option>
                    {availableContacts.map(c => (
                      <option key={c.id} value={c.email}>{c.name} — {c.email}</option>
                    ))}
                  </select>
                ) : null;
              })()}

              {/* Freeform CC input */}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={ccInput}
                  onChange={e => setCcInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const trimmed = ccInput.trim();
                      if (trimmed && !ccEmails.includes(trimmed)) {
                        setCcEmails(prev => [...prev, trimmed]);
                        setCcInput('');
                      }
                    }
                  }}
                  placeholder="Add any email address…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = ccInput.trim();
                    if (trimmed && !ccEmails.includes(trimmed)) {
                      setCcEmails(prev => [...prev, trimmed]);
                      setCcInput('');
                    }
                  }}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Add
                </button>
              </div>

              {/* CC foreman toggle */}
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ccForemanOn}
                  onChange={e => setCcForemanOn(e.target.checked)}
                  className="w-4 h-4 accent-[#1a3a5c]"
                />
                CC job foreman (if assigned)
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Sam and Justin are always CC&apos;d automatically.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">PO / Job Number *</label>
              <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30" />
            </div>

            {orderType === 'ORDER' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Delivery Notes</label>
                <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows={2} placeholder="Special instructions…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 resize-none" />
              </div>
            )}

            {/* Order summary */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Order Summary</p>
              <div className="space-y-1">
                {requests.slice(0, 5).map(req => (
                  <p key={req.id} className="text-xs text-gray-600">
                    • {req.quantity} {req.quantityUnit ?? "EA"} — {req.stockItem?.name ?? req.customItemName}
                  </p>
                ))}
                {requests.length > 5 && (
                  <p className="text-xs text-gray-400">…and {requests.length - 5} more items</p>
                )}
              </div>
            </div>

            {submitDesc && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
                {submitDesc}
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSend} disabled={submitDisabled}
                className={`flex-1 py-2.5 ${submitColor} text-white rounded-xl text-sm font-medium disabled:opacity-60 transition-colors`}>
                {sending ? "Sending…" : submitLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
