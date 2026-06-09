"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, BarChart3,
  Edit2, Save, Plus, Trash2, CreditCard, RefreshCw,
  FileText, ChevronDown, ChevronUp, Send, CheckCircle2, ExternalLink,
  Download, Mail, TrendingUp, TrendingDown, Link2, Upload, Building2,
} from "lucide-react";
import { useUpload } from "@/lib/use-upload";
import {
  updateDirectCostsWithMarkups,
  addOtherCost, deleteOtherCost,
  addPayment, deletePayment,
  createInvoice, updateInvoiceStatus, deleteInvoice,
} from "./summary-tab-actions";
import type { Role } from "@/app/generated/prisma/client";

// ── Scope section builder (mirrors ProposalTab) ────────────────────────────────
interface ScopeSection { id: string; title: string; items: string[] }

const PRELOADED_SCOPE_BULLETS: Record<string, string[]> = {
  "General": [
    "Furnish all labor, material, and equipment necessary for the electrical work described herein.",
    "All work to be performed in accordance with the current NEC and applicable local codes.",
    "Coordinate with other trades as required.",
  ],
  "Power Distribution": [
    "Install panelboard(s) as specified.",
    "Install feeders and branch circuits as shown on drawings.",
    "Install dedicated circuits for equipment as required.",
    "Install disconnect means as required by code.",
  ],
  "Lighting": [
    "Install interior lighting fixtures as specified.",
    "Install exterior lighting fixtures as specified.",
    "Install lighting controls (switches, dimmers, occupancy sensors) as specified.",
    "Provide lamp/LED source for all fixtures.",
  ],
  "Devices": [
    "Install receptacles throughout as indicated.",
    "Install GFCI receptacles in all wet/damp locations.",
    "Install AFCI breakers/receptacles as required by code.",
    "Install USB charging receptacles as specified.",
  ],
  "Equipment Connections": [
    "Provide final electrical connections to owner-furnished equipment.",
    "Install wiring and terminations for HVAC equipment.",
    "Install wiring and terminations for water heater(s).",
    "Install wiring and terminations for kitchen equipment.",
  ],
  "Service Work": [
    "Install new electrical service as specified.",
    "Upgrade existing electrical service.",
    "Install meter socket and service entrance conductors.",
    "Coordinate service installation with utility company.",
  ],
  "Fire Alarm": [
    "Install fire alarm devices (smoke detectors, pull stations, horns/strobes) as shown.",
    "Install fire alarm control panel.",
    "Program and test fire alarm system.",
    "Provide as-built drawings and owner training.",
  ],
  "Data/Low Voltage": [
    "Install structured cabling (Cat6) throughout.",
    "Install data outlets at locations shown.",
    "Install patch panels and network rack.",
    "Label all cables per TIA-606 standard.",
  ],
  "Security & Access Control": [
    "Install security cameras at locations shown.",
    "Install access control hardware and wiring.",
    "Install intercom/video doorbell system.",
    "Program and test security system.",
  ],
  "Audio/Visual": [
    "Install TV/display mounting and connections.",
    "Install in-ceiling speakers and amplifier.",
    "Install conduit for AV cabling.",
  ],
  "Demolition": [
    "Remove existing electrical equipment as indicated.",
    "Demo existing wiring not to be reused.",
    "Cap and label circuits removed from service.",
    "Properly dispose of all demolished materials.",
  ],
  "Closeout": [
    "Provide as-built drawings upon project completion.",
    "Test and verify all circuits prior to energizing.",
    "Label all panels, circuits, and equipment.",
    "Provide owner training on systems installed.",
  ],
  "Clarifications": [
    "Pricing based on plans and specifications dated as noted.",
    "Any changes to scope will be addressed via change order.",
    "Owner to provide unobstructed access to work areas.",
    "Excludes permit fees unless otherwise noted.",
  ],
};

type OtherCost = { id: string; description: string; amount: number; markupPct?: number };
type LaborEntryWithWage = {
  hours: number;
  user: {
    id: string;
    name: string | null;
    wage?: {
      title: string;
      year: string;
      hourlyWage: number;
      burdenRate: number;
      isFieldCrew: boolean;
    } | null;
  };
};
type PaymentEntry = {
  id: string; date: Date; amount: number; note: string | null;
  checkNumber: string | null; reference: string | null;
  receiptImageUrl: string | null;
  includesRetainageRelease: boolean;
  invoice: { id: string; invoiceNumber: number } | null;
};
type InvoiceEntry = {
  id: string; invoiceNumber: number; type: "STANDARD" | "AIA";
  date: Date; periodTo: Date | null; applicationNo: number | null;
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID";
  amount: number; retainagePct: number | null; retainageHeld: number | null;
  lineItems: unknown; notes: string | null;
  shareToken: string | null;
  payments: { id: string; amount: number }[];
};
type ChangeOrder = {
  id: string;
  status: string;
  approvedValue: number | null;
  coNumber: number | null;
  description: string;
};

type LineItem = { label: string; amount: number };

