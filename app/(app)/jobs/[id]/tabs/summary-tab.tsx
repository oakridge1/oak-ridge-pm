"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Clock, Package, BarChart3, TrendingUp,
  Edit2, Save, X, Plus, Trash2, CreditCard, RefreshCw,
  FileText, ChevronDown, ChevronUp, Send, CheckCircle2, ExternalLink,
} from "lucide-react";
import {
  updateDirectCosts, updateMarkups,
  addOtherCost, deleteOtherCost,
  addPayment, deletePayment,
  updateContractBudget,
  createInvoice, updateInvoiceStatus, deleteInvoice,
} from "./summary-tab-actions";
import type { Role } from "@/app/generated/prisma/client";

type OtherCost = { id: string; description: string; amount: number };
type PaymentEntry = {
  id: string; date: Date; amount: number; note: string | null;
  checkNumber: string | null; reference: string | null;
  includesRetainageRelease: boolean;
  invoice: { id: string; invoiceNumber: number } | null;
};
type InvoiceEntry = {
  id: string; invoiceNumber: number; type: "STANDARD" | "AIA";
  date: Date; periodTo: Date | null; applicationNo: number | null;
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID";
  amount: number; retainagePct: number | null; retainageHeld: number | null;
  lineItems: unknown; notes: string | null;
  payments: { id: string; amount: number }[];
};
type ChangeOrder = { id: string; status: string; approvedValue: number | null };

type LineItem = { label: string; amount: number };

interface SummaryTabProps {
  job: {
    id: string;
    jobNumber: string;
    jobName: string;
    jobType: "BID" | "TIME_AND_MATERIALS" | "ESTIMATE";
    contractValue: number | null;
    laborBudgetHours: number | null;
    materialBudget: number | null;
    blendedLaborRate: number | null;
    subcontractorCost: number | null;
    equipmentCost: number | null;
    equipmentBillPct: number | null;
    otherCosts: unknown;
    laborMarkupPct: number | null;
    subMarkupPct: number | null;
    equipmentMarkupPct: number | null;
    laborEntries: { hours: number }[];
    materials: { amount: number }[];
    changeOrders: ChangeOrder[];
    payments: PaymentEntry[];
    invoices: InvoiceEntry[];
  };
  role: Role;
}

