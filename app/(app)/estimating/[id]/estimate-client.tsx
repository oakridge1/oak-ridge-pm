"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Layers, Zap, FileText, Book, BarChart3, Settings,
  Plus, Trash2, ChevronDown, Check, X, ArrowLeft, ExternalLink,
} from "lucide-react";
import { BOM, BOM_CATEGORIES } from "@/lib/bom";
import AssembliesTabComponent from "./tabs/assemblies-tab";
import type { BomItem } from "@/lib/bom";
import {
  calcBid, calcLine, fmt$, adjustLhr,
} from "@/lib/estimating";
import type {
  EstimateData, TakeoffItem, Assembly, PanelItem, PermitItem, SubItem,
  AssemblyType,
} from "@/lib/estimating";
import type { EstimateStatus } from "@/app/generated/prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type EstimateRow = {
  id: string;
  estimateNumber: string;
  name: string;
  clientName: string | null;
  address: string | null;
  status: EstimateStatus;
  jobNumberAssigned: string | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  awardedAt: string | null;
  laborRate: number;
  bulkMarkup: number;
  lightMarkup: number;
  permitMarkup: number;
  subMarkup: number;
  overhead: number;
  profit: number;
  nonProd: number;
  designFeePct: number;
  designFeeUserId: string | null;
  conditionMult: number;
  heightAdj: boolean;
  takeoffItems: unknown;
  assemblies: unknown;
  panelItems: unknown;
  permits: unknown;
  subs: unknown;
  notes: string | null;
  createdBy: { id: string; name: string | null } | null;
  designFeeUser: { id: string; name: string | null } | null;
  job: { id: string; jobNumber: string } | null;
};

interface Props {
  estimate: EstimateRow;
  isAdmin: boolean;
  currentUserId: string;
  estimatingUsers: Array<{ id: string; name: string | null; email: string }>;
}

const TABS = [
  { id: "takeoff",   label: "Takeoff",     Icon: ClipboardList },
  { id: "assemblies",label: "Assemblies",  Icon: Layers },
  { id: "panels",    label: "Panel Builder", Icon: Zap },
  { id: "permits",   label: "Permits & Subs", Icon: FileText },
  { id: "bom",       label: "BOM Reference", Icon: Book },
  { id: "bid",       label: "Bid Summary",  Icon: BarChart3 },
  { id: "settings",  label: "Settings",    Icon: Settings },
] as const;

type TabId = typeof TABS[number]["id"];

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const CONDITION_OPTIONS = [
  { value: 0.8,  label: "0.8 — Difficult" },
  { value: 0.9,  label: "0.9 — Slightly Difficult" },
  { value: 1.0,  label: "1.0 — Normal" },
  { value: 1.1,  label: "1.1 — Good" },
  { value: 1.2,  label: "1.2 — Excellent" },
  { value: 1.5,  label: "1.5 — Exceptional" },
];

const STATUS_OPTIONS: EstimateStatus[] = ["DRAFT", "SENT", "AWARDED", "LOST", "ARCHIVED"];