interface SummaryTabProps {
  job: {
    id: string;
    jobNumber: string;
    jobName: string;
    jobType: "BID" | "TIME_AND_MATERIALS" | "ESTIMATE";
    contractValue: number | null;
    laborBudgetDollars: number | null;
    materialBudget: number | null;
    blendedLaborRate: number | null;
    subcontractorCost: number | null;
    subcontractorBillPct: number | null;
    equipmentCost: number | null;
    equipmentBillPct: number | null;
    otherCosts: unknown;
    laborMarkupPct: number | null;
    subMarkupPct: number | null;
    equipmentMarkupPct: number | null;
    materialMarkupPct: number | null;
    otherMarkupPct: number | null;
    gcEmail: string | null;
    gcContactName: string | null;
    gcCompany: string | null;
    laborEntries: LaborEntryWithWage[];
    materials: { amount: number }[];
    changeOrders: ChangeOrder[];
    payments: PaymentEntry[];
    invoices: InvoiceEntry[];
  };
  role: Role;
  companyRates?: { defaultBurden: number; bidRates: Record<string, number> } | null;
  overheadAllocation?: number;
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function SectionCard({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#002D72] text-white">
        {icon}<h3 className="text-sm font-semibold tracking-wide uppercase">{title}</h3>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

function Row({ label, value, sub, accent, negative, bold }: {
  label: string; value: string; sub?: string; accent?: boolean; negative?: boolean; bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b last:border-b-0 border-gray-100">
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <span className={`text-sm tabular-nums ${bold ? "font-bold" : "font-semibold"} ${
        accent ? "text-[#002D72]" : negative ? "text-red-600" : "text-gray-900"
      }`}>
        {value}
      </span>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InvoiceEntry["status"] }) {
  const map: Record<InvoiceEntry["status"], { label: string; cls: string }> = {
    DRAFT:         { label: "Draft",         cls: "bg-gray-100 text-gray-600" },
    SENT:          { label: "Sent",           cls: "bg-blue-100 text-blue-700" },
    PARTIALLY_PAID:{ label: "Partial",        cls: "bg-orange-100 text-orange-700" },
    PAID:          { label: "Paid",           cls: "bg-green-100 text-green-700" },
  };
  const { label, cls } = map[status];
  return <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

// ── Direct Costs Card ─────────────────────────────────────────────────────────

// Small inline markup % input used on each cost row
function MkupInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number" value={value} onChange={e => onChange(e.target.value)}
        step="0.1" min="0" max="999" placeholder="0"
        className="w-14 border border-orange-300 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5910] text-right"
      />
      <span className="text-xs text-gray-400">%</span>
    </div>
  );
}

// Orange pill badge showing markup % in view mode
function MkupBadge({ pct }: { pct: number | null | undefined }) {
  if (!pct || pct === 0) return null;
  return (
    <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded-full leading-none">
      +{pct % 1 === 0 ? pct : pct.toFixed(1)}%
    </span>
  );
}

function DirectCostsCard({ job, role, computed }: {
  job: SummaryTabProps["job"]; role: Role;
  computed: { totalHours: number; laborCost: number | null; materialsCost: number; };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Cost inputs
  const [rateInput, setRateInput] = useState(String(job.blendedLaborRate ?? ""));
  const [laborBudgetInput, setLaborBudgetInput] = useState(String(job.laborBudgetDollars ?? ""));
  const [materialBudgetInput, setMaterialBudgetInput] = useState(String(job.materialBudget ?? ""));
  const [subInput, setSubInput] = useState(String(job.subcontractorCost ?? ""));
  const [subBillPctInput, setSubBillPctInput] = useState(String(job.subcontractorBillPct ?? "100"));
  const [equipInput, setEquipInput] = useState(String(job.equipmentCost ?? ""));
  const [billPctInput, setBillPctInput] = useState(String(job.equipmentBillPct ?? "100"));

  // Markup % inputs (one per cost category)
  const [laborMkup, setLaborMkup] = useState(String(job.laborMarkupPct ?? ""));
  const [matMkup, setMatMkup] = useState(String(job.materialMarkupPct ?? ""));
  const [subMkup, setSubMkup] = useState(String(job.subMarkupPct ?? ""));
  const [equipMkup, setEquipMkup] = useState(String(job.equipmentMarkupPct ?? ""));
  const [defaultOtherMkup, setDefaultOtherMkup] = useState(String(job.otherMarkupPct ?? ""));

  const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];

  // Per-item other-cost markup state, keyed by id
  const [ocMarkups, setOcMarkups] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const oc of otherCosts) m[oc.id] = String(oc.markupPct ?? job.otherMarkupPct ?? 0);
    return m;
  });

  // Add-other-cost form state
  const [addDesc, setAddDesc] = useState("");
  const [addAmt, setAddAmt] = useState("");
  const [addMkup, setAddMkup] = useState(String(job.otherMarkupPct ?? "0"));
  const [addingOther, setAddingOther] = useState(false);
  const [addPending, startAddTransition] = useTransition();

  // ── Saved (view-mode) computations ──────────────────────────────────────────
  const subCost = job.subcontractorCost ?? 0;
  const subBillPct = job.subcontractorBillPct ?? 100;
  const subBilled = subCost * (subBillPct / 100);
  const equipCost = job.equipmentCost ?? 0;
  const equipBillPct = job.equipmentBillPct ?? 100;
  const equipBilled = equipCost * (equipBillPct / 100);

  const laborMkupAmt = computed.laborCost != null ? computed.laborCost * ((job.laborMarkupPct ?? 0) / 100) : null;
  const laborMarkedUp = computed.laborCost != null ? computed.laborCost + (laborMkupAmt ?? 0) : null;

  const matMkupAmt = computed.materialsCost * ((job.materialMarkupPct ?? 0) / 100);
  const matMarkedUp = computed.materialsCost + matMkupAmt;

  const subMkupAmt = subBilled * ((job.subMarkupPct ?? 0) / 100);
  const subMarkedUp = subBilled + subMkupAmt;

  const equipMkupAmt = equipBilled * ((job.equipmentMarkupPct ?? 0) / 100);
  const equipMarkedUp = equipBilled + equipMkupAmt;

  const otherMarkedUpTotal = otherCosts.reduce((s, oc) => {
    const pct = oc.markupPct ?? job.otherMarkupPct ?? 0;
    return s + oc.amount * (1 + pct / 100);
  }, 0);

  const totalMarkedUp =
    (laborMarkedUp ?? 0) + matMarkedUp + subMarkedUp + equipMarkedUp + otherMarkedUpTotal;

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        const updatedOtherCosts = otherCosts.map(oc => ({
          ...oc,
          markupPct: parseFloat(ocMarkups[oc.id] ?? "0") || 0,
        }));
        await updateDirectCostsWithMarkups(job.id, {
          blendedLaborRate: rateInput,
          laborMarkupPct: laborMkup,
          laborBudgetDollars: laborBudgetInput,
          subcontractorCost: subInput,
          subcontractorBillPct: subBillPctInput,
          subMarkupPct: subMkup,
          equipmentCost: equipInput,
          equipmentBillPct: billPctInput,
          equipmentMarkupPct: equipMkup,
          materialMarkupPct: matMkup,
          materialBudget: materialBudgetInput,
          otherMarkupPct: defaultOtherMkup,
          otherCosts: updatedOtherCosts,
        });
        setEditing(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    });
  }

  function handleAddOther() {
    if (!addDesc.trim() || !addAmt) return;
    startAddTransition(async () => {
      try {
        await addOtherCost(job.id, addDesc, addAmt, addMkup);
        setAddDesc(""); setAddAmt(""); setAddMkup(String(job.otherMarkupPct ?? "0"));
        setAddingOther(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SectionCard icon={<DollarSign className="w-4 h-4" />} title="Direct Costs (Reference Only)">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {role === "ADMIN" && (
        <div className="flex items-center justify-end gap-2 pt-3 pb-1 border-b border-gray-100 mb-1">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit Costs &amp; Markup
            </button>
          ) : (
            <>
              <button onClick={() => { setEditing(false); setError(null); }}
                className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
              <button onClick={handleSave} disabled={pending}
                className="flex items-center gap-1.5 text-xs font-medium bg-[#002D72] text-white px-3 py-1.5 rounded-lg hover:bg-[#003d99] disabled:opacity-60 transition-colors">
                <Save className="w-3.5 h-3.5" />{pending ? "Saving…" : "Save Changes"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── LABOR ── */}
      <div className="py-2.5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm text-gray-600">Labor</p>
              {!editing && <MkupBadge pct={job.laborMarkupPct} />}
            </div>
            {editing ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  <input type="number" value={rateInput} onChange={e => setRateInput(e.target.value)}
                    placeholder="$/hr" step="0.01" min="0"
                    className="w-24 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  <span className="text-xs text-gray-400">/hr rate</span>
                </div>
                <MkupInput value={laborMkup} onChange={setLaborMkup} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Labor Budget $</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={laborBudgetInput}
                    onChange={e => setLaborBudgetInput(e.target.value)}
                    placeholder="0"
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white w-32 focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                {computed.totalHours.toFixed(1)} hrs
                {job.blendedLaborRate != null ? ` @ $${job.blendedLaborRate.toFixed(2)}/hr` : " · set rate to calculate"}
                {laborMkupAmt != null && laborMkupAmt > 0 ? ` · +${fmt$(laborMkupAmt)} markup` : ""}
              </p>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
            {laborMarkedUp != null ? fmt$(laborMarkedUp) : "—"}
          </span>
        </div>
      </div>

      {/* ── MATERIALS ── */}
      <div className="py-2.5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm text-gray-600">Materials</p>
              {!editing && <MkupBadge pct={job.materialMarkupPct} />}
            </div>
            {editing ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs text-gray-400 italic">From Purchase Orders tab</span>
                <MkupInput value={matMkup} onChange={setMatMkup} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-500">Material Budget $</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={materialBudgetInput}
                    onChange={e => setMaterialBudgetInput(e.target.value)}
                    placeholder="0"
                    className="border border-gray-300 rounded px-2 py-1 text-xs bg-white w-32 focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                From Purchase Orders tab
                {matMkupAmt > 0 ? ` · +${fmt$(matMkupAmt)} markup` : ""}
              </p>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
            {fmt$(matMarkedUp)}
          </span>
        </div>
      </div>

      {/* ── SUBCONTRACTORS ── */}
      <div className="py-2.5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm text-gray-600">Subcontractors</p>
              {!editing && <MkupBadge pct={job.subMarkupPct} />}
            </div>
            {editing ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  <input type="number" value={subInput} onChange={e => setSubInput(e.target.value)}
                    placeholder="0.00" step="0.01" min="0"
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  <span className="text-xs text-gray-400">cost</span>
                </div>
                <div className="flex items-center gap-1">
                  <input type="number" value={subBillPctInput} onChange={e => setSubBillPctInput(e.target.value)}
                    placeholder="100" step="1" min="0" max="100"
                    className="w-14 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  <span className="text-xs text-gray-400">% bill</span>
                </div>
                <MkupInput value={subMkup} onChange={setSubMkup} />
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                {subBillPct < 100 ? `${subBillPct}% to bill this period` : "100% to bill this period"}
                {subMkupAmt > 0 ? ` · +${fmt$(subMkupAmt)} markup` : ""}
              </p>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
            {fmt$(subMarkedUp)}
          </span>
        </div>
      </div>

      {/* ── EQUIPMENT ── */}
      <div className="py-2.5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm text-gray-600">Equipment Rental</p>
              {!editing && <MkupBadge pct={job.equipmentMarkupPct} />}
            </div>
            {editing ? (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  <input type="number" value={equipInput} onChange={e => setEquipInput(e.target.value)}
                    placeholder="0.00" step="0.01" min="0"
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  <span className="text-xs text-gray-400">total cost</span>
                </div>
                <div className="flex items-center gap-1">
                  <input type="number" value={billPctInput} onChange={e => setBillPctInput(e.target.value)}
                    placeholder="100" step="1" min="0" max="100"
                    className="w-14 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  <span className="text-xs text-gray-400">% bill</span>
                </div>
                <MkupInput value={equipMkup} onChange={setEquipMkup} />
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                {equipBillPct}% to bill this period
                {equipMkupAmt > 0 ? ` · +${fmt$(equipMkupAmt)} markup` : ""}
              </p>
            )}
          </div>
          <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
            {fmt$(equipMarkedUp)}
          </span>
        </div>
      </div>

      {/* ── OTHER COSTS ── */}
      {otherCosts.map(oc => {
        const ocPct = oc.markupPct ?? job.otherMarkupPct ?? 0;
        const ocMkupAmt = oc.amount * (ocPct / 100);
        const ocMarkedUp = oc.amount + ocMkupAmt;
        return (
          <div key={oc.id} className="py-2.5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm text-gray-600">{oc.description}</p>
                  {!editing && <MkupBadge pct={ocPct} />}
                </div>
                {editing ? (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-400">{fmt$(oc.amount)} base</span>
                    <MkupInput
                      value={ocMarkups[oc.id] ?? String(ocPct)}
                      onChange={v => setOcMarkups(prev => ({ ...prev, [oc.id]: v }))}
                    />
                  </div>
                ) : (
                  ocMkupAmt > 0 ? (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Base: {fmt$(oc.amount)} · +{fmt$(ocMkupAmt)} markup
                    </p>
                  ) : null
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(ocMarkedUp)}</span>
                {role === "ADMIN" && (
                  <button onClick={() => startTransition(() => deleteOtherCost(job.id, oc.id))}
                    className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── ADD OTHER COST ── */}
      {role === "ADMIN" && (
        addingOther ? (
          <div className="py-2.5 border-b border-gray-100 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <input value={addDesc} onChange={e => setAddDesc(e.target.value)}
                placeholder="Description (Permits, etc.)"
                className="flex-1 min-w-[130px] border border-gray-300 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              <input type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)}
                placeholder="Amount" step="0.01" min="0"
                className="w-24 border border-gray-300 rounded px-2 py-1.5 text-xs text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              <MkupInput value={addMkup} onChange={setAddMkup} />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAddingOther(false); setAddDesc(""); setAddAmt(""); }}
                className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleAddOther} disabled={addPending || !addDesc.trim() || !addAmt}
                className="text-xs bg-[#002D72] text-white px-2.5 py-1 rounded-lg hover:bg-[#003d99] disabled:opacity-60">
                {addPending ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2.5 border-b border-gray-100">
            <button onClick={() => setAddingOther(true)}
              className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Other Cost
            </button>
          </div>
        )
      )}

      {/* ── TOTAL (marked-up) ── */}
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Total Direct Costs</p>
          <p className="text-xs text-gray-400">Base costs + all markups</p>
        </div>
        <span className="text-sm font-bold text-[#002D72] tabular-nums">{fmt$(totalMarkedUp)}</span>
      </div>

      {/* ── % Complete tracker ── */}
      {(role === "ADMIN" || role === "OFFICE") && (() => {
        const rate = job.blendedLaborRate ? Number(job.blendedLaborRate) : 0;
        const laborCostToDate = computed.laborCost ?? (computed.totalHours * rate);
        const laborBudget = job.laborBudgetDollars ? Number(job.laborBudgetDollars) : null;
        const matBudget = job.materialBudget ? Number(job.materialBudget) : null;

        const laborPct = laborBudget != null && laborBudget > 0
          ? Math.min(Math.round((laborCostToDate / laborBudget) * 100), 999) : null;
        const matPct = matBudget != null && matBudget > 0
          ? Math.min(Math.round((computed.materialsCost / matBudget) * 100), 999) : null;

        if (laborPct === null && matPct === null) return null;

        return (
          <div className="mt-1 pt-3 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Budget Used</p>
            {laborPct !== null && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Labor</span>
                  <span className={`text-xs font-semibold tabular-nums ${laborPct >= 100 ? "text-red-600" : laborPct >= 80 ? "text-amber-600" : "text-green-700"}`}>
                    {fmt$(laborCostToDate)} / {fmt$(laborBudget)} · {laborPct}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${laborPct >= 100 ? "bg-red-500" : laborPct >= 80 ? "bg-amber-400" : "bg-green-500"}`}
                    style={{ width: `${Math.min(laborPct, 100)}%` }}
                  />
                </div>
              </div>
            )}
            {matPct !== null && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Materials</span>
                  <span className={`text-xs font-semibold tabular-nums ${matPct >= 100 ? "text-red-600" : matPct >= 80 ? "text-amber-600" : "text-green-700"}`}>
                    {fmt$(computed.materialsCost)} / {fmt$(matBudget)} · {matPct}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${matPct >= 100 ? "bg-red-500" : matPct >= 80 ? "bg-amber-400" : "bg-green-500"}`}
                    style={{ width: `${Math.min(matPct, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </SectionCard>
  );
}

// ── Deposit Request Card ──────────────────────────────────────────────────────

function DepositRequestCard({ job, role }: {
  job: SummaryTabProps["job"]; role: Role;
}) {
  const [showForm, setShowForm] = useState(false);
  const [amountType, setAmountType] = useState<"fixed" | "percentage">("fixed");
  const [fixedAmount, setFixedAmount] = useState(
    job.contractValue ? (job.contractValue * 0.5).toFixed(2) : ""
  );
  const [percentage, setPercentage] = useState("50");
  const [contractValue, setContractValue] = useState(
    job.contractValue ? job.contractValue.toFixed(2) : ""
  );
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState(`${job.jobName} — Deposit`);
  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const depositAmt = amountType === "percentage"
    ? (parseFloat(contractValue) || 0) * (parseFloat(percentage) || 0) / 100
    : (parseFloat(fixedAmount) || 0);

  async function handleGenerate() {
    if (depositAmt <= 0) { setError("Enter a deposit amount greater than $0."); return; }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/deposit-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountType, fixedAmount, percentage, contractValue, dueDate, description, notes }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? "PDF generation failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DepositRequest_${job.jobNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to generate deposit request."); }
    finally { setGenerating(false); }
  }

  const emailTo = job.gcEmail ?? "";
  const contactName = job.gcContactName ?? job.gcCompany ?? "";
  const emailSubject = encodeURIComponent(`Deposit Request — ${job.jobName}`);
  const dueLine = dueDate
    ? `\nDue Date: ${new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
    : "";
  const emailBody = encodeURIComponent(
    `Hi${contactName ? ` ${contactName}` : ""},\n\nPlease find attached the deposit request for ${job.jobName} (Job #${job.jobNumber}).\n\nDeposit Amount: ${depositAmt > 0 ? depositAmt.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—"}${dueLine}\n\nPlease don't hesitate to reach out with any questions.\n\nThank you,\nJustin Marceau\nOak Ridge Electrical LLC\n603-660-4651`
  );
  const mailtoLink = `mailto:${emailTo}?subject=${emailSubject}&body=${emailBody}`;

  if (role !== "ADMIN") return null;

  return (
    <SectionCard icon={<Download className="w-4 h-4" />} title="Deposit Request">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {showForm ? (
        <div className="py-3 space-y-3">
          {/* Amount type toggle */}
          <div className="flex gap-2">
            {(["fixed", "percentage"] as const).map(t => (
              <button key={t} onClick={() => setAmountType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  amountType === t ? "bg-[#FF5910] text-white border-[#FF5910]" : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                }`}>
                {t === "fixed" ? "Fixed Amount" : "Percentage"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {amountType === "fixed" ? (
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Deposit Amount *</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={fixedAmount} onChange={e => setFixedAmount(e.target.value)}
                    step="0.01" min="0" placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Percentage *</label>
                  <div className="relative">
                    <input type="number" value={percentage} onChange={e => setPercentage(e.target.value)}
                      step="1" min="0" max="100" placeholder="50"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Contract Value</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" value={contractValue} onChange={e => setContractValue(e.target.value)}
                      step="0.01" min="0" placeholder="0.00"
                      className="w-full border border-gray-300 rounded-lg pl-6 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Deposit for electrical work"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional additional notes…"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72] resize-none" />
          </div>

          {depositAmt > 0 && (
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              Deposit Amount: <span className="font-bold text-[#002D72]">{depositAmt.toLocaleString("en-US", { style: "currency", currency: "USD" })}</span>
              {amountType === "percentage" && parseFloat(contractValue) > 0
                ? ` (${percentage}% of ${parseFloat(contractValue).toLocaleString("en-US", { style: "currency", currency: "USD" })})`
                : ""}
            </p>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setError(null); }}
              className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
            <a href={mailtoLink}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#002D72] border border-gray-200 hover:border-[#002D72]/30 px-2.5 py-1.5 rounded-lg transition-colors bg-white">
              <Mail className="w-3.5 h-3.5" /> Email to GC{emailTo ? ` (${emailTo})` : ""}
            </a>
            <button onClick={handleGenerate} disabled={generating || depositAmt <= 0}
              className="flex items-center gap-1.5 text-xs font-medium bg-[#FF5910] text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
              <Download className="w-3.5 h-3.5" />{generating ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>
      ) : (
        <div className="py-2.5">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-xs text-[#FF5910] hover:text-orange-600 font-medium">
            <Plus className="w-3.5 h-3.5" /> Request Deposit
          </button>
        </div>
      )}
    </SectionCard>
  );
}

// ── Schedule of Values Card (AIA G703) ───────────────────────────────────────

type SovRow = {
  id: string;
  itemNo: string;
  description: string;
  scheduledValue: number;
  type: "labor" | "material" | "co" | "custom";
  previouslyBilled: number;
  thisPeriod: number;
  materialsStored: number;
  autoFilled?: boolean;
  manuallyEdited?: boolean;
  coId?: string;
};

function numInput(val: string, onChange: (v: string) => void, placeholder = "0") {
  return (
    <input
      type="number"
      value={val}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      step="0.01"
      min="0"
      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72] text-right tabular-nums"
    />
  );
}

function ScheduleOfValuesCard({ job, role, grossBilling, computed }: {
  job: SummaryTabProps["job"];
  role: Role;
  grossBilling: number;
  computed: {
    laborCost: number | null;
    materialsCost: number;
    subCost: number;
    equipmentCost: number;
    otherTotal: number;
    laborMarkup: number | null;
    subMarkup: number;
    equipMarkup: number;
    materialMarkup: number;
    otherMarkup: number;
  };
}) {
  const [rows, setRows] = useState<SovRow[]>([]);
  const [appDate, setAppDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState("");
  const [retainagePct, setRetainagePct] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInvoiceDate, setLastInvoiceDate] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/jobs/${job.id}/schedule-of-values`)
      .then(r => r.json())
      .then(data => {
        setRows(data.rows ?? []);
        setLastInvoiceDate(data.lastInvoiceDate ?? null);
      })
      .catch(() => setError("Failed to load schedule of values."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  function updateRow(id: string, field: keyof SovRow, value: string | number | boolean) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "thisPeriod" && r.autoFilled) updated.manuallyEdited = true;
      return updated;
    }));
  }

  function addRow() {
    const customCount = rows.filter(r => r.type === "custom").length + 1;
    setRows(prev => [...prev, {
      id: crypto.randomUUID(),
      itemNo: `500-${String(customCount).padStart(3, "0")}`,
      description: "",
      scheduledValue: 0,
      type: "custom",
      previouslyBilled: 0,
      thisPeriod: 0,
      materialsStored: 0,
    }]);
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id));
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/schedule-of-values/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Refresh failed");
      setLastInvoiceDate(data.lastInvoiceDate ?? null);
      setRows(prev => prev.map(r => {
        if (r.type === "labor" && r.autoFilled && !r.manuallyEdited) {
          return { ...r, thisPeriod: data.laborAutoFill ?? 0 };
        }
        if (r.type === "material" && r.autoFilled && !r.manuallyEdited) {
          return { ...r, thisPeriod: data.materialAutoFill ?? 0 };
        }
        return r;
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/schedule-of-values`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error("Save failed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function doGenerate() {
    if (!appDate) { setError("Application date is required."); return; }
    setGenerating(true);
    setError(null);
    try {
      // Save current SOV state before generating
      await fetch(`/api/jobs/${job.id}/schedule-of-values`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      const thisPeriodTotal = rows.reduce((s, r) => s + (r.thisPeriod || 0), 0);

      // Include coId so computeFromPrevious can track CO rows across applications
      const sovLineItems = rows.map(r => ({
        fromSov: true,
        id: r.id,
        itemNo: r.itemNo,
        description: r.description,
        scheduledValue: r.scheduledValue,
        previouslyBilled: r.previouslyBilled,
        thisPeriod: r.thisPeriod,
        materialsStored: r.materialsStored,
        total: (r.previouslyBilled || 0) + (r.thisPeriod || 0) + (r.materialsStored || 0),
        type: r.type,
        coId: r.coId ?? null,
      }));

      // Auto-increment application number from existing AIA invoices
      const existingAias = job.invoices.filter(inv => inv.type === "AIA");
      const maxAppNo = existingAias.reduce(
        (max, inv) => Math.max(max, inv.applicationNo ?? inv.invoiceNumber),
        0
      );
      const nextAppNo = String(maxAppNo + 1);

      // Always force — AIA applications are always sequential, never duplicates
      await createInvoice(job.id, {
        type: "AIA",
        invoiceKind: "PROGRESS_PAYMENT",
        date: appDate,
        periodTo,
        applicationNo: nextAppNo,
        amount: String(thisPeriodTotal),
        retainagePct,
        notes: "",
        paymentTerms: "due_on_receipt",
        scopeOfWork: "",
        lineItems: sovLineItems as Record<string, unknown>[],
        force: true,
      });

      // Reset This Period to 0 for next billing cycle, then reload
      const resetRows = rows.map(r => ({ ...r, thisPeriod: 0, manuallyEdited: false }));
      await fetch(`/api/jobs/${job.id}/schedule-of-values`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: resetRows }),
      });

      // Reload SOV — GET will now include the new invoice in From Previous
      const freshData = await fetch(`/api/jobs/${job.id}/schedule-of-values`).then(r => r.json());
      setRows(freshData.rows ?? []);
      setLastInvoiceDate(freshData.lastInvoiceDate ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate invoice.");
    } finally {
      setGenerating(false);
    }
  }

  const grandScheduled = rows.reduce((s, r) => s + (r.scheduledValue || 0), 0);
  const grandPrev = rows.reduce((s, r) => s + (r.previouslyBilled || 0), 0);
  const grandThis = rows.reduce((s, r) => s + (r.thisPeriod || 0), 0);
  const grandStored = rows.reduce((s, r) => s + (r.materialsStored || 0), 0);
  const grandTotal = grandPrev + grandThis + grandStored;
  const grandBalance = grandScheduled - grandTotal;
  const grandPct = grandScheduled > 0 ? (grandTotal / grandScheduled) * 100 : 0;
  const retainageAmt = grandThis * (parseFloat(retainagePct || "0") / 100);
  const thisPeriodNet = grandThis - retainageAmt;

  if (loading) {
    return (
      <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="Schedule of Values — AIA G703">
        <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="Schedule of Values — AIA G703">
      {error && <p className="text-xs text-red-500 pt-2">{error}</p>}

      {/* ── Application header ── */}
      <div className="py-3 border-b border-gray-100">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Application Date *</label>
            <input type="date" value={appDate} onChange={e => setAppDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Period To</label>
            <input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Retainage %</label>
            <input type="number" value={retainagePct} onChange={e => setRetainagePct(e.target.value)}
              step="0.5" min="0" max="100" placeholder="10"
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
          </div>
          {lastInvoiceDate && (
            <div className="flex items-end">
              <p className="text-xs text-gray-400">
                Auto-fill cutoff:{" "}
                {new Date(lastInvoiceDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── G703 Table ── */}
      <div className="py-2 overflow-x-auto -mx-4 px-4">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 700 }}>
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 pr-2 text-gray-500 font-semibold w-16">Item No</th>
              <th className="text-left py-2 pr-2 text-gray-500 font-semibold">Description</th>
              <th className="text-right py-2 pr-2 text-gray-500 font-semibold w-24">Sched. Value</th>
              <th className="text-right py-2 pr-2 text-gray-500 font-semibold w-24">From Previous</th>
              <th className="text-right py-2 pr-2 text-gray-500 font-semibold w-24">This Period</th>
              <th className="text-right py-2 pr-2 text-gray-500 font-semibold w-24">Mat. Stored</th>
              <th className="text-right py-2 pr-2 text-gray-500 font-semibold w-24">Total</th>
              <th className="text-right py-2 pr-2 text-gray-500 font-semibold w-14">%</th>
              <th className="text-right py-2 text-gray-500 font-semibold w-24">Balance</th>
              {role === "ADMIN" && <th className="w-6" />}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const total = (row.previouslyBilled || 0) + (row.thisPeriod || 0) + (row.materialsStored || 0);
              const pct = (row.scheduledValue || 0) > 0 ? (total / row.scheduledValue) * 100 : null;
              const balance = (row.scheduledValue || 0) - total;
              const balanceIsNegative = (row.scheduledValue || 0) > 0 && balance < 0;
              const isAutoFilled = row.autoFilled && !row.manuallyEdited;
              return (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 group">
                  <td className="py-1.5 pr-2">
                    <input value={row.itemNo} onChange={e => updateRow(row.id, "itemNo", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input value={row.description} onChange={e => updateRow(row.id, "description", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  </td>
                  <td className="py-1.5 pr-2">
                    {numInput(String(row.scheduledValue || ""), v => updateRow(row.id, "scheduledValue", parseFloat(v) || 0))}
                  </td>
                  <td className="py-1.5 pr-2">
                    {numInput(String(row.previouslyBilled || ""), v => updateRow(row.id, "previouslyBilled", parseFloat(v) || 0))}
                  </td>
                  <td className="py-1.5 pr-2">
                    <div className="relative">
                      {numInput(String(row.thisPeriod || ""), v => {
                        updateRow(row.id, "thisPeriod", parseFloat(v) || 0);
                        if (row.autoFilled) updateRow(row.id, "manuallyEdited", true);
                      })}
                      {isAutoFilled && (
                        <span className="absolute -top-1 -right-1 text-blue-400 text-xs leading-none" title="Auto-filled from tracked data">✓</span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    {numInput(String(row.materialsStored || ""), v => updateRow(row.id, "materialsStored", parseFloat(v) || 0))}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-semibold text-gray-800 tabular-nums">
                    {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    <span className={pct != null && pct > 100 ? "text-red-600 font-semibold" : "text-gray-700"}>
                      {pct == null ? "—" : `${pct.toFixed(1)}%`}
                    </span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    <span className={balanceIsNegative ? "text-red-600 font-semibold" : "text-gray-700"}>
                      {balance.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </span>
                  </td>
                  {role === "ADMIN" && (
                    <td className="py-1.5 pl-1">
                      <button onClick={() => removeRow(row.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td colSpan={2} className="py-2 pr-2 text-xs font-bold text-gray-800">TOTALS</td>
              <td className="py-2 pr-2 text-right text-xs font-bold text-gray-800 tabular-nums">
                {grandScheduled.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </td>
              <td className="py-2 pr-2 text-right text-xs font-bold text-gray-800 tabular-nums">
                {grandPrev.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </td>
              <td className="py-2 pr-2 text-right text-xs font-bold text-[#002D72] tabular-nums">
                {grandThis.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </td>
              <td className="py-2 pr-2 text-right text-xs font-bold text-gray-800 tabular-nums">
                {grandStored.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </td>
              <td className="py-2 pr-2 text-right text-xs font-bold text-gray-800 tabular-nums">
                {grandTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </td>
              <td className="py-2 pr-2 text-right text-xs font-bold text-gray-800">
                {grandScheduled > 0 ? `${grandPct.toFixed(1)}%` : "—"}
              </td>
              <td className={`py-2 text-right text-xs font-bold tabular-nums ${grandScheduled > 0 && grandBalance < 0 ? "text-red-600" : "text-gray-800"}`}>
                {grandBalance.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </td>
              {role === "ADMIN" && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Row */}
      {role === "ADMIN" && (
        <div className="py-2 border-b border-gray-100">
          <button onClick={addRow}
            className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
        </div>
      )}

      {/* ── This period summary ── */}
      <div className="py-3 border-b border-gray-100 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">This Period (gross)</p>
          <span className="text-sm font-bold text-[#002D72] tabular-nums">
            {grandThis.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </span>
        </div>
        {parseFloat(retainagePct || "0") > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Less retainage ({retainagePct}%)</p>
              <span className="text-xs text-gray-700 tabular-nums">
                −{retainageAmt.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-1">
              <p className="text-sm font-semibold text-gray-800">Net This Period</p>
              <span className="text-sm font-bold text-green-700 tabular-nums">
                {thisPeriodNet.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Action buttons ── */}
      {role === "ADMIN" && (
        <div className="flex flex-wrap gap-2 py-3">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#002D72] border border-gray-200 hover:border-[#002D72]/30 px-3 py-1.5 rounded-lg transition-colors bg-white disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Auto-fill"}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-xs font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-60">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Schedule"}
          </button>
          <button onClick={() => doGenerate()} disabled={generating || !appDate || grandThis <= 0}
            className="flex items-center gap-1.5 text-xs font-medium bg-[#002D72] text-white px-3 py-1.5 rounded-lg hover:bg-[#003d99] disabled:opacity-60 transition-colors">
            <FileText className="w-3.5 h-3.5" />
            {generating ? "Generating…" : "Generate AIA Invoice"}
          </button>
        </div>
      )}
      {grandThis <= 0 && role === "ADMIN" && (
        <p className="text-xs text-gray-400 pb-2">Enter &ldquo;This Period&rdquo; amounts above to generate an invoice.</p>
      )}
    </SectionCard>
  );
}


// ── Invoice Log Card ──────────────────────────────────────────────────────────

function InvoiceLogCard({ job, role, grossBilling, computed }: {
  job: SummaryTabProps["job"];
  role: Role;
  grossBilling: number;
  computed: {
    laborCost: number | null;
    materialsCost: number;
    subCost: number;
    equipmentCost: number;
    otherTotal: number;
    laborMarkup: number | null;
    subMarkup: number;
    equipMarkup: number;
    materialMarkup: number;
    otherMarkup: number;
  };
}) {
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [showPayForm, setShowPayForm] = useState<string | null>(null); // invoiceId
  const [duplicateWarning, setDuplicateWarning] = useState<{ invoiceNumber: number; date: string } | null>(null);
  const [sheetsLoading, setSheetsLoading] = useState<string | null>(null);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  // New invoice form state
  const [invType, setInvType] = useState<"STANDARD" | "AIA">("STANDARD");
  const [invKind, setInvKind] = useState<"PROGRESS_PAYMENT" | "FINAL_INVOICE">("PROGRESS_PAYMENT");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invPeriodTo, setInvPeriodTo] = useState("");
  const [invAppNo, setInvAppNo] = useState("");
  const [invAmount, setInvAmount] = useState(grossBilling.toFixed(2));
  const [invRetainagePct, setInvRetainagePct] = useState("10");
  const [invNotes, setInvNotes] = useState("");
  const [invPaymentTerms, setInvPaymentTerms] = useState("due_on_receipt");

  // Scope section builder state
  const [invScopeSections, setInvScopeSections] = useState<ScopeSection[]>([]);
  const [showInvBulletPicker, setShowInvBulletPicker] = useState(false);
  const [invBulletPickerTarget, setInvBulletPickerTarget] = useState<{ sectionId: string } | null>(null);
  const [invBulletPickerTab, setInvBulletPickerTab] = useState<"library" | "saved">("library");
  const [invBulletSearch, setInvBulletSearch] = useState("");
  const [savedBullets, setSavedBullets] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("ore_scope_bullets") ?? "[]"); } catch { return []; }
  });

  function addInvSection() {
    setInvScopeSections(prev => [...prev, { id: crypto.randomUUID(), title: "", items: [] }]);
  }
  function removeInvSection(id: string) {
    setInvScopeSections(prev => prev.filter(s => s.id !== id));
  }
  function updateInvSection(id: string, field: "title" | "items", value: string | string[]) {
    setInvScopeSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }
  function insertInvBullet(sectionId: string, bullet: string) {
    setInvScopeSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, items: [...s.items, bullet] } : s
    ));
  }
  function toggleSavedBullet(bullet: string) {
    setSavedBullets(prev => {
      const next = prev.includes(bullet) ? prev.filter(b => b !== bullet) : [...prev, bullet];
      try { localStorage.setItem("ore_scope_bullets", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function buildScopeString(): string {
    return invScopeSections
      .filter(s => s.title.trim() || s.items.length > 0)
      .map((s, i) => {
        const header = s.title.trim() ? `${i + 1}. ${s.title.trim()}` : `${i + 1}.`;
        const bullets = s.items.map(item => `  • ${item}`).join("\n");
        return bullets ? `${header}\n${bullets}` : header;
      })
      .join("\n\n");
  }

  // Payment form state
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payCheck, setPayCheck] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payRetainage, setPayRetainage] = useState(false);
  const [payNote, setPayNote] = useState("");
  const [payReceiptFile, setPayReceiptFile] = useState<File | null>(null);
  const [payReceiptUploading, setPayReceiptUploading] = useState(false);
  const { startUpload: startReceiptUpload } = useUpload("paymentReceipt");

  const invoices = job.invoices.map(inv => ({ ...inv, date: new Date(inv.date), periodTo: inv.periodTo ? new Date(inv.periodTo) : null }));
  const totalInvoiced = invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalPaid = job.payments.reduce((s, p) => s + p.amount, 0);
  const outstanding = totalInvoiced - totalPaid;

  // Auto-generate line items from computed values
  function buildLineItems(): LineItem[] {
    const items: LineItem[] = [];
    if (computed.laborCost != null) {
      const laborTotal = (computed.laborCost ?? 0) + (computed.laborMarkup ?? 0);
      if (laborTotal > 0) items.push({ label: "Labor" + (job.laborMarkupPct ? ` (incl. ${job.laborMarkupPct}% markup)` : ""), amount: laborTotal });
    }
    if (computed.materialsCost > 0) {
      const matTotal = computed.materialsCost + computed.materialMarkup;
      items.push({ label: "Materials" + (job.materialMarkupPct ? ` (incl. ${job.materialMarkupPct}% markup)` : ""), amount: matTotal });
    }
    if (computed.subCost > 0) {
      const subTotal = computed.subCost + computed.subMarkup;
      items.push({ label: "Subcontractors" + (job.subMarkupPct ? ` (incl. ${job.subMarkupPct}% markup)` : ""), amount: subTotal });
    }
    if (computed.equipmentCost > 0) {
      const equipTotal = computed.equipmentCost + computed.equipMarkup;
      items.push({ label: "Equipment Rental" + (job.equipmentMarkupPct ? ` (incl. ${job.equipmentMarkupPct}% markup)` : ""), amount: equipTotal });
    }
    const otherCostsList = (job.otherCosts as OtherCost[] | null) ?? [];
    for (const oc of otherCostsList) {
      const pct = oc.markupPct ?? job.otherMarkupPct ?? 0;
      items.push({ label: oc.description + (pct > 0 ? ` (incl. ${pct}% markup)` : ""), amount: oc.amount * (1 + pct / 100) });
    }
    return items;
  }

  function doCreate(force = false) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createInvoice(job.id, {
          type: invType,
          invoiceKind: invKind,
          date: invDate,
          periodTo: invPeriodTo,
          applicationNo: invAppNo,
          amount: invAmount,
          retainagePct: invRetainagePct,
          notes: invNotes,
          paymentTerms: invPaymentTerms,
          scopeOfWork: buildScopeString(),
          lineItems: buildLineItems(),
          force,
        });
        if (result?.duplicate) {
          setDuplicateWarning(result.duplicate);
          return;
        }
        setShowForm(false);
        setDuplicateWarning(null);
        setInvAmount(grossBilling.toFixed(2));
        setInvNotes(""); setInvPeriodTo(""); setInvAppNo(""); setInvRetainagePct("0");
        setInvScopeSections([]);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  function handleCreate() { doCreate(false); }

  function handleMarkSent(invoiceId: string) {
    startTransition(async () => {
      try {
        await updateInvoiceStatus(invoiceId, job.id, "SENT");
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  function handleDelete(invoiceId: string) {
    if (!confirm("Delete this draft invoice?")) return;
    startTransition(async () => {
      try {
        await deleteInvoice(invoiceId, job.id);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  async function handlePushToSheets(invoiceId: string) {
    setSheetsLoading(invoiceId);
    setSheetsError(null);
    try {
      const res = await fetch(`/api/google/sheets/${invoiceId}`);
      const data = await res.json();
      if (!res.ok) {
        setSheetsError(data.error ?? "Failed to sync to Google Sheets");
      } else {
        window.open(data.url, "_blank");
      }
    } catch {
      setSheetsError("Failed to sync to Google Sheets");
    } finally {
      setSheetsLoading(null);
    }
  }

  async function handleAddPayment(invoiceId: string) {
    setError(null);
    let receiptUrl: string | undefined;
    if (payReceiptFile) {
      setPayReceiptUploading(true);
      try {
        const res = await startReceiptUpload([payReceiptFile]);
        if (res?.[0]) receiptUrl = res[0].ufsUrl;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Receipt upload failed.");
        setPayReceiptUploading(false);
        return;
      }
      setPayReceiptUploading(false);
    }
    startTransition(async () => {
      try {
        await addPayment(job.id, payDate, payAmount, payNote, invoiceId, payCheck, payRef, payRetainage, receiptUrl);
        setShowPayForm(null);
        setPayAmount(""); setPayCheck(""); setPayRef(""); setPayNote(""); setPayRetainage(false); setPayReceiptFile(null);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  return (
    <SectionCard icon={<FileText className="w-4 h-4" />} title="Invoices">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {/* Duplicate invoice warning */}
      {duplicateWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-3 space-y-3">
          <p className="text-sm font-semibold text-amber-800">Invoice Already Exists</p>
          <p className="text-xs text-amber-700">
            Invoice #{job.jobNumber}-{String(duplicateWarning.invoiceNumber).padStart(3, "0")} was already created for{" "}
            {new Date(duplicateWarning.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
            Do you want to create another invoice for this period?
          </p>
          <div className="flex gap-2">
            <button onClick={() => doCreate(true)} disabled={pending}
              className="flex-1 bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-60">
              {pending ? "Creating…" : "Create Anyway"}
            </button>
            <button onClick={() => setDuplicateWarning(null)}
              className="flex-1 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-amber-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">No invoices created yet.</p>
      ) : (
        invoices.map(inv => {
          const invPaid = inv.payments.reduce((s, p) => s + p.amount, 0);
          const isExpanded = expandedInvoice === inv.id;
          const label = inv.type === "AIA"
            ? `AIA Application #${inv.applicationNo ?? inv.invoiceNumber}`
            : `Invoice #${job.jobNumber}-${String(inv.invoiceNumber).padStart(3, "0")}`;
          const pdfUrl = inv.type === "AIA"
            ? `/api/jobs/${job.id}/pdf/aia/${inv.id}`
            : `/api/jobs/${job.id}/pdf/invoice/${inv.id}`;

          return (
            <div key={inv.id} className="border-b border-gray-100 last:border-b-0">
              {/* Invoice header row */}
              <div className="flex items-center gap-2 py-2.5">
                <button onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)}
                  className="p-0.5 text-gray-400 hover:text-gray-700">
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{label}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {fmtDate(inv.date)}
                    {inv.periodTo ? ` · Period to: ${fmtDate(inv.periodTo)}` : ""}
                    {inv.retainagePct ? ` · ${inv.retainagePct}% retainage` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(inv.amount)}</p>
                  {invPaid > 0 && (
                    <p className="text-xs text-gray-400">{fmt$(invPaid)} paid</p>
                  )}
                </div>
              </div>

              {/* Expanded actions */}
              {isExpanded && (
                <div className="pb-3 pl-6 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {/* PDF download */}
                    <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#002D72] border border-gray-200 hover:border-[#002D72]/30 px-2.5 py-1.5 rounded-lg transition-colors bg-white">
                      <FileText className="w-3.5 h-3.5" /> Download PDF
                    </a>
                    {/* Word doc download (Standard only) */}
                    {inv.type === "STANDARD" && (
                      <a href={`/api/jobs/${job.id}/pdf/invoice/${inv.id}/docx`}
                        target="_blank" rel="noopener noreferrer"
                        download={`Invoice_${job.jobNumber}-${String(inv.invoiceNumber).padStart(3, "0")}.docx`}
                        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#002D72] border border-gray-200 hover:border-[#002D72]/30 px-2.5 py-1.5 rounded-lg transition-colors bg-white">
                        <FileText className="w-3.5 h-3.5" /> Download Word
                      </a>
                    )}

                    {/* Mark Sent */}
                    {role === "ADMIN" && inv.status === "DRAFT" && (
                      <button onClick={() => handleMarkSent(inv.id)} disabled={pending}
                        className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-60">
                        <Send className="w-3.5 h-3.5" /> Mark Sent
                      </button>
                    )}

                    {/* Record Payment */}
                    {role === "ADMIN" && inv.status !== "PAID" && inv.status !== "DRAFT" && (
                      <button onClick={() => setShowPayForm(showPayForm === inv.id ? null : inv.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-50 transition-colors">
                        <CreditCard className="w-3.5 h-3.5" /> Record Payment
                      </button>
                    )}

                    {/* Mark Paid manually */}
                    {role === "ADMIN" && (inv.status === "SENT" || inv.status === "PARTIALLY_PAID") && (
                      <button onClick={() => startTransition(() => updateInvoiceStatus(inv.id, job.id, "PAID"))}
                        disabled={pending}
                        className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-200 px-2.5 py-1.5 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
                      </button>
                    )}

                    {/* Delete draft */}
                    {role === "ADMIN" && inv.status === "DRAFT" && (
                      <button onClick={() => handleDelete(inv.id)} disabled={pending}
                        className="flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    )}

                    {/* Google Sheets (AIA only) */}
                    {role === "ADMIN" && inv.type === "AIA" && (
                      <button onClick={() => handlePushToSheets(inv.id)}
                        disabled={sheetsLoading === inv.id}
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-60">
                        <ExternalLink className="w-3.5 h-3.5" />
                        {sheetsLoading === inv.id ? "Syncing..." : "Open in Sheets"}
                      </button>
                    )}

                    {/* Copy shareable link (Standard only) */}
                    {inv.shareToken && inv.type === "STANDARD" && (
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/invoice/${inv.shareToken}`;
                          navigator.clipboard.writeText(url).catch(() => {});
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium text-purple-700 border border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-50 transition-colors">
                        <Link2 className="w-3.5 h-3.5" /> Copy Link
                      </button>
                    )}
                  </div>

                  {/* Sheets error */}
                  {sheetsError && expandedInvoice === inv.id && (
                    <p className="text-xs text-red-600 mt-1">{sheetsError}</p>
                  )}

                  {/* Notes */}
                  {inv.notes && (
                    <p className="text-xs text-gray-500 italic">{inv.notes}</p>
                  )}

                  {/* Payment form */}
                  {showPayForm === inv.id && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-green-800">Record Payment</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                        <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                          placeholder="Amount" step="0.01" min="0"
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                        <input value={payCheck} onChange={e => setPayCheck(e.target.value)}
                          placeholder="Check #" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                        <input value={payRef} onChange={e => setPayRef(e.target.value)}
                          placeholder="Reference / ACH #" className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                        <input value={payNote} onChange={e => setPayNote(e.target.value)}
                          placeholder="Note (optional)" className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500" />
                      </div>
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={payRetainage} onChange={e => setPayRetainage(e.target.checked)}
                          className="rounded" />
                        Includes retainage release
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:border-green-500 hover:text-green-700 transition-colors bg-white">
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{payReceiptFile ? payReceiptFile.name : "Attach deposit receipt (optional)"}</span>
                        <input type="file" accept="image/*,.pdf" className="sr-only" onChange={e => setPayReceiptFile(e.target.files?.[0] ?? null)} />
                      </label>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowPayForm(null); setError(null); setPayReceiptFile(null); }}
                          className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                        <button onClick={() => handleAddPayment(inv.id)} disabled={pending || payReceiptUploading || !payAmount}
                          className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60">
                          {payReceiptUploading ? "Uploading…" : pending ? "Saving…" : "Save Payment"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Create new invoice */}
      {role === "ADMIN" && (
        showForm ? (
          <div className="py-3 space-y-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700">New Invoice</p>
            {/* Type toggle */}
            <div className="flex gap-2">
              {(["STANDARD", "AIA"] as const).map(t => (
                <button key={t} onClick={() => setInvType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    invType === t ? "bg-[#002D72] text-white border-[#002D72]" : "bg-white text-gray-600 border-gray-300 hover:border-[#002D72]/50"
                  }`}>
                  {t === "AIA" ? "AIA G702/G703" : "Standard"}
                </button>
              ))}
            </div>
            {/* Payment kind toggle (Standard only) */}
            {invType === "STANDARD" && (
              <div className="flex gap-2">
                {(["PROGRESS_PAYMENT", "FINAL_INVOICE"] as const).map(k => (
                  <button key={k} onClick={() => setInvKind(k)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      invKind === k ? "bg-[#FF5910] text-white border-[#FF5910]" : "bg-white text-gray-600 border-gray-300 hover:border-orange-400"
                    }`}>
                    {k === "FINAL_INVOICE" ? "Final Invoice" : "Progress Payment"}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Invoice Date *</label>
                <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Amount *</label>
                <input type="number" value={invAmount} onChange={e => setInvAmount(e.target.value)}
                  step="0.01" min="0"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              </div>
              {invType === "AIA" && (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Period To</label>
                    <input type="date" value={invPeriodTo} onChange={e => setInvPeriodTo(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Application No.</label>
                    <input type="number" value={invAppNo} onChange={e => setInvAppNo(e.target.value)}
                      placeholder="Auto"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Retainage %</label>
                <input type="number" value={invRetainagePct} onChange={e => setInvRetainagePct(e.target.value)}
                  step="0.1" min="0" max="100" placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              </div>
              {invType === "STANDARD" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Payment Terms</label>
                  <select value={invPaymentTerms} onChange={e => setInvPaymentTerms(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]">
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="net_10">Net 10</option>
                    <option value="net_15">Net 15</option>
                    <option value="net_30">Net 30</option>
                    <option value="net_45">Net 45</option>
                    <option value="net_60">Net 60</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input value={invNotes} onChange={e => setInvNotes(e.target.value)}
                  placeholder="Optional notes…"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              </div>
            </div>
            {/* ── Scope of Work Section Builder ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Scope of Work</label>
                <button type="button" onClick={() => { setShowInvBulletPicker(true); setInvBulletPickerTarget(null); setInvBulletSearch(""); }}
                  className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] font-medium">
                  📚 Library
                </button>
              </div>
              {invScopeSections.map((section, si) => (
                <div key={section.id} className="border border-gray-200 rounded-lg mb-2 overflow-hidden">
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1.5 border-b border-gray-200">
                    <input
                      value={section.title}
                      onChange={e => updateInvSection(section.id, "title", e.target.value)}
                      placeholder={`Section ${si + 1} title…`}
                      className="flex-1 bg-transparent text-xs font-semibold text-gray-700 focus:outline-none placeholder-gray-400"
                    />
                    <button type="button" onClick={() => { setShowInvBulletPicker(true); setInvBulletPickerTarget({ sectionId: section.id }); setInvBulletSearch(""); }}
                      className="text-xs text-[#002D72] hover:text-[#003d99] px-1.5 py-0.5 rounded hover:bg-blue-50">📚</button>
                    <button type="button" onClick={() => removeInvSection(section.id)}
                      className="text-gray-300 hover:text-red-500 px-1"><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <div className="p-2 space-y-1">
                    {section.items.map((item, ii) => (
                      <div key={ii} className="flex items-start gap-1">
                        <span className="text-gray-400 text-xs mt-1.5 shrink-0">•</span>
                        <input
                          value={item}
                          onChange={e => {
                            const next = [...section.items];
                            next[ii] = e.target.value;
                            updateInvSection(section.id, "items", next);
                          }}
                          className="flex-1 text-xs border-0 border-b border-gray-100 focus:border-[#002D72] focus:outline-none py-0.5 bg-white"
                        />
                        <button type="button"
                          onClick={() => {
                            const next = [...section.items];
                            const isSaved = savedBullets.includes(item);
                            toggleSavedBullet(item);
                            void isSaved;
                          }}
                          title={savedBullets.includes(item) ? "Remove from saved" : "Save bullet"}
                          className={`shrink-0 text-xs px-1 ${savedBullets.includes(item) ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}>⭐</button>
                        <button type="button"
                          onClick={() => {
                            const next = section.items.filter((_, i) => i !== ii);
                            updateInvSection(section.id, "items", next);
                          }}
                          className="shrink-0 text-gray-300 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                    <button type="button"
                      onClick={() => updateInvSection(section.id, "items", [...section.items, ""])}
                      className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] mt-1">
                      <Plus className="w-3 h-3" /> New bullet
                    </button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addInvSection}
                className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] font-medium mt-1">
                <Plus className="w-3.5 h-3.5" /> Add Section
              </button>
            </div>
            {parseFloat(invRetainagePct || "0") > 0 && parseFloat(invAmount || "0") > 0 && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                Retainage held: {fmt$(parseFloat(invAmount) * parseFloat(invRetainagePct) / 100)} ·
                Current Payment Due: {fmt$(parseFloat(invAmount) * (1 - parseFloat(invRetainagePct) / 100))}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setError(null); }}
                className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleCreate} disabled={pending || !invDate || !invAmount}
                className="bg-[#002D72] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
                {pending ? "Creating…" : "Create Invoice"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2.5 border-t border-gray-100">
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] font-medium">
              <Plus className="w-3.5 h-3.5" /> Create Invoice
            </button>
          </div>
        )
      )}

      {/* Totals */}
      <div className="border-t border-gray-200 mt-1">
        <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Total Invoiced</p>
          <span className="text-sm font-bold text-[#002D72] tabular-nums">{fmt$(totalInvoiced)}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Total Received</p>
          <span className="text-sm font-bold text-green-700 tabular-nums">{fmt$(totalPaid)}</span>
        </div>
        <div className="flex items-center justify-between py-3">
          <p className="text-sm font-bold text-gray-900">Outstanding Balance</p>
          <span className={`text-sm font-bold tabular-nums ${outstanding < 0 ? "text-red-600" : outstanding === 0 ? "text-green-700" : "text-orange-600"}`}>
            {fmt$(outstanding)}
          </span>
        </div>
      </div>

      {/* ── Bullet Picker Modal ── */}
      {showInvBulletPicker && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-4" onClick={() => setShowInvBulletPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-gray-100">
              <p className="font-semibold text-sm text-gray-900">Bullet Library</p>
              <button onClick={() => setShowInvBulletPicker(false)} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>
            <div className="flex gap-2 px-4 pt-3">
              {(["library", "saved"] as const).map(tab => (
                <button key={tab} onClick={() => setInvBulletPickerTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${invBulletPickerTab === tab ? "bg-[#002D72] text-white border-[#002D72]" : "bg-white text-gray-600 border-gray-300 hover:border-[#002D72]/50"}`}>
                  {tab === "library" ? "📚 Library" : `⭐ Saved (${savedBullets.length})`}
                </button>
              ))}
            </div>
            <div className="px-4 pt-2">
              <input value={invBulletSearch} onChange={e => setInvBulletSearch(e.target.value)}
                placeholder="Search bullets…"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {invBulletPickerTab === "library" ? (
                Object.entries(PRELOADED_SCOPE_BULLETS)
                  .map(([cat, bullets]) => {
                    const filtered = invBulletSearch
                      ? bullets.filter(b => b.toLowerCase().includes(invBulletSearch.toLowerCase()))
                      : bullets;
                    if (!filtered.length) return null;
                    return (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{cat}</p>
                        {filtered.map(bullet => (
                          <button key={bullet} type="button"
                            onClick={() => {
                              if (invBulletPickerTarget) {
                                insertInvBullet(invBulletPickerTarget.sectionId, bullet);
                              } else {
                                // No target section — add to last section or create one
                                if (invScopeSections.length === 0) {
                                  const newId = crypto.randomUUID();
                                  setInvScopeSections([{ id: newId, title: cat, items: [bullet] }]);
                                } else {
                                  const lastId = invScopeSections[invScopeSections.length - 1].id;
                                  insertInvBullet(lastId, bullet);
                                }
                              }
                            }}
                            className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-blue-50 text-xs text-gray-700 group">
                            <span className="text-gray-400 mt-0.5 shrink-0">•</span>
                            <span className="flex-1">{bullet}</span>
                            <span onClick={e => { e.stopPropagation(); toggleSavedBullet(bullet); }}
                              className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${savedBullets.includes(bullet) ? "text-yellow-500 opacity-100" : "text-gray-300 hover:text-yellow-400"}`}>⭐</span>
                          </button>
                        ))}
                      </div>
                    );
                  })
              ) : (
                savedBullets.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No saved bullets yet. Star bullets in the library to save them.</p>
                ) : (
                  savedBullets
                    .filter(b => !invBulletSearch || b.toLowerCase().includes(invBulletSearch.toLowerCase()))
                    .map(bullet => (
                      <button key={bullet} type="button"
                        onClick={() => {
                          if (invBulletPickerTarget) {
                            insertInvBullet(invBulletPickerTarget.sectionId, bullet);
                          } else {
                            if (invScopeSections.length === 0) {
                              const newId = crypto.randomUUID();
                              setInvScopeSections([{ id: newId, title: "Scope of Work", items: [bullet] }]);
                            } else {
                              const lastId = invScopeSections[invScopeSections.length - 1].id;
                              insertInvBullet(lastId, bullet);
                            }
                          }
                        }}
                        className="flex items-start gap-2 w-full text-left px-2 py-1.5 rounded-lg hover:bg-blue-50 text-xs text-gray-700 group">
                        <span className="text-yellow-500 mt-0.5 shrink-0">⭐</span>
                        <span className="flex-1">{bullet}</span>
                        <span onClick={e => { e.stopPropagation(); toggleSavedBullet(bullet); }}
                          className="shrink-0 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">×</span>
                      </button>
                    ))
                )
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button onClick={() => setShowInvBulletPicker(false)}
                className="w-full bg-[#002D72] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#003d99]">Done</button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Payment Log Card ──────────────────────────────────────────────────────────

function PaymentLogCard({ job, role }: {
  job: SummaryTabProps["job"]; role: Role;
}) {
  const [showForm, setShowForm] = useState(false);
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { startUpload } = useUpload("paymentReceipt");

  const payments = job.payments.map(p => ({ ...p, date: new Date(p.date) }));

  async function handleAdd() {
    setError(null);
    let receiptUrl: string | undefined;
    if (receiptFile) {
      setUploading(true);
      try {
        const res = await startUpload([receiptFile]);
        if (res?.[0]) receiptUrl = res[0].ufsUrl;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Receipt upload failed.");
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    startTransition(async () => {
      try {
        await addPayment(job.id, dateInput, amountInput, noteInput, undefined, undefined, undefined, undefined, receiptUrl);
        setAmountInput(""); setNoteInput(""); setReceiptFile(null); setShowForm(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  return (
    <SectionCard icon={<CreditCard className="w-4 h-4" />} title="Payment Log">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {payments.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">No payments recorded yet.</p>
      ) : (
        payments.map(p => (
          <div key={p.id} className="flex items-start gap-3 py-2.5 border-b border-gray-100">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-900">{fmt$(p.amount)}</p>
                {p.invoice && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                    Inv #{job.jobNumber}-{String(p.invoice.invoiceNumber).padStart(3, "0")}
                  </span>
                )}
                {p.includesRetainageRelease && (
                  <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">Ret. Release</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {fmtDate(p.date)}
                {p.checkNumber ? ` · Ck #${p.checkNumber}` : ""}
                {p.reference ? ` · ${p.reference}` : ""}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {p.receiptImageUrl && (
                <a href={p.receiptImageUrl} target="_blank" rel="noopener noreferrer"
                  className="block shrink-0" title="View receipt">
                  {/\.(jpg|jpeg|png|gif|webp|heic)$/i.test(p.receiptImageUrl) ? (
                    <img src={p.receiptImageUrl} alt="receipt" className="w-8 h-8 rounded object-cover border border-gray-200 hover:opacity-80" />
                  ) : (
                    <span className="text-xs text-blue-600 underline">Receipt</span>
                  )}
                </a>
              )}
              {role === "ADMIN" && (
                <button onClick={() => startTransition(() => deletePayment(p.id, job.id))}
                  className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))
      )}

      {role === "ADMIN" && (
        showForm ? (
          <div className="py-3 space-y-2 border-b border-gray-100">
            <p className="text-xs text-gray-500">Use "Record Payment" on an invoice above to link it, or add a standalone payment here.</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
              <input type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                placeholder="Amount" step="0.01" min="0"
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
              <input value={noteInput} onChange={e => setNoteInput(e.target.value)}
                placeholder="Note (optional)" className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer border border-dashed border-gray-300 rounded-lg px-3 py-2 hover:border-[#002D72] hover:text-[#002D72] transition-colors bg-white">
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{receiptFile ? receiptFile.name : "Attach deposit receipt (optional)"}</span>
              <input type="file" accept="image/*,.pdf" className="sr-only" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setError(null); setReceiptFile(null); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleAdd} disabled={pending || uploading || !amountInput}
                className="bg-[#002D72] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
                {uploading ? "Uploading…" : pending ? "Saving…" : "Add Payment"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2.5 border-b border-gray-100">
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs text-[#002D72] hover:text-[#003d99] font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Standalone Payment
            </button>
          </div>
        )
      )}
    </SectionCard>
  );
}

// ── Profitability Card ────────────────────────────────────────────────────────

function ProfitabilityCard({ job, role, companyRates, computed, overheadAllocation = 0 }: {
  job: SummaryTabProps["job"];
  role: Role;
  companyRates?: { defaultBurden: number; bidRates: Record<string, number> } | null;
  computed: {
    grossBilling: number;
    totalHours: number;
    materialsCost: number;
    subCost: number;
    equipmentBilled: number;
    otherTotal: number;
    totalMarkup: number;
  };
  overheadAllocation?: number;
}) {
  const [showDetail, setShowDetail] = useState(false);

  // ── Actual labor cost (burdened wages) ──────────────────────────────────────
  // Group hours by user and compute actual cost using their wage
  const defaultBurden = companyRates?.defaultBurden ?? 0.35;

  // Per-employee actual labor breakdown
  type EmployeeBreakdown = {
    name: string;
    title: string;
    year: string;
    hours: number;
    wage: number; // $/hr
    burdened: number; // $/hr burdened
    actualCost: number;
    bidRate: number; // $/hr from company rates
    bidCost: number;
  };

  const employeeMap = new Map<string, EmployeeBreakdown>();
  for (const entry of job.laborEntries) {
    const uid = entry.user.id;
    if (!employeeMap.has(uid)) {
      const wage = entry.user.wage;
      const hourlyWage = wage?.hourlyWage ?? 0;
      const burdenRate = wage?.burdenRate ?? defaultBurden;
      const burdened = hourlyWage * (1 + burdenRate);
      const title = wage?.title ?? "";
      const year = wage?.year ?? "";
      const bidKey = `${title}:${year}`;
      const bidRate = companyRates?.bidRates[bidKey] ?? companyRates?.bidRates[`${title}:`] ?? 0;
      employeeMap.set(uid, {
        name: entry.user.name ?? "Unknown",
        title,
        year,
        hours: 0,
        wage: hourlyWage,
        burdened,
        actualCost: 0,
        bidRate,
        bidCost: 0,
      });
    }
    const emp = employeeMap.get(uid)!;
    emp.hours += entry.hours;
    emp.actualCost += entry.hours * emp.burdened;
    emp.bidCost += entry.hours * emp.bidRate;
  }

  const employees = Array.from(employeeMap.values())
    .filter(e => e.hours > 0)
    .sort((a, b) => b.hours - a.hours);

  const actualLaborCost = employees.reduce((s, e) => s + e.actualCost, 0);
  const bidLaborCost = employees.reduce((s, e) => s + e.bidCost, 0);
  const hasWageData = employees.some(e => e.wage > 0);

  // ── Total actual cost (no markup — what we actually spent) ──────────────────
  const totalActualCost = actualLaborCost + computed.materialsCost + computed.subCost +
    computed.equipmentBilled + computed.otherTotal;

  // ── Profit / loss ───────────────────────────────────────────────────────────
  const grossProfit = computed.grossBilling - totalActualCost;
  const grossMarginPct = computed.grossBilling > 0
    ? (grossProfit / computed.grossBilling) * 100 : 0;
  const trueNetProfit = grossProfit - overheadAllocation;
  const trueNetMarginPct = computed.grossBilling > 0
    ? (trueNetProfit / computed.grossBilling) * 100 : 0;

  // Labor budget comparison (dollar-based)
  const rate = job.blendedLaborRate ? Number(job.blendedLaborRate) : 0;
  const laborCostToDate = computed.totalHours * rate;
  const laborBudgetDollars = job.laborBudgetDollars ? Number(job.laborBudgetDollars) : null;
  const laborBudgetVariance = laborBudgetDollars != null
    ? laborBudgetDollars - laborCostToDate : null;

  const profitable = grossProfit >= 0;

  if (role !== "ADMIN" && role !== "OFFICE") return null;

  return (
    <SectionCard icon={<TrendingUp className="w-4 h-4" />} title="Job Profitability">
      <button
        onClick={() => setShowDetail(v => !v)}
        className="w-full flex items-center justify-between py-3 text-xs text-gray-500 hover:text-[#002D72] transition-colors"
      >
        <span className="flex items-center gap-2">
          {profitable
            ? <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            : <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          }
          <span className="font-medium">
            Gross Profit: <span className={profitable ? "text-green-700" : "text-red-600"}>{fmt$(grossProfit)}</span>
            {computed.grossBilling > 0 && (
              <span className="text-gray-400 ml-1">({grossMarginPct.toFixed(1)}% margin)</span>
            )}
          </span>
        </span>
        {showDetail ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showDetail && (
        <div className="pb-3 space-y-1">
          {/* Revenue */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">Revenue (Gross Billing)</p>
            <p className="text-lg font-bold text-[#002D72] tabular-nums">{fmt$(computed.grossBilling)}</p>
          </div>

          {/* Cost breakdown */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider pb-1">Actual Costs</p>

          {/* Labor actual cost */}
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
            <div>
              <p className="text-sm text-gray-600">Labor (burdened wages)</p>
              {hasWageData ? (
                <p className="text-xs text-gray-400">{computed.totalHours.toFixed(1)} hrs · avg ${computed.totalHours > 0 ? (actualLaborCost / computed.totalHours).toFixed(2) : "0"}/hr burdened</p>
              ) : (
                <p className="text-xs text-orange-500">Wage data not set — set wages in Admin → Users</p>
              )}
            </div>
            <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">
              {hasWageData ? fmt$(actualLaborCost) : "—"}
            </span>
          </div>

          {/* Materials */}
          <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
            <p className="text-sm text-gray-600">Materials (actual cost)</p>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(computed.materialsCost)}</span>
          </div>

          {/* Subs */}
          {computed.subCost > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
              <p className="text-sm text-gray-600">Subcontractors</p>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(computed.subCost)}</span>
            </div>
          )}

          {/* Equipment */}
          {computed.equipmentBilled > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
              <p className="text-sm text-gray-600">Equipment (billed portion)</p>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(computed.equipmentBilled)}</span>
            </div>
          )}

          {/* Other */}
          {computed.otherTotal > 0 && (
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
              <p className="text-sm text-gray-600">Other Costs</p>
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(computed.otherTotal)}</span>
            </div>
          )}

          {/* Total actual cost */}
          <div className="flex items-center justify-between py-2 border-b border-gray-200">
            <p className="text-sm font-bold text-gray-900">Total Actual Cost</p>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(totalActualCost)}</span>
          </div>

          {/* Gross profit */}
          <div className={`flex items-center justify-between py-2.5 rounded-lg px-3 mt-1 ${
            profitable ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
          }`}>
            <p className={`text-sm font-bold ${profitable ? "text-green-800" : "text-red-800"}`}>
              Gross Profit / Loss
            </p>
            <div className="text-right">
              <span className={`text-sm font-bold tabular-nums ${profitable ? "text-green-700" : "text-red-600"}`}>
                {fmt$(grossProfit)}
              </span>
              {computed.grossBilling > 0 && (
                <p className={`text-xs ${profitable ? "text-green-600" : "text-red-500"}`}>
                  {grossMarginPct.toFixed(1)}% margin
                </p>
              )}
            </div>
          </div>

          {overheadAllocation > 0 && (
            <div className="flex justify-between items-center py-1.5 border-t border-gray-100">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Overhead Allocation
              </span>
              <span className="text-xs tabular-nums text-orange-600">-{fmt$(overheadAllocation)}</span>
            </div>
          )}
          {overheadAllocation > 0 && (
            <div className="flex justify-between items-center py-1.5 border-t border-gray-200 bg-gray-50 -mx-3 px-3 rounded-b">
              <span className="text-xs font-semibold text-gray-700">
                True Net Profit
                {computed.grossBilling > 0 && (
                  <span className="text-gray-400 font-normal ml-1">({trueNetMarginPct.toFixed(1)}%)</span>
                )}
              </span>
              <span className={`text-sm font-bold tabular-nums ${trueNetProfit >= 0 ? "text-green-700" : "text-red-600"}`}>
                {fmt$(trueNetProfit)}
              </span>
            </div>
          )}

          {/* Labor budget variance */}
          {laborBudgetVariance !== null && (
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-gray-500 mb-1">Labor Budget vs Actual</p>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Budget: {fmt$(laborBudgetDollars)} · Actual: {fmt$(laborCostToDate)}
                </p>
                <span className={`text-sm font-semibold tabular-nums ${laborBudgetVariance >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {laborBudgetVariance >= 0 ? "+" : ""}{fmt$(laborBudgetVariance)}
                </span>
              </div>
            </div>
          )}

          {/* Bid vs actual labor (if company rates configured) */}
          {hasWageData && bidLaborCost > 0 && (
            <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-500">Bid Rate vs Actual Labor Cost</p>
              </div>
              <div className="px-3 py-2 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Bid labor estimate</span>
                  <span className="font-semibold tabular-nums">{fmt$(bidLaborCost)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Actual burdened cost</span>
                  <span className="font-semibold tabular-nums">{fmt$(actualLaborCost)}</span>
                </div>
                <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-1">
                  <span className="text-gray-600">Variance</span>
                  <span className={`font-bold tabular-nums ${bidLaborCost >= actualLaborCost ? "text-green-700" : "text-red-600"}`}>
                    {bidLaborCost >= actualLaborCost ? "+" : ""}{fmt$(bidLaborCost - actualLaborCost)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Per-employee detail */}
          {employees.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-500">Per-Employee Labor Detail</p>
              </div>
              <div className="divide-y divide-gray-100">
                {employees.map((emp, i) => (
                  <div key={i} className="px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                        <p className="text-xs text-gray-400">
                          {emp.title}{emp.year ? ` · ${emp.year}` : ""}
                          {emp.wage > 0 ? ` · $${emp.wage.toFixed(2)}/hr · $${emp.burdened.toFixed(2)}/hr burdened` : " · no wage set"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums text-gray-900">{emp.hours.toFixed(1)} hrs</p>
                        {emp.wage > 0 && (
                          <p className="text-xs text-gray-500">{fmt$(emp.actualCost)} cost</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Main SummaryTab ───────────────────────────────────────────────────────────

export function SummaryTab({ job, role, companyRates = null, overheadAllocation = 0 }: SummaryTabProps) {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalHours = job.laborEntries.reduce((s, e) => s + e.hours, 0);
  const laborCost = job.blendedLaborRate != null ? totalHours * job.blendedLaborRate : null;
  const materialsCost = job.materials.reduce((s, m) => s + m.amount, 0);
  const subCost = job.subcontractorCost ?? 0;
  const subBillPct = job.subcontractorBillPct ?? 100;
  const subBilled = subCost * (subBillPct / 100);
  const equipmentCost = job.equipmentCost ?? 0;
  const equipmentBillPct = job.equipmentBillPct ?? 100;
  const equipmentBilled = equipmentCost * (equipmentBillPct / 100);
  const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];
  const otherTotal = otherCosts.reduce((s, c) => s + c.amount, 0);
  const totalDirectCosts = (laborCost ?? 0) + materialsCost + subBilled + equipmentBilled + otherTotal;

  const laborMarkup = laborCost != null && job.laborMarkupPct != null
    ? laborCost * (job.laborMarkupPct / 100) : null;
  const subMarkup = subBilled * ((job.subMarkupPct ?? 0) / 100);
  const equipMarkup = equipmentBilled * ((job.equipmentMarkupPct ?? 0) / 100);
  const materialMarkup = materialsCost * ((job.materialMarkupPct ?? 0) / 100);
  // Use per-item markupPct if available, fall back to job-level otherMarkupPct
  const otherMarkup = otherCosts.reduce((s, oc) => {
    const pct = oc.markupPct ?? job.otherMarkupPct ?? 0;
    return s + oc.amount * (pct / 100);
  }, 0);
  const totalMarkup = (laborMarkup ?? 0) + subMarkup + equipMarkup + materialMarkup + otherMarkup;

  const contractValue = job.contractValue ?? 0;
  const approvedCOs = job.changeOrders
    .filter(co => co.status === "APPROVED")
    .reduce((s, co) => s + (co.approvedValue ?? 0), 0);
  const revisedContract = contractValue + approvedCOs;
  const grossBilling = totalDirectCosts + totalMarkup;
  const pctComplete = revisedContract > 0 ? (grossBilling / revisedContract) * 100 : 0;

  const isEstimate = job.jobType === "ESTIMATE";
  const isTM = job.jobType === "TIME_AND_MATERIALS";

  // Estimate jobs: only ADMIN sees full financials
  if (isEstimate && role !== "ADMIN") {
    return (
      <div className="p-5">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-purple-800">Estimate — Admin Only</p>
          <p className="text-xs text-purple-600 mt-1">Financial details for Estimate jobs are visible to admins only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      {/* Job type banner */}
      {isTM && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Time &amp; Materials</span>
          <span className="text-xs text-amber-700">— Running costs tracked; no fixed contract value.</span>
        </div>
      )}
      {isEstimate && (
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5">
          <span className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Estimate</span>
          <span className="text-xs text-purple-700">— Pre-bid cost tracking. Not yet awarded.</span>
        </div>
      )}

      {/* Data freshness note + refresh */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {totalHours > 0 || materialsCost > 0
            ? `Totals: ${totalHours.toFixed(1)} hrs labor · ${fmt$(materialsCost)} materials`
            : "No labor or materials logged yet"}
        </span>
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-1 text-gray-400 hover:text-[#002D72] transition-colors"
          title="Refresh data from all tabs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Direct Costs — includes inline markup % per line */}
      <DirectCostsCard job={job} role={role} computed={{ totalHours, laborCost, materialsCost }} />

      {/* Schedule of Values — AIA G703 */}
      <ScheduleOfValuesCard job={job} role={role} grossBilling={grossBilling} computed={{ laborCost, materialsCost, subCost, equipmentCost, otherTotal, laborMarkup, subMarkup, equipMarkup, materialMarkup, otherMarkup }} />

      {/* Profitability — Admin & Office only */}
      {(role === "ADMIN" || role === "OFFICE") && (
        <ProfitabilityCard
          job={job}
          role={role}
          companyRates={companyRates}
          computed={{ grossBilling, totalHours, materialsCost, subCost, equipmentBilled, otherTotal, totalMarkup }}
          overheadAllocation={overheadAllocation}
        />
      )}

      {/* Deposit Request */}
      <DepositRequestCard job={job} role={role} />

      {/* Invoice Log */}
      <InvoiceLogCard
        job={job}
        role={role}
        grossBilling={grossBilling}
        computed={{ laborCost, materialsCost, subCost, equipmentCost, otherTotal, laborMarkup, subMarkup, equipMarkup, materialMarkup, otherMarkup }}
      />

      {/* Payment Log */}
      <PaymentLogCard job={job} role={role} />
    </div>
  );
}
