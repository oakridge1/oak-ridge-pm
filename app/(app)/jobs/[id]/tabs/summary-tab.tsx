"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DollarSign, Clock, Package, BarChart3, TrendingUp,
  Edit2, Save, X, Plus, Trash2, CreditCard, RefreshCw,
} from "lucide-react";
import {
  updateDirectCosts, updateMarkups,
  addOtherCost, deleteOtherCost,
  addPayment, deletePayment,
  updateContractBudget,
} from "./summary-tab-actions";
import type { Role } from "@/app/generated/prisma/client";

type OtherCost = { id: string; description: string; amount: number };
type PaymentEntry = { id: string; date: Date; amount: number; note: string | null };
type ChangeOrder = { id: string; status: string; approvedValue: number | null };

interface SummaryTabProps {
  job: {
    id: string;
    jobNumber: string;
    jobName: string;
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

      {/* Edit / Save toolbar — ADMIN only */}
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
      <Row label="Materials" value={fmt$(computed.materialsCost)}
        sub="From Materials tab" />

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

// ── Payment Log Card ──────────────────────────────────────────────────────────

function PaymentLogCard({ job, role, revisedContract }: {
  job: SummaryTabProps["job"]; role: Role; revisedContract: number;
}) {
  const [showForm, setShowForm] = useState(false);
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payments = job.payments.map(p => ({ ...p, date: new Date(p.date) }));
  const totalBilled = payments.reduce((s, p) => s + p.amount, 0);
  const balance = revisedContract - totalBilled;

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
              <p className="text-sm font-medium text-gray-900">{fmt$(p.amount)}</p>
              <p className="text-xs text-gray-400">{fmtDate(p.date)}{p.note ? ` · ${p.note}` : ""}</p>
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
              <Plus className="w-3.5 h-3.5" /> Record Payment
            </button>
          </div>
        )
      )}

      <div className="flex items-center justify-between py-2.5 border-b border-gray-100">
        <p className="text-sm font-bold text-gray-900">Total Billed to Date</p>
        <span className="text-sm font-bold text-[#002D72] tabular-nums">{fmt$(totalBilled)}</span>
      </div>
      <div className="flex items-center justify-between py-3">
        <p className="text-sm font-bold text-gray-900">Balance Remaining to Bill</p>
        <span className={`text-sm font-bold tabular-nums ${balance < 0 ? "text-red-600" : "text-green-700"}`}>
          {fmt$(balance)}
        </span>
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

      {/* Computed rows */}
      <Row label="Approved Change Orders" value={fmt$(approvedCOs)}
        sub={`${job.changeOrders.filter(c => c.status === "APPROVED").length} approved COs`} />
      <Row label="Revised Contract Total" value={fmt$(revisedContract)} accent bold />
      <div className="border-b border-gray-100" />
      <Row label="Total Direct Costs" value={fmt$(totalDirectCosts)} />
      <Row label="Total Markup" value={fmt$(totalMarkup)} />
      <Row label="Gross Billing Amount" value={fmt$(grossBilling)} accent bold />
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
    </SectionCard>
  );
}

// ── Main SummaryTab ───────────────────────────────────────────────────────────

export function SummaryTab({ job, role }: SummaryTabProps) {
  const router = useRouter();

  // Refresh server data every time this tab becomes active so totals reflect
  // any labor/material entries added while on other tabs.
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

  const totalBilled = (job.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const balanceToBill = revisedContract - totalBilled;

  return (
    <div className="p-5 space-y-5">
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

      {/* Payment Log */}
      <PaymentLogCard job={job} role={role} revisedContract={revisedContract} />
    </div>
  );
}