const STATUS_COLORS: Record<EstimateStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  AWARDED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function EstimateDetailClient({ estimate, isAdmin, currentUserId, estimatingUsers }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("takeoff");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // Field Tools status state
  const [fieldToolsOpen, setFieldToolsOpen] = useState(false);
  const [drawingCount, setDrawingCount] = useState<number | null>(null);
  const [counterAreaCount, setCounterAreaCount] = useState<number | null>(null);
  const [counterTotalItems, setCounterTotalItems] = useState<number | null>(null);

  // Load field tool status on mount
  useEffect(() => {
    async function loadFieldStatus() {
      try {
        const [drawRes, counterRes] = await Promise.all([
          fetch(`/api/takeoff-drawings?estimateId=${estimate.id}`),
          fetch(`/api/estimates/${estimate.id}/counter-areas`),
        ]);
        if (drawRes.ok) {
          const drawings = await drawRes.json();
          setDrawingCount(drawings.length);
        }
        if (counterRes.ok) {
          const areas = await counterRes.json();
          setCounterAreaCount(areas.length);
          const total = areas.reduce((s: number, a: { counts?: Record<string, number> }) =>
            s + Object.values(a.counts ?? {}).reduce((ss, v) => ss + (v > 0 ? 1 : 0), 0), 0);
          setCounterTotalItems(total);
        }
      } catch { /* silent */ }
    }
    loadFieldStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate.id]);

  // Live sync polling — check for takeoff updates every 10 seconds
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(estimate.updatedAt);

  // Estimate metadata
  const [status, setStatus] = useState<EstimateStatus>(estimate.status);
  const [name, setName] = useState(estimate.name);
  const [clientName, setClientName] = useState(estimate.clientName ?? "");
  const [address, setAddress] = useState(estimate.address ?? "");
  const [jobNumberAssigned, setJobNumberAssigned] = useState(estimate.jobNumberAssigned ?? "");
  const [jobNumberInput, setJobNumberInput] = useState(estimate.jobNumberAssigned ?? "");
  const [notes, setNotes] = useState(estimate.notes ?? "");

  // Settings
  const [laborRate, setLaborRate] = useState(estimate.laborRate);
  const [bulkMarkup, setBulkMarkup] = useState(estimate.bulkMarkup);
  const [lightMarkup, setLightMarkup] = useState(estimate.lightMarkup);
  const [permitMarkup, setPermitMarkup] = useState(estimate.permitMarkup);
  const [subMarkup, setSubMarkup] = useState(estimate.subMarkup);
  const [overhead, setOverhead] = useState(estimate.overhead);
  const [profit, setProfit] = useState(estimate.profit);
  const [nonProd, setNonProd] = useState(estimate.nonProd);
  const [designFeePct, setDesignFeePct] = useState(estimate.designFeePct);
  const [designFeeUserId, setDesignFeeUserId] = useState(estimate.designFeeUserId ?? "");
  const [conditionMult, setConditionMult] = useState(estimate.conditionMult);
  const [heightAdj, setHeightAdj] = useState(estimate.heightAdj);

  // Line items
  const [takeoffItems, setTakeoffItems] = useState<TakeoffItem[]>(
    Array.isArray(estimate.takeoffItems) ? (estimate.takeoffItems as TakeoffItem[]) : []
  );
  const [assemblies, setAssemblies] = useState<Assembly[]>(
    Array.isArray(estimate.assemblies) ? (estimate.assemblies as Assembly[]) : []
  );
  const [panelItems, setPanelItems] = useState<PanelItem[]>(
    Array.isArray(estimate.panelItems) ? (estimate.panelItems as PanelItem[]) : []
  );
  const [permits, setPermits] = useState<PermitItem[]>(
    Array.isArray(estimate.permits) ? (estimate.permits as PermitItem[]) : []
  );
  const [subs, setSubs] = useState<SubItem[]>(
    Array.isArray(estimate.subs) ? (estimate.subs as SubItem[]) : []
  );

  // Build estimateData object for calculations
  const estimateData: EstimateData = {
    laborRate, bulkMarkup, lightMarkup, permitMarkup, subMarkup,
    overhead, profit, nonProd, designFeePct, conditionMult, heightAdj,
    takeoffItems, assemblies, panelItems, permits, subs,
  };

  // Auto-save debounce
  const scheduleSave = useCallback(() => {
    if (isFirstRender.current) return;
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/estimates/${estimate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, clientName: clientName || null, address: address || null,
            status, notes: notes || null, jobNumberAssigned: jobNumberAssigned || null,
            laborRate, bulkMarkup, lightMarkup, permitMarkup, subMarkup,
            overhead, profit, nonProd, designFeePct,
            designFeeUserId: designFeeUserId || null,
            conditionMult, heightAdj,
            takeoffItems, assemblies, panelItems, permits, subs,
          }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 800);
  }, [
    estimate.id, name, clientName, address, status, notes,
    jobNumberAssigned, laborRate, bulkMarkup, lightMarkup, permitMarkup,
    subMarkup, overhead, profit, nonProd, designFeePct, designFeeUserId,
    conditionMult, heightAdj, takeoffItems, assemblies, panelItems, permits, subs,
  ]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleSave();
  }, [
    name, clientName, address, status, notes, jobNumberAssigned,
    laborRate, bulkMarkup, lightMarkup, permitMarkup, subMarkup,
    overhead, profit, nonProd, designFeePct, designFeeUserId,
    conditionMult, heightAdj, takeoffItems, assemblies, panelItems, permits, subs,
    scheduleSave,
  ]);

  // Live sync polling — detects updates from Takeoff tool and Counter tool
  const prevItemCount = useRef<number | null>(null);
  const prevAsmCount = useRef<number | null>(null);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/estimates/${estimate.id}?poll=1`);
        if (res.ok) {
          const updated = await res.json();
          if (updated.updatedAt !== lastUpdatedAt) {
            setLastUpdatedAt(updated.updatedAt);
            const newItems: unknown[] = Array.isArray(updated.takeoffItems) ? updated.takeoffItems : [];
            const newAsms: unknown[] = Array.isArray(updated.assemblies) ? updated.assemblies : [];
            const addedItems = prevItemCount.current !== null ? newItems.length - prevItemCount.current : 0;
            const addedAsms = prevAsmCount.current !== null ? newAsms.length - prevAsmCount.current : 0;
            const added = addedItems + addedAsms;
            setTakeoffItems(newItems as typeof takeoffItems);
            setAssemblies(newAsms as typeof assemblies);
            prevItemCount.current = newItems.length;
            prevAsmCount.current = newAsms.length;
            if (added > 0) {
              showToast(`Field tool synced — ${added} item${added !== 1 ? "s" : ""} added`);
            } else {
              showToast("Field tool synced — estimate updated");
            }
          }
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate.id, lastUpdatedAt]);

  async function handleCreateJob() {
    if (!confirm("Create a new job from this estimate? This cannot be undone.")) return;
    const res = await fetch(`/api/estimates/${estimate.id}/create-job`, { method: "POST" });
    if (!res.ok) { alert("Failed: " + await res.text()); return; }
    const data = await res.json();
    router.push(`/jobs/${data.jobId}`);
  }

  async function handleExportJson() {
    window.open(`/api/estimates/${estimate.id}/export`, "_blank");
  }

  async function handleExportPdf() {
    window.open(`/api/estimates/${estimate.id}/pdf`, "_blank");
  }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        if (json.takeoffItems) setTakeoffItems(json.takeoffItems);
        if (json.assemblies) setAssemblies(json.assemblies);
        if (json.panelItems) setPanelItems(json.panelItems);
        if (json.permits) setPermits(json.permits);
        if (json.subs) setSubs(json.subs);
        if (json.laborRate !== undefined) setLaborRate(json.laborRate);
        if (json.bulkMarkup !== undefined) setBulkMarkup(json.bulkMarkup);
        if (json.lightMarkup !== undefined) setLightMarkup(json.lightMarkup);
        if (json.permitMarkup !== undefined) setPermitMarkup(json.permitMarkup);
        if (json.subMarkup !== undefined) setSubMarkup(json.subMarkup);
        if (json.overhead !== undefined) setOverhead(json.overhead);
        if (json.profit !== undefined) setProfit(json.profit);
        if (json.nonProd !== undefined) setNonProd(json.nonProd);
        if (json.notes !== undefined) setNotes(json.notes ?? "");
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const totals = calcBid(estimateData);

  return (
    <div className="space-y-4 pb-12">
      {/* Toast notification */}
      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, background: "#002D72", color: "white", padding: "10px 18px", borderRadius: 8, fontSize: 13, boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          {toast}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/estimating")} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-gray-400">{estimate.estimateNumber}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[status]}`}>{status}</span>
              <span className={`text-xs ml-1 ${saveStatus === "saving" ? "text-amber-500" : saveStatus === "unsaved" ? "text-red-400" : "text-green-500"}`}>
                {saveStatus === "saving" ? "Saving…" : saveStatus === "unsaved" ? "Unsaved" : "Saved"}
              </span>
            </div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="text-lg font-bold text-gray-900 border-0 outline-none bg-transparent w-full mt-0.5 focus:ring-2 focus:ring-[#002D72] rounded px-1"
              placeholder="Estimate name"
            />
          </div>
        </div>
        {/* Field tool buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.open(`/estimating/${estimate.id}/takeoff`, "_blank", "noopener")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#002D72] text-[#002D72] rounded-lg hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Takeoff
          </button>
          <button
            onClick={() => window.open(`/estimating/${estimate.id}/counter`, "_blank", "noopener,width=430,height=900")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-[#FF5910] text-[#FF5910] rounded-lg hover:bg-orange-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Counter
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "border-[#002D72] text-[#002D72]"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Field Tools status panel */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setFieldToolsOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            Field Tools
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${fieldToolsOpen ? "rotate-180" : ""}`} />
        </button>
        {fieldToolsOpen && (
          <div className="border-t border-gray-200 divide-y divide-gray-100">
            {/* Takeoff status */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">PDF Takeoff</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {drawingCount === null ? "Loading…" : drawingCount === 0 ? "No drawings uploaded" : `${drawingCount} drawing${drawingCount !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={() => window.open(`/estimating/${estimate.id}/takeoff`, "_blank", "noopener")}
                className="flex items-center gap-1 text-xs font-medium text-[#002D72] border border-[#002D72] px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </button>
            </div>
            {/* Counter status */}
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">Counter Tool</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {counterAreaCount === null ? "Loading…" :
                    counterAreaCount === 0 ? "No areas yet" :
                    `${counterAreaCount} area${counterAreaCount !== 1 ? "s" : ""}${counterTotalItems !== null && counterTotalItems > 0 ? ` · ${counterTotalItems} item type${counterTotalItems !== 1 ? "s" : ""} counted` : ""}`}
                </p>
              </div>
              <button
                onClick={() => window.open(`/estimating/${estimate.id}/counter`, "_blank", "noopener,width=430,height=900")}
                className="flex items-center gap-1 text-xs font-medium text-[#FF5910] border border-[#FF5910] px-2.5 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "takeoff" && (
          <TakeoffTab
            items={takeoffItems}
            setItems={setTakeoffItems}
            data={estimateData}
            conditionMult={conditionMult}
            setConditionMult={setConditionMult}
            heightAdj={heightAdj}
            setHeightAdj={setHeightAdj}
          />
        )}
        {activeTab === "assemblies" && (
          <AssembliesTabComponent
            assemblies={assemblies}
            setAssemblies={setAssemblies}
            data={estimateData}
          />
        )}
        {activeTab === "panels" && (
          <PanelTab
            panelItems={panelItems}
            setPanelItems={setPanelItems}
            data={estimateData}
          />
        )}
        {activeTab === "permits" && (
          <PermitsSubsTab
            permits={permits}
            setPermits={setPermits}
            subs={subs}
            setSubs={setSubs}
            permitMarkup={permitMarkup}
            subMarkup={subMarkup}
          />
        )}
        {activeTab === "bom" && <BomReferenceTab />}
        {activeTab === "bid" && (
          <BidSummaryTab
            totals={totals}
            data={estimateData}
            status={status}
            setStatus={setStatus}
            isAdmin={isAdmin}
            estimate={estimate}
            jobNumberAssigned={jobNumberAssigned}
            jobNumberInput={jobNumberInput}
            setJobNumberInput={setJobNumberInput}
            setJobNumberAssigned={setJobNumberAssigned}
            onCreateJob={handleCreateJob}
            onExportPdf={handleExportPdf}
            onExportJson={handleExportJson}
          />
        )}
        {activeTab === "settings" && (
          <SettingsTab
            laborRate={laborRate} setLaborRate={setLaborRate}
            bulkMarkup={bulkMarkup} setBulkMarkup={setBulkMarkup}
            lightMarkup={lightMarkup} setLightMarkup={setLightMarkup}
            permitMarkup={permitMarkup} setPermitMarkup={setPermitMarkup}
            subMarkup={subMarkup} setSubMarkup={setSubMarkup}
            overhead={overhead} setOverhead={setOverhead}
            profit={profit} setProfit={setProfit}
            nonProd={nonProd} setNonProd={setNonProd}
            designFeePct={designFeePct} setDesignFeePct={setDesignFeePct}
            designFeeUserId={designFeeUserId} setDesignFeeUserId={setDesignFeeUserId}
            estimatingUsers={estimatingUsers}
            isAdmin={isAdmin}
            notes={notes} setNotes={setNotes}
            onImportJson={handleImportJson}
            clientName={clientName} setClientName={setClientName}
            address={address} setAddress={setAddress}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1: Takeoff
// ─────────────────────────────────────────────────────────────────────────────

function TakeoffTab({
  items, setItems, data, conditionMult, setConditionMult, heightAdj, setHeightAdj,
}: {
  items: TakeoffItem[];
  setItems: (items: TakeoffItem[]) => void;
  data: EstimateData;
  conditionMult: number;
  setConditionMult: (v: number) => void;
  heightAdj: boolean;
  setHeightAdj: (v: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const filtered = BOM.filter(b => {
    if (catFilter !== "All" && b.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.category.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function addItem(bom: BomItem) {
    const existing = items.find(i => i.bomId === bom.id);
    if (existing) {
      setItems(items.map(i => i.bomId === bom.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setItems([...items, { id: newId(), bomId: bom.id, qty: 1 }]);
    }
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) {
      setItems(items.filter(i => i.id !== id));
    } else {
      setItems(items.map(i => i.id === id ? { ...i, qty } : i));
    }
  }

  function removeItem(id: string) {
    setItems(items.filter(i => i.id !== id));
  }

  const sectionTotals = items.reduce(
    (acc, item) => {
      const line = calcLine(item, data);
      return { mat: acc.mat + line.mat, lhr: acc.lhr + line.lhr, labor: acc.labor + line.laborCost, total: acc.total + line.total };
    },
    { mat: 0, lhr: 0, labor: 0, total: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Condition controls */}
      <div className="flex flex-wrap gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Condition Multiplier</label>
          <select
            value={conditionMult}
            onChange={e => setConditionMult(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          >
            {CONDITION_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={heightAdj}
              onChange={e => setHeightAdj(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span>Height Adjustment (+15% labor)</span>
          </label>
        </div>
      </div>

      {/* BOM search */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Add Items from BOM</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items…"
            className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          >
            <option value="All">All Categories</option>
            {BOM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {filtered.map(bom => (
            <button
              key={bom.id}
              onClick={() => addItem(bom)}
              className="text-left p-2.5 rounded-lg border border-gray-200 hover:border-[#002D72] hover:bg-blue-50 transition-all text-sm group"
            >
              <div className="font-medium text-gray-900 group-hover:text-[#002D72] truncate">{bom.name}</div>
              <div className="text-xs text-gray-400 mt-0.5">{bom.category} · {fmt$(bom.mat)}/{bom.unit} · {bom.lhr.toFixed(3)} hr/{bom.unit}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Takeoff table */}
      {items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Takeoff Items</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Item</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Category</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Unit</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Mat Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Labor Hrs</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Labor Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const bom = BOM.find(b => b.id === item.bomId);
                  if (!bom) return null;
                  const line = calcLine(item, data);
                  return (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 max-w-[200px] truncate">{bom.name}</td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{bom.category}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={item.qty}
                          min={0}
                          onChange={e => updateQty(item.id, Number(e.target.value))}
                          className="w-16 border border-gray-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs">{bom.unit}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-mono text-xs">{fmt$(line.mat)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-mono text-xs">{line.lhr.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-gray-700 font-mono text-xs">{fmt$(line.laborCost)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900 font-mono text-xs">{fmt$(line.total)}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* Totals */}
                <tr className="bg-blue-50 border-t-2 border-[#002D72]/20">
                  <td colSpan={5} className="px-3 py-2 text-xs font-bold text-[#002D72]">SECTION TOTALS</td>
                  <td className="px-3 py-2 text-right font-bold text-[#002D72] font-mono text-xs">{fmt$(sectionTotals.mat)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#002D72] font-mono text-xs">{sectionTotals.lhr.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#002D72] font-mono text-xs">{fmt$(sectionTotals.labor)}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#002D72] font-mono text-xs">{fmt$(sectionTotals.total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2: Assemblies
// ─────────────────────────────────────────────────────────────────────────────

// AssembliesTab is now imported from ./tabs/assemblies-tab

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3: Panel Builder
// ─────────────────────────────────────────────────────────────────────────────

// Load centers / main panels (pg1, pg2, pg17 meter main)
const PANEL_BOMS = BOM.filter(b => b.category === "Panels & Gear" && (b.id === "pg1" || b.id === "pg2" || b.id === "pg17"));
// All breakers / overcurrent devices
const BREAKER_BOMS = BOM.filter(b => b.category === "Panels & Gear" && b.id !== "pg1" && b.id !== "pg2" && b.id !== "pg17");

function PanelTab({ panelItems, setPanelItems, data }: {
  panelItems: PanelItem[];
  setPanelItems: (p: PanelItem[]) => void;
  data: EstimateData;
}) {
  function addPanel(panelBomId: string) {
    setPanelItems([...panelItems, { id: newId(), panelBomId, breakerRows: [] }]);
  }

  function removePanel(id: string) {
    setPanelItems(panelItems.filter(p => p.id !== id));
  }

  function updatePanel(id: string, updater: (p: PanelItem) => PanelItem) {
    setPanelItems(panelItems.map(p => p.id === id ? updater(p) : p));
  }

  const sectionTotals = panelItems.reduce((acc, panel) => {
    const panelBom = BOM.find(b => b.id === panel.panelBomId);
    let mat = panelBom ? panelBom.mat * (1 + data.bulkMarkup) : 0;
    let lhr = panelBom ? adjustLhr(panelBom.lhr, data) : 0;
    for (const row of panel.breakerRows) {
      const brkBom = BOM.find(b => b.id === row.bomId);
      if (brkBom) {
        mat += brkBom.mat * row.qty * (1 + data.bulkMarkup);
        lhr += adjustLhr(brkBom.lhr * row.qty, data);
      }
    }
    return { mat: acc.mat + mat, lhr: acc.lhr + lhr };
  }, { mat: 0, lhr: 0 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PANEL_BOMS.length > 0 ? PANEL_BOMS.map(bom => (
          <button key={bom.id} onClick={() => addPanel(bom.id)} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#002D72]/30 text-[#002D72] rounded-lg hover:bg-blue-50 transition-colors">
            <Plus className="w-3.5 h-3.5" /> {bom.name}
          </button>
        )) : (
          <button onClick={() => addPanel("pg1")} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-[#002D72]/30 text-[#002D72] rounded-lg hover:bg-blue-50 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Panel
          </button>
        )}
      </div>

      {panelItems.map(panel => {
        const panelBom = BOM.find(b => b.id === panel.panelBomId);
        let panelMat = panelBom ? panelBom.mat * (1 + data.bulkMarkup) : 0;
        let panelLhr = panelBom ? adjustLhr(panelBom.lhr, data) : 0;
        for (const row of panel.breakerRows) {
          const brkBom = BOM.find(b => b.id === row.bomId);
          if (brkBom) {
            panelMat += brkBom.mat * row.qty * (1 + data.bulkMarkup);
            panelLhr += adjustLhr(brkBom.lhr * row.qty, data);
          }
        }

        return (
          <div key={panel.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#002D72] text-white">
              <div>
                <div className="font-semibold text-sm">{panelBom?.name ?? "Panel"}</div>
                <div className="text-xs text-blue-200 font-mono mt-0.5">Mat: {fmt$(panelMat)} · Hrs: {panelLhr.toFixed(2)} · Labor: {fmt$(panelLhr * data.laborRate)}</div>
              </div>
              <button onClick={() => removePanel(panel.id)} className="p-1.5 text-blue-200 hover:text-red-300 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {panel.breakerRows.map((row, idx) => {
                const brkBom = BOM.find(b => b.id === row.bomId);
                return (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <select
                      value={row.bomId}
                      onChange={e => updatePanel(panel.id, p => ({ ...p, breakerRows: p.breakerRows.map((r, i) => i === idx ? { ...r, bomId: e.target.value } : r) }))}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                    >
                      {BREAKER_BOMS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input
                      type="number"
                      value={row.qty}
                      min={1}
                      onChange={e => updatePanel(panel.id, p => ({ ...p, breakerRows: p.breakerRows.map((r, i) => i === idx ? { ...r, qty: Number(e.target.value) } : r) }))}
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                    />
                    <input
                      type="text"
                      value={row.circuit ?? ""}
                      onChange={e => updatePanel(panel.id, p => ({ ...p, breakerRows: p.breakerRows.map((r, i) => i === idx ? { ...r, circuit: e.target.value } : r) }))}
                      placeholder="Circuit label (optional)"
                      className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                    />
                    {brkBom && <span className="text-xs text-gray-400 font-mono">{fmt$(brkBom.mat * row.qty * (1 + data.bulkMarkup))}</span>}
                    <button
                      onClick={() => updatePanel(panel.id, p => ({ ...p, breakerRows: p.breakerRows.filter((_, i) => i !== idx) }))}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => updatePanel(panel.id, p => ({ ...p, breakerRows: [...p.breakerRows, { bomId: "p20", qty: 1, circuit: "" }] }))}
                className="flex items-center gap-1.5 text-sm text-[#002D72] hover:text-[#003d99] font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Breaker
              </button>
            </div>
          </div>
        );
      })}

      {panelItems.length > 0 && (
        <div className="p-3 bg-blue-50 rounded-xl text-sm font-semibold text-[#002D72] flex justify-between">
          <span>Panel Section Totals</span>
          <span className="font-mono">{fmt$(sectionTotals.mat + sectionTotals.lhr * data.laborRate)}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 4: Permits & Subs
// ─────────────────────────────────────────────────────────────────────────────

function PermitsSubsTab({ permits, setPermits, subs, setSubs, permitMarkup, subMarkup }: {
  permits: PermitItem[];
  setPermits: (p: PermitItem[]) => void;
  subs: SubItem[];
  setSubs: (s: SubItem[]) => void;
  permitMarkup: number;
  subMarkup: number;
}) {
  function addPermit() { setPermits([...permits, { id: newId(), description: "", amount: 0 }]); }
  function addSub() { setSubs([...subs, { id: newId(), description: "", amount: 0 }]); }

  const permitTotal = permits.reduce((s, p) => s + p.amount, 0);
  const permitMarkedUp = permitTotal * (1 + permitMarkup);
  const subTotal = subs.reduce((s, sub) => s + sub.amount, 0);
  const subMarkedUp = subTotal * (1 + subMarkup);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Permits */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Permits</h3>
          <button onClick={addPermit} className="flex items-center gap-1 text-sm text-[#002D72] hover:text-[#003d99] font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {permits.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                type="text"
                value={p.description}
                onChange={e => setPermits(permits.map(x => x.id === p.id ? { ...x, description: e.target.value } : x))}
                placeholder="Description"
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
              <input
                type="number"
                value={p.amount}
                min={0}
                step={0.01}
                onChange={e => setPermits(permits.map(x => x.id === p.id ? { ...x, amount: Number(e.target.value) } : x))}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
              <span className="text-xs text-gray-400 font-mono w-20 text-right">{fmt$(p.amount * (1 + permitMarkup))}</span>
              <button onClick={() => setPermits(permits.filter(x => x.id !== p.id))} className="p-1 text-gray-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {permits.length > 0 && (
          <div className="text-sm text-gray-600 border-t pt-2 flex justify-between">
            <span>Total w/ {(permitMarkup * 100).toFixed(0)}% markup</span>
            <span className="font-semibold font-mono">{fmt$(permitMarkedUp)}</span>
          </div>
        )}
      </div>

      {/* Subcontractors */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Subcontractors</h3>
          <button onClick={addSub} className="flex items-center gap-1 text-sm text-[#002D72] hover:text-[#003d99] font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {subs.map(s => (
            <div key={s.id} className="flex items-center gap-2">
              <input
                type="text"
                value={s.description}
                onChange={e => setSubs(subs.map(x => x.id === s.id ? { ...x, description: e.target.value } : x))}
                placeholder="Description"
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
              <input
                type="number"
                value={s.amount}
                min={0}
                step={0.01}
                onChange={e => setSubs(subs.map(x => x.id === s.id ? { ...x, amount: Number(e.target.value) } : x))}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
              <span className="text-xs text-gray-400 font-mono w-20 text-right">{fmt$(s.amount * (1 + subMarkup))}</span>
              <button onClick={() => setSubs(subs.filter(x => x.id !== s.id))} className="p-1 text-gray-300 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        {subs.length > 0 && (
          <div className="text-sm text-gray-600 border-t pt-2 flex justify-between">
            <span>Total w/ {(subMarkup * 100).toFixed(0)}% markup</span>
            <span className="font-semibold font-mono">{fmt$(subMarkedUp)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 5: BOM Reference
// ─────────────────────────────────────────────────────────────────────────────

function BomReferenceTab() {
  const [catFilter, setCatFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = BOM.filter(b => {
    if (catFilter !== "All" && b.category !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.id.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search BOM…"
          className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]">
          <option value="All">All Categories</option>
          {BOM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left font-semibold text-gray-500">ID</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Category</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Unit</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Mat Cost</th>
              <th className="px-3 py-2 text-right font-semibold text-gray-500">Labor Hrs</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-500">Markup</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-500">GCE Stock</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(b => (
              <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-gray-400">{b.id}</td>
                <td className="px-3 py-2 text-gray-900">{b.name}</td>
                <td className="px-3 py-2 text-gray-500">{b.category}</td>
                <td className="px-3 py-2 text-right text-gray-500">{b.unit}</td>
                <td className="px-3 py-2 text-right font-mono">{fmt$(b.mat)}</td>
                <td className="px-3 py-2 text-right font-mono">{b.lhr.toFixed(4)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${b.mk === "bulk" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    {b.mk}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  {b.gc ? <Check className="w-3.5 h-3.5 text-green-500 mx-auto" /> : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 6: Bid Summary
// ─────────────────────────────────────────────────────────────────────────────

function BidSummaryTab({
  totals, data, status, setStatus, isAdmin, estimate,
  jobNumberAssigned, jobNumberInput, setJobNumberInput, setJobNumberAssigned,
  onCreateJob, onExportPdf, onExportJson,
}: {
  totals: ReturnType<typeof calcBid>;
  data: EstimateData;
  status: EstimateStatus;
  setStatus: (s: EstimateStatus) => void;
  isAdmin: boolean;
  estimate: EstimateRow;
  jobNumberAssigned: string;
  jobNumberInput: string;
  setJobNumberInput: (v: string) => void;
  setJobNumberAssigned: (v: string) => void;
  onCreateJob: () => void;
  onExportPdf: () => void;
  onExportJson: () => void;
}) {
  function Row({ label, value, indent, bold, orange }: { label: string; value: string; indent?: boolean; bold?: boolean; orange?: boolean }) {
    return (
      <div className={`flex justify-between py-1.5 ${indent ? "pl-4" : ""}`}>
        <span className={`text-sm ${bold ? "font-semibold text-gray-900" : "text-gray-600"}`}>{label}</span>
        <span className={`font-mono text-sm ${bold ? "font-bold text-[#002D72]" : orange ? "text-[#FF5910] font-semibold" : "text-gray-700"}`}>{value}</span>
      </div>
    );
  }

  function Divider() {
    return <div className="border-t border-gray-200 my-2" />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status controls (admin only) */}
      {isAdmin && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-600">Status:</span>
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === s ? "bg-[#002D72] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Bid sheet */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-[#002D72] text-white px-6 py-4">
          <div className="text-xs text-blue-200 tracking-widest uppercase">Oak Ridge Electrical LLC</div>
          <div className="text-lg font-bold mt-1">Bid Summary</div>
        </div>
        <div className="px-6 py-4 space-y-1">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Materials</div>
          <Row label="Raw Material Total (marked up)" value={fmt$(totals.markedUpMat)} />
          <Divider />
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-3">Labor</div>
          <Row label="Total Labor Hours" value={`${totals.rawLhr.toFixed(2)} hrs`} />
          <Row label="Labor Rate" value={`${fmt$(data.laborRate)}/hr`} indent />
          <Row label="Raw Labor Cost" value={fmt$(totals.rawLabor)} indent />
          <Row label={`Overhead (${(data.overhead * 100).toFixed(0)}%)`} value={`+${fmt$(totals.laborWithOverhead - totals.rawLabor)}`} indent />
          <Row label="Labor with Overhead" value={fmt$(totals.laborWithOverhead)} bold />
          <Divider />
          <Row label="Subtotal (Mat + Labor w/ Overhead)" value={fmt$(totals.subtotal)} bold />
          <Row label={`Profit (${(data.profit * 100).toFixed(0)}%)`} value={`+${fmt$(totals.profit)}`} orange />
          <Divider />
          <Row label="Base Bid Total" value={fmt$(totals.grandTotal)} bold />
          {totals.permitTotal > 0 && <Row label="Permits" value={`+${fmt$(totals.permitTotal)}`} />}
          {totals.subTotal > 0 && <Row label="Subcontractors" value={`+${fmt$(totals.subTotal)}`} />}
        </div>
        <div className="bg-[#002D72]/5 border-t-2 border-[#002D72] px-6 py-4 flex justify-between items-center">
          <span className="text-base font-bold text-[#002D72]">GRAND TOTAL BID PRICE</span>
          <span className="text-xl font-bold text-[#002D72] font-mono">{fmt$(totals.grandWithSubs)}</span>
        </div>
        {totals.designFee > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex justify-between text-xs text-gray-400 italic">
            <span>Design Fee (internal — out of profit)</span>
            <span className="font-mono">{fmt$(totals.designFee)}</span>
          </div>
        )}
      </div>

      {/* Job number assignment (admin only) */}
      {isAdmin && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Job Number Assignment</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={jobNumberInput}
              onChange={e => setJobNumberInput(e.target.value)}
              placeholder="e.g. 2025-042"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            />
            <button
              onClick={() => setJobNumberAssigned(jobNumberInput)}
              className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
            >
              Assign
            </button>
          </div>
          {jobNumberAssigned && (
            <p className="text-xs text-green-600">Assigned: <strong>{jobNumberAssigned}</strong></p>
          )}
        </div>
      )}

      {/* Create job button (admin, AWARDED, jobNumberAssigned) */}
      {isAdmin && status === "AWARDED" && jobNumberAssigned && !estimate.job && (
        <button
          onClick={onCreateJob}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
        >
          Create Job from Estimate ({jobNumberAssigned})
        </button>
      )}

      {estimate.job && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
          <Check className="w-4 h-4" />
          Job created: <a href={`/jobs/${estimate.job.id}`} className="font-semibold underline">{estimate.job.jobNumber}</a>
        </div>
      )}

      {/* Export buttons */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={onExportPdf} className="flex items-center gap-2 border border-[#002D72] text-[#002D72] px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors">
          Export PDF
        </button>
        <button onClick={onExportJson} className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          Export JSON
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 7: Settings
// ─────────────────────────────────────────────────────────────────────────────

function SettingsTab({
  laborRate, setLaborRate,
  bulkMarkup, setBulkMarkup,
  lightMarkup, setLightMarkup,
  permitMarkup, setPermitMarkup,
  subMarkup, setSubMarkup,
  overhead, setOverhead,
  profit, setProfit,
  nonProd, setNonProd,
  designFeePct, setDesignFeePct,
  designFeeUserId, setDesignFeeUserId,
  estimatingUsers,
  isAdmin,
  notes, setNotes,
  onImportJson,
  clientName, setClientName,
  address, setAddress,
}: {
  laborRate: number; setLaborRate: (v: number) => void;
  bulkMarkup: number; setBulkMarkup: (v: number) => void;
  lightMarkup: number; setLightMarkup: (v: number) => void;
  permitMarkup: number; setPermitMarkup: (v: number) => void;
  subMarkup: number; setSubMarkup: (v: number) => void;
  overhead: number; setOverhead: (v: number) => void;
  profit: number; setProfit: (v: number) => void;
  nonProd: number; setNonProd: (v: number) => void;
  designFeePct: number; setDesignFeePct: (v: number) => void;
  designFeeUserId: string; setDesignFeeUserId: (v: string) => void;
  estimatingUsers: Array<{ id: string; name: string | null; email: string }>;
  isAdmin: boolean;
  notes: string; setNotes: (v: string) => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clientName: string; setClientName: (v: string) => void;
  address: string; setAddress: (v: string) => void;
}) {
  function PctInput({ label, value, setter }: { label: string; value: number; setter: (v: number) => void }) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={(value * 100).toFixed(1)}
            min={0}
            max={100}
            step={0.1}
            onChange={e => setter(Number(e.target.value) / 100)}
            className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Project info */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Project Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client Name</label>
            <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Optional"
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
          </div>
        </div>
      </div>

      {/* Rates */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Rates & Markups</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Labor Rate ($/hr)</label>
            <input type="number" value={laborRate} min={0} step={0.25} onChange={e => setLaborRate(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
          </div>
          <PctInput label="Bulk Markup %" value={bulkMarkup} setter={setBulkMarkup} />
          <PctInput label="Lighting Markup %" value={lightMarkup} setter={setLightMarkup} />
          <PctInput label="Permit Markup %" value={permitMarkup} setter={setPermitMarkup} />
          <PctInput label="Sub Markup %" value={subMarkup} setter={setSubMarkup} />
          <PctInput label="Overhead %" value={overhead} setter={setOverhead} />
          <PctInput label="Profit %" value={profit} setter={setProfit} />
          <PctInput label="Non-Productive Time %" value={nonProd} setter={setNonProd} />
        </div>
      </div>

      {/* Design Fee */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Design Fee</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Design Fee User</label>
            <select value={designFeeUserId} onChange={e => setDesignFeeUserId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]">
              <option value="">— None —</option>
              {estimatingUsers.map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
          </div>
          <PctInput label="Design Fee % (of profit)" value={designFeePct} setter={setDesignFeePct} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          placeholder="Internal notes about this estimate…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
        />
      </div>

      {/* Import JSON */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Import JSON</label>
        <p className="text-xs text-gray-400 mb-2">Import a previously exported estimate JSON file. This will replace the current estimate data.</p>
        <label className="flex items-center gap-2 cursor-pointer w-fit border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Choose JSON file
          <input type="file" accept=".json" onChange={onImportJson} className="hidden" />
        </label>
      </div>
    </div>
  );
}