function fmt$(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
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

function DirectCostsCard({ job, role, computed }: {
  job: SummaryTabProps["job"]; role: Role;
  computed: { totalHours: number; laborCost: number | null; materialsCost: number; };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [rateInput, setRateInput] = useState(String(job.blendedLaborRate ?? ""));
  const [subInput, setSubInput] = useState(String(job.subcontractorCost ?? ""));
  const [equipInput, setEquipInput] = useState(String(job.equipmentCost ?? ""));
  const [billPctInput, setBillPctInput] = useState(String(job.equipmentBillPct ?? "100"));

  const [addDesc, setAddDesc] = useState("");
  const [addAmt, setAddAmt] = useState("");
  const [addingOther, setAddingOther] = useState(false);
  const [addPending, startAddTransition] = useTransition();

  const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];
  const subCost = job.subcontractorCost ?? 0;
  const equipCost = job.equipmentCost ?? 0;
  const equipBillPct = job.equipmentBillPct ?? 100;
  const otherTotal = otherCosts.reduce((s, c) => s + c.amount, 0);
  const totalDirect = (computed.laborCost ?? 0) + computed.materialsCost + subCost + equipCost + otherTotal;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateDirectCosts(job.id, {
          blendedLaborRate: rateInput,
          subcontractorCost: subInput,
          equipmentCost: equipInput,
          equipmentBillPct: billPctInput,
        });
        setEditing(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    });
  }

  function handleAddOther() {
    if (!addDesc.trim() || !addAmt) return;
    startAddTransition(async () => {
      try {
        await addOtherCost(job.id, addDesc, addAmt);
        setAddDesc(""); setAddAmt(""); setAddingOther(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed."); }
    });
  }

  return (
    <SectionCard icon={<DollarSign className="w-4 h-4" />} title="Direct Costs">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {role === "ADMIN" && (
        <div className="flex items-center justify-end gap-2 pt-3 pb-1 border-b border-gray-100 mb-1">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit Costs
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

      {/* Labor row */}
      <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
        <div>
          <p className="text-sm text-gray-600">Labor</p>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input type="number" value={rateInput} onChange={e => setRateInput(e.target.value)}
                placeholder="$/hr" step="0.01" min="0"
                className="w-24 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              <span className="text-xs text-gray-400">/hr blended rate</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">
              {computed.totalHours.toFixed(1)} hrs
              {job.blendedLaborRate != null ? ` @ $${job.blendedLaborRate.toFixed(2)}/hr` : " · set rate below"}
            </p>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {computed.laborCost != null ? fmt$(computed.laborCost) : "—"}
        </span>
      </div>

      {/* Materials row */}
      <Row label="Materials" value={fmt$(computed.materialsCost)} sub="From Materials tab" />

      {/* Subcontractors */}
      <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
        <p className="text-sm text-gray-600">Subcontractors</p>
        {editing ? (
          <input type="number" value={subInput} onChange={e => setSubInput(e.target.value)}
            placeholder="0.00" step="0.01" min="0"
            className="w-32 border border-gray-300 rounded px-2 py-1 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        ) : (
          <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(subCost)}</span>
        )}
      </div>

      {/* Equipment */}
      <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
        <div>
          <p className="text-sm text-gray-600">Equipment Rental</p>
          {editing ? (
            <div className="flex items-center gap-1.5 mt-1">
              <input type="number" value={billPctInput} onChange={e => setBillPctInput(e.target.value)}
                placeholder="100" step="1" min="0" max="100"
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              <span className="text-xs text-gray-400">% to bill this period</span>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">{equipBillPct}% to bill this period</p>
          )}
        </div>
        {editing ? (
          <input type="number" value={equipInput} onChange={e => setEquipInput(e.target.value)}
            placeholder="0.00" step="0.01" min="0"
            className="w-32 border border-gray-300 rounded px-2 py-1 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
        ) : (
          <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(equipCost)}</span>
        )}
      </div>

      {/* Other costs */}
      {otherCosts.map(oc => (
        <div key={oc.id} className="flex items-center justify-between py-2.5 border-b border-gray-100">
          <p className="text-sm text-gray-600">{oc.description}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(oc.amount)}</span>
            {role === "ADMIN" && (
              <button onClick={() => startTransition(() => deleteOtherCost(job.id, oc.id))}
                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add other cost */}
      {role === "ADMIN" && (
        addingOther ? (
          <div className="py-2.5 border-b border-gray-100 space-y-2">
            <div className="flex gap-2">
              <input value={addDesc} onChange={e => setAddDesc(e.target.value)} placeholder="Description (Permits, etc.)"
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              <input type="number" value={addAmt} onChange={e => setAddAmt(e.target.value)} placeholder="0.00" step="0.01" min="0"
                className="w-24 border border-gray-300 rounded px-2 py-1.5 text-xs text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setAddingOther(false); setAddDesc(""); setAddAmt(""); }} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
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

      {/* Total */}
      <div className="flex items-center justify-between py-3">
        <p className="text-sm font-bold text-gray-900">Total Direct Costs</p>
        <span className="text-sm font-bold text-[#002D72] tabular-nums">{fmt$(totalDirect)}</span>
      </div>
    </SectionCard>
  );
}

// ── Markups Card ──────────────────────────────────────────────────────────────

function MarkupsCard({ job, role, computed }: {
  job: SummaryTabProps["job"]; role: Role;
  computed: { laborCost: number | null; subCost: number; equipmentBilled: number; };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [laborPct, setLaborPct] = useState(String(job.laborMarkupPct ?? ""));
  const [subPct, setSubPct] = useState(String(job.subMarkupPct ?? ""));
  const [equipPct, setEquipPct] = useState(String(job.equipmentMarkupPct ?? ""));

  const laborMkp = computed.laborCost != null && job.laborMarkupPct != null
    ? computed.laborCost * (job.laborMarkupPct / 100) : null;
  const subMkp = computed.subCost * ((job.subMarkupPct ?? 0) / 100);
  const equipMkp = computed.equipmentBilled * ((job.equipmentMarkupPct ?? 0) / 100);
  const totalMarkup = (laborMkp ?? 0) + subMkp + equipMkp;

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMarkups(job.id, { laborMarkupPct: laborPct, subMarkupPct: subPct, equipmentMarkupPct: equipPct });
        setEditing(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    });
  }

  function MarkupRow({ label, pct, pctInput, setPctInput, mkpAmt }: {
    label: string; pct: number | null; pctInput: string; setPctInput: (v: string) => void; mkpAmt: number | null;
  }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b last:border-b-0 border-gray-100">
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-600">{label}</p>
          {editing ? (
            <div className="flex items-center gap-1">
              <input type="number" value={pctInput} onChange={e => setPctInput(e.target.value)}
                step="0.1" min="0" max="100" placeholder="0"
                className="w-16 border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          ) : (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{fmtPct(pct)}</span>
          )}
        </div>
        <span className="text-sm font-semibold text-gray-900 tabular-nums">
          {mkpAmt != null ? fmt$(mkpAmt) : "—"}
        </span>
      </div>
    );
  }

  return (
    <SectionCard icon={<TrendingUp className="w-4 h-4" />} title="Markups">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {role === "ADMIN" && (
        <div className="flex items-center justify-end gap-2 pt-3 pb-1 border-b border-gray-100 mb-1">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit Markups
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

      <MarkupRow label="Labor Overhead & Profit" pct={job.laborMarkupPct} pctInput={laborPct} setPctInput={setLaborPct} mkpAmt={laborMkp} />
      <MarkupRow label="Subcontractor Markup" pct={job.subMarkupPct} pctInput={subPct} setPctInput={setSubPct} mkpAmt={subMkp} />
      <MarkupRow label="Equipment Markup" pct={job.equipmentMarkupPct} pctInput={equipPct} setPctInput={setEquipPct} mkpAmt={equipMkp} />
      <div className="flex items-center justify-between py-3">
        <p className="text-sm font-bold text-gray-900">Total Markup</p>
        <span className="text-sm font-bold text-[#002D72] tabular-nums">{fmt$(totalMarkup)}</span>
      </div>
    </SectionCard>
  );
}

// ── Contract & Billing Card ───────────────────────────────────────────────────

function ContractBillingCard({ job, role, computed }: {
  job: SummaryTabProps["job"]; role: Role;
  computed: {
    approvedCOs: number; revisedContract: number;
    totalDirectCosts: number; totalMarkup: number; grossBilling: number; pctComplete: number;
  };
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [contractInput, setContractInput] = useState(String(job.contractValue ?? ""));
  const [hoursInput, setHoursInput] = useState(String(job.laborBudgetHours ?? ""));
  const [materialInput, setMaterialInput] = useState(String(job.materialBudget ?? ""));

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateContractBudget(job.id, {
          contractValue: contractInput,
          laborBudgetHours: hoursInput,
          materialBudget: materialInput,
        });
        setEditing(false);
      } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); }
    });
  }

  const { approvedCOs, revisedContract, totalDirectCosts, totalMarkup, grossBilling, pctComplete } = computed;

  return (
    <SectionCard icon={<BarChart3 className="w-4 h-4" />} title="Contract & Billing">
      {error && <p className="text-xs text-red-500 py-2">{error}</p>}

      {role === "ADMIN" && (
        <div className="flex items-center justify-end gap-2 pt-3 pb-1 border-b border-gray-100 mb-1">
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> Edit Budget
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

      {/* Contract Value + Budget — not applicable for T&M */}
      {job.jobType !== "TIME_AND_MATERIALS" && (
        <>
          {/* Contract Value */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
            <p className="text-sm text-gray-600">Original Contract Value</p>
            {editing ? (
              <input type="number" value={contractInput} onChange={e => setContractInput(e.target.value)}
                placeholder="0.00" step="0.01" min="0"
                className="w-36 border border-gray-300 rounded px-2 py-1 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
            ) : (
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(job.contractValue)}</span>
            )}
          </div>

          {/* Labor Budget Hours */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
            <p className="text-sm text-gray-600">Labor Budget</p>
            {editing ? (
              <div className="flex items-center gap-1.5">
                <input type="number" value={hoursInput} onChange={e => setHoursInput(e.target.value)}
                  placeholder="0" step="0.5" min="0"
                  className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
                <span className="text-xs text-gray-400">hrs</span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-gray-900 tabular-nums">
                {job.laborBudgetHours != null ? `${job.laborBudgetHours.toFixed(1)} hrs` : "—"}
              </span>
            )}
          </div>

          {/* Material Budget */}
          <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
            <p className="text-sm text-gray-600">Material Budget</p>
            {editing ? (
              <input type="number" value={materialInput} onChange={e => setMaterialInput(e.target.value)}
                placeholder="0.00" step="0.01" min="0"
                className="w-36 border border-gray-300 rounded px-2 py-1 text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
            ) : (
              <span className="text-sm font-semibold text-gray-900 tabular-nums">{fmt$(job.materialBudget)}</span>
            )}
          </div>
        </>
      )}

      {/* Computed rows */}
      <Row label="Total Direct Costs" value={fmt$(totalDirectCosts)} />
      <Row label="Total Markup" value={fmt$(totalMarkup)} />
      <Row label="Gross Billing Amount" value={fmt$(grossBilling)} accent bold />

      {/* Contract-vs-actual comparison — only for BID / ESTIMATE job types */}
      {job.jobType !== "TIME_AND_MATERIALS" && (
        <>
          <div className="border-b border-gray-100" />
          <Row label="Approved Change Orders" value={fmt$(approvedCOs)}
            sub={`${job.changeOrders.filter(c => c.status === "APPROVED").length} approved COs`} />
          <Row label="Revised Contract Total" value={fmt$(revisedContract)} accent bold />
          <div className="py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm text-gray-600">Percent Complete</p>
              <span className="text-sm font-bold text-[#002D72]">{pctComplete.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div className="bg-[#002D72] h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(pctComplete, 100)}%` }} />
            </div>
            <p className="text-xs text-gray-400 mt-1">Gross Billing ÷ Revised Contract</p>
          </div>
        </>
      )}

      {job.jobType === "TIME_AND_MATERIALS" && (
        <p className="text-xs text-gray-400 py-3">
          Time &amp; Materials job — billing based on running costs. No contract cap.
        </p>
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

  // Payment form state
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");
  const [payCheck, setPayCheck] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payRetainage, setPayRetainage] = useState(false);
  const [payNote, setPayNote] = useState("");

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
    if (computed.materialsCost > 0) items.push({ label: "Materials", amount: computed.materialsCost });
    if (computed.subCost > 0) {
      const subTotal = computed.subCost + computed.subMarkup;
      items.push({ label: "Subcontractors" + (job.subMarkupPct ? ` (incl. ${job.subMarkupPct}% markup)` : ""), amount: subTotal });
    }
    if (computed.equipmentCost > 0) {
      const equipTotal = computed.equipmentCost + computed.equipMarkup;
      items.push({ label: "Equipment Rental" + (job.equipmentMarkupPct ? ` (incl. ${job.equipmentMarkupPct}% markup)` : ""), amount: equipTotal });
    }
    const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];
    for (const oc of otherCosts) {
      items.push({ label: oc.description, amount: oc.amount });
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

  function handleAddPayment(invoiceId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await addPayment(job.id, payDate, payAmount, payNote, invoiceId, payCheck, payRef, payRetainage);
        setShowPayForm(null);
        setPayAmount(""); setPayCheck(""); setPayRef(""); setPayNote(""); setPayRetainage(false);
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
            Invoice #{String(duplicateWarning.invoiceNumber).padStart(3, "0")} was already created for{" "}
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
            : `Invoice #${String(inv.invoiceNumber).padStart(3, "0")}`;
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
                        download={`Invoice_${String(inv.invoiceNumber).padStart(3, "0")}.docx`}
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
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowPayForm(null); setError(null); }}
                          className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                        <button onClick={() => handleAddPayment(inv.id)} disabled={pending || !payAmount}
                          className="bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-60">
                          {pending ? "Saving…" : "Save Payment"}
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <input value={invNotes} onChange={e => setInvNotes(e.target.value)}
                  placeholder="Optional notes…"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#002D72]" />
              </div>
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payments = job.payments.map(p => ({ ...p, date: new Date(p.date) }));

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      try {
        await addPayment(job.id, dateInput, amountInput, noteInput);
        setAmountInput(""); setNoteInput(""); setShowForm(false);
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
                    Inv #{String(p.invoice.invoiceNumber).padStart(3, "0")}
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
            {role === "ADMIN" && (
              <button onClick={() => startTransition(() => deletePayment(p.id, job.id))}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
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
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowForm(false); setError(null); }} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={handleAdd} disabled={pending || !amountInput}
                className="bg-[#002D72] text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60">
                {pending ? "Saving…" : "Add Payment"}
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

// ── Main SummaryTab ───────────────────────────────────────────────────────────

export function SummaryTab({ job, role }: SummaryTabProps) {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalHours = job.laborEntries.reduce((s, e) => s + e.hours, 0);
  const laborCost = job.blendedLaborRate != null ? totalHours * job.blendedLaborRate : null;
  const materialsCost = job.materials.reduce((s, m) => s + m.amount, 0);
  const subCost = job.subcontractorCost ?? 0;
  const equipmentCost = job.equipmentCost ?? 0;
  const equipmentBillPct = job.equipmentBillPct ?? 100;
  const equipmentBilled = equipmentCost * (equipmentBillPct / 100);
  const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];
  const otherTotal = otherCosts.reduce((s, c) => s + c.amount, 0);
  const totalDirectCosts = (laborCost ?? 0) + materialsCost + subCost + equipmentCost + otherTotal;

  const laborMarkup = laborCost != null && job.laborMarkupPct != null
    ? laborCost * (job.laborMarkupPct / 100) : null;
  const subMarkup = subCost * ((job.subMarkupPct ?? 0) / 100);
  const equipMarkup = equipmentBilled * ((job.equipmentMarkupPct ?? 0) / 100);
  const totalMarkup = (laborMarkup ?? 0) + subMarkup + equipMarkup;

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

      {/* Direct Costs */}
      <DirectCostsCard job={job} role={role} computed={{ totalHours, laborCost, materialsCost }} />

      {/* Markups */}
      <MarkupsCard job={job} role={role} computed={{ laborCost, subCost, equipmentBilled }} />

      {/* Contract & Billing */}
      <ContractBillingCard job={job} role={role} computed={{ approvedCOs, revisedContract, totalDirectCosts, totalMarkup, grossBilling, pctComplete }} />

      {/* Invoice Log */}
      <InvoiceLogCard
        job={job}
        role={role}
        grossBilling={grossBilling}
        computed={{ laborCost, materialsCost, subCost, equipmentCost, otherTotal, laborMarkup, subMarkup, equipMarkup }}
      />

      {/* Payment Log */}
      <PaymentLogCard job={job} role={role} />
    </div>
  );
}
