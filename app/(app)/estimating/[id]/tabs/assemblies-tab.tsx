"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  calcConduitRun, calcRack, calcMCHR, calcThreeWay,
  calcData, calcFA, calcGear, calcCan, calcCustomDev, calcLV, calcTM,
  fmt$,
} from "@/lib/estimating";
import type { Assembly, AssemblyLine, AssemblyResult, EstimateData } from "@/lib/estimating";

// ─── helpers ──────────────────────────────────────────────────────────────────

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const INPUT = "w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]";
const LABEL = "block text-xs font-medium text-gray-500 mb-1";
const SECT  = "text-xs font-bold text-[#1e3a8a] uppercase tracking-wide mt-4 mb-2 border-b border-blue-100 pb-1";
const DIFF_OPTS = [{ v:0.8,l:"Easy (0.8×)" },{ v:1.0,l:"Normal (1.0×)" },{ v:1.2,l:"Moderate (1.2×)" },{ v:1.5,l:"Hard (1.5×)" }];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={LABEL}>{label}</label>{children}</div>;
}

function Sel({ value, onChange, opts }: { value: string | number; onChange: (v: string) => void; opts: { v: string | number; l: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={INPUT}>
      {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

function Num({ value, onChange, min = 0, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return <input type="number" value={value} min={min} step={step} onChange={e => onChange(Number(e.target.value))} className={INPUT} />;
}

function Chk({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 rounded" />
      {label}
    </label>
  );
}

// ─── Line-item preview table ──────────────────────────────────────────────────

function LinePreview({ result, rate }: { result: AssemblyResult | null; rate: number }) {
  const [open, setOpen] = useState(false);
  if (!result) return <div className="text-sm text-gray-400 italic py-2">Fill in fields above to see preview</div>;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Summary bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-blue-50 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        <div className="flex gap-4 text-xs font-mono font-semibold text-[#1e3a8a]">
          <span>Mat {fmt$(result.mat)}</span>
          <span>Lab {fmt$(result.lab)}</span>
          <span className="border-l border-blue-200 pl-4">Total {fmt$(result.mat + result.lab)}</span>
        </div>
        <button className="text-gray-400">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
      </div>

      {open && (
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">Item</th>
              <th className="text-right px-2 py-1.5 font-medium w-16">Qty</th>
              <th className="text-right px-2 py-1.5 font-medium w-12">Unit</th>
              <th className="text-right px-3 py-1.5 font-medium w-20">Mat</th>
              <th className="text-right px-3 py-1.5 font-medium w-20">Lab</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((ln, i) => (
              <tr key={i} className={ln.mat === 0 && ln.lab === 0 && !ln.qty ? "bg-gray-50" : "border-t border-gray-100"}>
                <td className={`px-3 py-1 ${ln.mat === 0 && ln.lab === 0 && !ln.qty ? "font-semibold text-gray-500" : "text-gray-700"}`}>{ln.name}</td>
                <td className="text-right px-2 py-1 text-gray-500 tabular-nums">{typeof ln.qty === "number" ? ln.qty : ""}</td>
                <td className="text-right px-2 py-1 text-gray-400">{ln.unit}</td>
                <td className="text-right px-3 py-1 tabular-nums text-gray-700">{ln.mat > 0 ? fmt$(ln.mat) : ""}</td>
                <td className="text-right px-3 py-1 tabular-nums text-gray-700">{ln.lab > 0 ? fmt$(ln.lab) : ""}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 bg-blue-50 font-semibold text-[#1e3a8a]">
              <td className="px-3 py-1.5" colSpan={3}>Total</td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt$(result.mat)}</td>
              <td className="text-right px-3 py-1.5 tabular-nums">{fmt$(result.lab)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Saved assembly card ──────────────────────────────────────────────────────

function AsmCard({ asm, onDelete }: { asm: Assembly; onDelete: () => void }) {
  const mat = asm.mat ?? 0;
  const lab = asm.lab ?? 0;
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-gray-900 truncate">{asm.label}</div>
        <div className="flex gap-3 mt-1 text-xs font-mono text-gray-500">
          <span>Mat {fmt$(mat)}</span>
          <span>Lab {fmt$(lab)}</span>
          <span className="font-bold text-[#1e3a8a]">= {fmt$(mat + lab)}</span>
        </div>
      </div>
      <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Builder section wrapper ──────────────────────────────────────────────────

function BuilderSection({ title, result, qty, setQty, onAdd, children }: {
  title: string;
  result: AssemblyResult | null;
  qty: number;
  setQty: (n: number) => void;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
      <div className="text-sm font-bold text-[#1e3a8a]">{title}</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {children}
      </div>
      <LinePreview result={result} rate={0} />
      <div className="flex items-center justify-end gap-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Qty:</span>
          <input type="number" value={qty} min={1} max={20} onChange={e => setQty(Number(e.target.value))} className="w-14 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]" />
        </div>
        <button
          onClick={onAdd}
          disabled={!result}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add {qty > 1 ? `${qty} ` : ""}Assembly{qty > 1 ? "ies" : ""}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function AssembliesTab({
  assemblies,
  setAssemblies,
  data,
}: {
  assemblies: Assembly[];
  setAssemblies: (a: Assembly[]) => void;
  data: EstimateData;
}) {
  // ─── 1. CONDUIT RUN ─────────────────────────────────────────────────────────
  const [crType,      setCrType]      = useState("EMT");
  const [crSize,      setCrSize]      = useState("3/4");
  const [crNumCond,   setCrNumCond]   = useState(3);
  const [crWireSize,  setCrWireSize]  = useState("#12");
  const [crWireMat,   setCrWireMat]   = useState("Cu");
  const [crSuppType,  setCrSuppType]  = useState("1-Hole Strap");
  const [crFeet,      setCrFeet]      = useState(50);
  const [crMakeup,    setCrMakeup]    = useState(2);
  const [crSplice,    setCrSplice]    = useState(false);
  const [crDiff,      setCrDiff]      = useState(1.0);
  const [crQty,       setCrQty]       = useState(1);
  const crResult = crFeet > 0 ? calcConduitRun(crType, crSize, crNumCond, crWireSize, crWireMat, crSuppType, crFeet, crMakeup, 1, crSplice, crDiff) : null;

  // ─── 2. STRUT RACK ──────────────────────────────────────────────────────────
  const [rkMount,    setRkMount]    = useState("wall");
  const [rkSize,     setRkSize]     = useState("24");
  const [rkRodLen,   setRkRodLen]   = useState("24");
  const [rkCaps,     setRkCaps]     = useState(false);
  const [rkDiff,     setRkDiff]     = useState(1.0);
  const [rkQty,      setRkQty]      = useState(1);
  const rkResult = calcRack(rkMount, rkSize, rkMount === "hang" ? rkRodLen : "none", 1, rkCaps, rkDiff);

  // ─── 3. MC HOME RUN ─────────────────────────────────────────────────────────
  const [mcWire,    setMcWire]    = useState("12");
  const [mcCond,    setMcCond]    = useState(2);
  const [mcBkr,     setMcBkr]     = useState("20");
  const [mcSupp,    setMcSupp]    = useState("CJ6");
  const [mcFeet,    setMcFeet]    = useState(50);
  const [mcMakeup,  setMcMakeup]  = useState(12);
  const [mcDiff,    setMcDiff]    = useState(1.0);
  const [mcQty,     setMcQty]     = useState(1);
  const mcResult = mcFeet > 0 ? calcMCHR(mcWire, mcCond, mcBkr, mcSupp, mcFeet, mcMakeup, mcDiff) : null;

  // ─── 4. 3-WAY CIRCUIT ───────────────────────────────────────────────────────
  const [twType,      setTwType]      = useState("standard");
  const [twTraveler,  setTwTraveler]  = useState(30);
  const [twLumFt,     setTwLumFt]     = useState(0);
  const [twDiff,      setTwDiff]      = useState(1.0);
  const [twQty,       setTwQty]       = useState(1);
  const twResult = twTraveler > 0 ? calcThreeWay(twType, twTraveler, twLumFt, twDiff) : null;

  // ─── 5. DATA / CAT6 ─────────────────────────────────────────────────────────
  const [dtPorts,   setDtPorts]   = useState(1);
  const [dtEmt,     setDtEmt]     = useState(false);
  const [dtSupp,    setDtSupp]    = useState("jhook_sm");
  const [dtFeet,    setDtFeet]    = useState(75);
  const [dtMakeup,  setDtMakeup]  = useState(12);
  const [dtPP,      setDtPP]      = useState("none");
  const [dtDiff,    setDtDiff]    = useState(1.0);
  const [dtQty,     setDtQty]     = useState(1);
  const dtResult = dtFeet > 0 ? calcData(dtPorts, dtEmt, dtSupp, dtFeet, dtMakeup, dtPP, dtDiff) : null;

  // ─── 6. FIRE ALARM ──────────────────────────────────────────────────────────
  const [faFrame,   setFaFrame]   = useState("wood");
  const [faCircuit, setFaCircuit] = useState("slc");
  const [faDevice,  setFaDevice]  = useState("fad2");
  const [faPricing, setFaPricing] = useState("firelite");
  const [faWhip,    setFaWhip]    = useState(70);
  const [faHR,      setFaHR]      = useState(false);
  const [faDiff,    setFaDiff]    = useState(1.0);
  const [faQty,     setFaQty]     = useState(1);
  const faResult = calcFA(faFrame, faCircuit, faDevice, faPricing, faWhip, faHR, 1, faDiff);

  // ─── 7. PULL/SPLICE CAN ─────────────────────────────────────────────────────
  const [canSize,    setCanSize]    = useState("small");
  const [canMount,   setCanMount]   = useState("wall");
  const [canMat,     setCanMat]     = useState(25);
  const [canSpSize,  setCanSpSize]  = useState("#12");
  const [canSpQty,   setCanSpQty]   = useState(0);
  const [canDiff,    setCanDiff]    = useState(1.0);
  const [canQty,     setCanQty]     = useState(1);
  const canResult = calcCan(canSize, canMount, canMat, canSpSize, canSpQty, 1, canDiff);

  // ─── 8. GEAR & TRANSFORMERS ─────────────────────────────────────────────────
  const [grType,   setGrType]   = useState("panel");
  const [grSize,   setGrSize]   = useState("small");
  const [grMount,  setGrMount]  = useState(75);
  const [grKva,    setGrKva]    = useState("");
  const [grDesc,   setGrDesc]   = useState("");
  const [grDiff,   setGrDiff]   = useState(1.0);
  const [grQty,    setGrQty]    = useState(1);
  const grResult = calcGear(grType, grSize, grMount, grKva, grDesc, 1, grDiff);

  // ─── 9. CUSTOM DEVICE ───────────────────────────────────────────────────────
  const [cdDev,    setCdDev]    = useState("d1");
  const [cdCable,  setCdCable]  = useState("w1");
  const [cdBox,    setCdBox]    = useState("b1");
  const [cdPlate,  setCdPlate]  = useState("dp1");
  const [cdWhip,   setCdWhip]   = useState(20);
  const [cd2g,     setCd2g]     = useState(false);
  const [cdSupp,   setCdSupp]   = useState("CJ6");
  const [cdDiff,   setCdDiff]   = useState(1.0);
  const [cdQty,    setCdQty]    = useState(1);
  const cdResult = calcCustomDev(cdDev, cdCable, cdBox, cdPlate, cdWhip, cd2g, cdSupp, 1, cdDiff);

  // ─── 10. LV SPECIALTY ───────────────────────────────────────────────────────
  const [lvDev,    setLvDev]    = useState("camera");
  const [lvLoc,    setLvLoc]    = useState("indoor");
  const [lvFeet,   setLvFeet]   = useState(50);
  const [lvMakeup, setLvMakeup] = useState(12);
  const [lvDiff,   setLvDiff]   = useState(1.0);
  const [lvQty,    setLvQty]    = useState(1);
  const lvResult = lvFeet > 0 ? calcLV(lvDev, lvLoc, lvFeet, lvMakeup, 1, lvDiff) : null;

  // ─── CUSTOM (T&M) ───────────────────────────────────────────────────────────
  const [tmDesc,  setTmDesc]  = useState("");
  const [tmHours, setTmHours] = useState(0);
  const [tmMat,   setTmMat]   = useState(0);
  const [tmDiff,  setTmDiff]  = useState(1.0);
  const [tmQty,   setTmQty]   = useState(1);
  const tmResult = (tmHours > 0 || tmMat > 0) ? calcTM(tmDesc, tmHours, tmMat, tmDiff) : null;

  // ─── Add helper ─────────────────────────────────────────────────────────────
  function addAsm(result: AssemblyResult | null, type: Assembly["type"], qty: number, extraParams?: Record<string, string | number | boolean>) {
    if (!result) return;
    for (let i = 0; i < qty; i++) {
      const asm: Assembly = {
        id: newId(),
        type,
        label: result.label,
        params: extraParams ?? {},
        mat: result.mat,
        lab: result.lab,
        lines: result.lines,
      };
      assemblies = [...assemblies, asm];
    }
    setAssemblies(assemblies);
  }

  // ─── Totals ──────────────────────────────────────────────────────────────────
  const totals = assemblies.reduce(
    (acc, a) => ({ mat: acc.mat + (a.mat ?? 0), lab: acc.lab + (a.lab ?? 0) }),
    { mat: 0, lab: 0 }
  );

  return (
    <div className="space-y-6">

      {/* ── 1. CONDUIT RUN ─────────────────────────────────────────────────── */}
      <BuilderSection title="1 · Conduit Run" result={crResult} qty={crQty} setQty={setCrQty}
        onAdd={() => addAsm(crResult, "CONDUIT_RUN", crQty)}>
        <Field label="Type">
          <Sel value={crType} onChange={setCrType} opts={[
            { v:"EMT", l:"EMT" }, { v:"Sch40 PVC", l:"Sch40 PVC" },
            { v:"Sch80 PVC", l:"Sch80 PVC" }, { v:"Rigid", l:"Rigid" },
          ]} />
        </Field>
        <Field label="Size">
          <Sel value={crSize} onChange={setCrSize} opts={[
            { v:"1/2", l:'1/2"' }, { v:"3/4", l:'3/4"' }, { v:"1", l:'1"' },
            { v:"1-1/4", l:'1-1/4"' }, { v:"1-1/2", l:'1-1/2"' }, { v:"2", l:'2"' },
            { v:"3", l:'3"' }, { v:"4", l:'4"' },
          ]} />
        </Field>
        <Field label="Conductors">
          <Num value={crNumCond} onChange={setCrNumCond} min={1} />
        </Field>
        <Field label="Wire Size">
          <Sel value={crWireSize} onChange={setCrWireSize} opts={[
            "#14","#12","#10","#8","#6","#4","#3","#2","#1",
            "1/0","2/0","3/0","4/0","250kcmil","350kcmil","500kcmil","600kcmil","None"
          ].map(v => ({ v, l: v }))} />
        </Field>
        <Field label="Wire Material">
          <Sel value={crWireMat} onChange={setCrWireMat} opts={[{ v:"Cu",l:"Copper (Cu)" },{ v:"Al",l:"Aluminum (Al)" }]} />
        </Field>
        <Field label="Support">
          <Sel value={crSuppType} onChange={setCrSuppType} opts={[
            { v:"1-Hole Strap",l:"1-Hole Strap" }, { v:"Conduit Hanger",l:"Conduit Hanger" },
            { v:"Strut Clip",l:"Strut Clip" }, { v:"None",l:"None" },
          ]} />
        </Field>
        <Field label="Feet">
          <Num value={crFeet} onChange={setCrFeet} min={1} />
        </Field>
        <Field label="Makeup / end (ft)">
          <Num value={crMakeup} onChange={setCrMakeup} min={0} step={0.5} />
        </Field>
        <Field label="Difficulty">
          <Sel value={crDiff} onChange={v => setCrDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
        <div className="flex items-end pb-1">
          <Chk checked={crSplice} onChange={setCrSplice} label="Splice box" />
        </div>
      </BuilderSection>

      {/* ── 2. STRUT RACK ──────────────────────────────────────────────────── */}
      <BuilderSection title="2 · Strut Rack" result={rkResult} qty={rkQty} setQty={setRkQty}
        onAdd={() => addAsm(rkResult, "RACK", rkQty)}>
        <Field label="Mount Type">
          <Sel value={rkMount} onChange={setRkMount} opts={[{ v:"wall",l:"Wall Mount" },{ v:"hang",l:"Hanging" }]} />
        </Field>
        <Field label="Rack Size (in)">
          <Sel value={rkSize} onChange={setRkSize} opts={[
            { v:"18",l:'18"' },{ v:"24",l:'24"' },{ v:"48",l:'48"' },{ v:"60",l:'60"' }
          ]} />
        </Field>
        {rkMount === "hang" && (
          <Field label="Rod Length (in)">
            <Sel value={rkRodLen} onChange={setRkRodLen} opts={[
              { v:"12",l:'12"' },{ v:"24",l:'24"' },{ v:"36",l:'36"' },{ v:"48",l:'48"' },{ v:"60",l:'60"' },{ v:"72",l:'72"' },
            ]} />
          </Field>
        )}
        <Field label="Difficulty">
          <Sel value={rkDiff} onChange={v => setRkDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
        <div className="flex items-end pb-1">
          <Chk checked={rkCaps} onChange={setRkCaps} label="End caps" />
        </div>
      </BuilderSection>

      {/* ── 3. MC HOME RUN ─────────────────────────────────────────────────── */}
      <BuilderSection title="3 · MC Home Run" result={mcResult} qty={mcQty} setQty={setMcQty}
        onAdd={() => addAsm(mcResult, "MC_HOME_RUN", mcQty)}>
        <Field label="Wire Size">
          <Sel value={mcWire} onChange={setMcWire} opts={[{ v:"14",l:"#14" },{ v:"12",l:"#12" },{ v:"10",l:"#10" }]} />
        </Field>
        <Field label="Conductors">
          <Sel value={mcCond} onChange={v => setMcCond(Number(v))} opts={[{ v:2,l:"2-wire" },{ v:3,l:"3-wire" }]} />
        </Field>
        <Field label="Breaker">
          <Sel value={mcBkr} onChange={setMcBkr} opts={[{ v:"15",l:"15A" },{ v:"20",l:"20A" },{ v:"30",l:"30A" }]} />
        </Field>
        <Field label="Support">
          <Sel value={mcSupp} onChange={setMcSupp} opts={[
            { v:"CJ6",l:"CJ6 Colorado Jim" },
            { v:"1-Hole Strap",l:"1-Hole Strap" },
            { v:"Strut Clip",l:"Strut Clip" },
          ]} />
        </Field>
        <Field label="Feet">
          <Num value={mcFeet} onChange={setMcFeet} min={1} />
        </Field>
        <Field label="Makeup / end (in)">
          <Num value={mcMakeup} onChange={setMcMakeup} min={0} />
        </Field>
        <Field label="Difficulty">
          <Sel value={mcDiff} onChange={v => setMcDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
      </BuilderSection>

      {/* ── 4. 3-WAY CIRCUIT ───────────────────────────────────────────────── */}
      <BuilderSection title="4 · 3-Way Circuit" result={twResult} qty={twQty} setQty={setTwQty}
        onAdd={() => addAsm(twResult, "THREE_WAY", twQty)}>
        <Field label="Switch Type">
          <Sel value={twType} onChange={setTwType} opts={[
            { v:"standard",l:"Standard 3-Way" },
            { v:"dimming",l:"Dimming (AYCL-153P)" },
            { v:"volt010",l:"0-10V (Lutron DVSTV)" },
          ]} />
        </Field>
        <Field label="Traveler Footage (ft)">
          <Num value={twTraveler} onChange={setTwTraveler} min={1} />
        </Field>
        {twType === "volt010" && (
          <Field label="Luminaire Cable (ft)">
            <Num value={twLumFt} onChange={setTwLumFt} min={0} />
          </Field>
        )}
        <Field label="Difficulty">
          <Sel value={twDiff} onChange={v => setTwDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
      </BuilderSection>

      {/* ── 5. DATA / CAT6 ─────────────────────────────────────────────────── */}
      <BuilderSection title="5 · Data / CAT6 Location" result={dtResult} qty={dtQty} setQty={setDtQty}
        onAdd={() => addAsm(dtResult, "DATA", dtQty)}>
        <Field label="Ports">
          <Sel value={dtPorts} onChange={v => setDtPorts(Number(v))} opts={[{ v:1,l:"1-port" },{ v:2,l:"2-port" },{ v:3,l:"3-port" },{ v:4,l:"4-port" }]} />
        </Field>
        <Field label="Support">
          <Sel value={dtSupp} onChange={setDtSupp} opts={[
            { v:"jhook_sm",l:"Small J-Hook" },
            { v:"jhook_lg",l:"Large J-Hook" },
            { v:"ziptie",l:"Zip Tie" },
          ]} />
        </Field>
        <Field label="Footage">
          <Num value={dtFeet} onChange={setDtFeet} min={1} />
        </Field>
        <Field label="Makeup / end (in)">
          <Num value={dtMakeup} onChange={setDtMakeup} min={0} />
        </Field>
        <Field label="Patch Panel">
          <Sel value={dtPP} onChange={setDtPP} opts={[
            { v:"none",l:"None" },{ v:"pp1",l:"Small (12-24 port)" },
            { v:"pp2",l:"Medium (48 port)" },{ v:"pp3",l:"Large (96 port)" },
          ]} />
        </Field>
        <Field label="Difficulty">
          <Sel value={dtDiff} onChange={v => setDtDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
        <div className="flex items-end pb-1">
          <Chk checked={dtEmt} onChange={setDtEmt} label="EMT drop at box" />
        </div>
      </BuilderSection>

      {/* ── 6. FIRE ALARM ──────────────────────────────────────────────────── */}
      <BuilderSection title="6 · Fire Alarm Device" result={faResult} qty={faQty} setQty={setFaQty}
        onAdd={() => addAsm(faResult, "FA", faQty)}>
        <Field label="Frame Type">
          <Sel value={faFrame} onChange={setFaFrame} opts={[
            { v:"wood",l:"Wood / NM" },{ v:"metal",l:"Metal / MC" },{ v:"pipe",l:"Metal / Pipe" },
          ]} />
        </Field>
        <Field label="Circuit">
          <Sel value={faCircuit} onChange={setFaCircuit} opts={[
            { v:"slc",l:"SLC (Signal)" },{ v:"nac",l:"NAC (Notification)" },{ v:"ann",l:"Annunciator" },
          ]} />
        </Field>
        <Field label="Device">
          <Sel value={faDevice} onChange={setFaDevice} opts={[
            { v:"fad2",l:"Smoke Detector" },{ v:"fad3",l:"Heat Detector" },
            { v:"fad4",l:"Smoke/CO Combo" },{ v:"fad1",l:"Pull Station" },
            { v:"fad5",l:"Horn/Strobe" },{ v:"fad6",l:"Strobe" },
            { v:"fad7",l:"LF Sounder" },{ v:"fad8",l:"Beacon" },
            { v:"fad9",l:"Control Module" },{ v:"fad10",l:"Duct Smoke" },
            { v:"fad11",l:"Annunciator" },
            { v:"fad12",l:"Control Panel Small" },{ v:"fad13",l:"Control Panel Medium" },
            { v:"fad14",l:"Control Panel Large" },{ v:"fad15",l:"Radio Box" },
          ]} />
        </Field>
        <Field label="Pricing">
          <Sel value={faPricing} onChange={setFaPricing} opts={[
            { v:"firelite",l:"Fire-Lite List" },{ v:"quoted",l:"Per Quote" },
          ]} />
        </Field>
        <Field label="Whip Footage (ft)">
          <Num value={faWhip} onChange={setFaWhip} min={1} />
        </Field>
        <Field label="Difficulty">
          <Sel value={faDiff} onChange={v => setFaDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
        <div className="flex items-end pb-1">
          <Chk checked={faHR} onChange={setFaHR} label="Class A (home run ×2)" />
        </div>
      </BuilderSection>

      {/* ── 7. PULL/SPLICE CAN ─────────────────────────────────────────────── */}
      <BuilderSection title="7 · Pull / Splice Can" result={canResult} qty={canQty} setQty={setCanQty}
        onAdd={() => addAsm(canResult, "CAN", canQty)}>
        <Field label="Can Size">
          <Sel value={canSize} onChange={setCanSize} opts={[
            { v:"small",l:'Small 12×12×8"' },{ v:"medium",l:'Medium 18×18×8"' },
            { v:"large",l:'Large 24×24×10"' },{ v:"xl",l:'XL 36×36×18"' },
          ]} />
        </Field>
        <Field label="Mount Method">
          <Sel value={canMount} onChange={setCanMount} opts={[
            { v:"wall",l:"Wall Mount" },{ v:"strut",l:"Strut Mount" },
            { v:"rod",l:"Rod & Beam Clamp" },{ v:"surface",l:"Surface/Ceiling" },
          ]} />
        </Field>
        <Field label="Mount Materials ($)">
          <Num value={canMat} onChange={setCanMat} min={0} step={5} />
        </Field>
        <Field label="Splice Wire Size">
          <Sel value={canSpSize} onChange={setCanSpSize} opts={[
            "#14","#12","#10","#8","#6","#4","#2","#1","1/0","2/0","250kcmil","500kcmil"
          ].map(v => ({ v, l: v }))} />
        </Field>
        <Field label="Splice Count">
          <Num value={canSpQty} onChange={setCanSpQty} min={0} />
        </Field>
        <Field label="Difficulty">
          <Sel value={canDiff} onChange={v => setCanDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
      </BuilderSection>

      {/* ── 8. GEAR & TRANSFORMERS ─────────────────────────────────────────── */}
      <BuilderSection title="8 · Gear & Transformers" result={grResult ?? null} qty={grQty} setQty={setGrQty}
        onAdd={() => addAsm(grResult ?? null, "GEAR", grQty)}>
        <Field label="Type">
          <Sel value={grType} onChange={setGrType} opts={[
            { v:"panel",l:"Commercial Panel" },{ v:"xfmr",l:"Transformer" },
          ]} />
        </Field>
        <Field label="Size">
          <Sel value={grSize} onChange={setGrSize} opts={
            grType === "panel"
              ? [{ v:"small",l:"Small (≤225A)" },{ v:"medium",l:"Medium (400-800A)" },{ v:"large",l:"Large (1000A+)" }]
              : [{ v:"small",l:"Small (1-15 KVA)" },{ v:"medium",l:"Medium (25-75 KVA)" },{ v:"large",l:"Large (100-500 KVA)" },{ v:"xlarge",l:"Very Large (750+ KVA)" }]
          } />
        </Field>
        <Field label="Mount Materials ($)">
          <Num value={grMount} onChange={setGrMount} min={0} step={25} />
        </Field>
        {grType === "xfmr" && (
          <Field label="KVA">
            <input type="text" value={grKva} onChange={e => setGrKva(e.target.value)} placeholder="e.g. 45" className={INPUT} />
          </Field>
        )}
        <Field label="Description">
          <input type="text" value={grDesc} onChange={e => setGrDesc(e.target.value)} placeholder="Optional" className={INPUT} />
        </Field>
        <Field label="Difficulty">
          <Sel value={grDiff} onChange={v => setGrDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
      </BuilderSection>

      {/* ── 9. CUSTOM DEVICE ───────────────────────────────────────────────── */}
      <BuilderSection title="9 · Custom Device" result={cdResult} qty={cdQty} setQty={setCdQty}
        onAdd={() => addAsm(cdResult, "CUSTOM_DEV", cdQty)}>
        <Field label="Device">
          <Sel value={cdDev} onChange={setCdDev} opts={[
            { v:"d3",l:"20A GFCI Receptacle" },{ v:"d4",l:"15A TR GFCI Recept" },
            { v:"d1",l:"20A Receptacle" },{ v:"d2",l:"15A TR Receptacle" },
            { v:"d5",l:"SP Switch (spec)" },{ v:"d6",l:"SP Switch (trade)" },
            { v:"d7",l:"3-Way Switch" },{ v:"d9",l:"Dimmer AYCL-153P" },
            { v:"d14",l:"0-10V Dimmer" },{ v:"d15",l:"Occupancy Sensor" },
          ]} />
        </Field>
        <Field label="Cable">
          <Sel value={cdCable} onChange={setCdCable} opts={[
            { v:"w1",l:"12/2 MC" },{ v:"w2",l:"12/3 MC" },{ v:"w3",l:"10/2 MC" },
            { v:"rm1",l:"14/2 Romex" },{ v:"rm2",l:"12/2 Romex" },{ v:"rm3",l:"12/3 Romex" },
          ]} />
        </Field>
        <Field label="Box">
          <Sel value={cdBox} onChange={setCdBox} opts={[
            { v:"b1",l:'4" Square Deep' },{ v:"b2",l:'4" Square Shallow' },
            { v:"b3",l:"Old Work (plastic)" },{ v:"b4",l:"Weatherproof" },
            { v:"b5",l:"Gangable Plastic" },{ v:"b6",l:"Metal Handy Box" },
            { v:"b7",l:"Nail-On (Romex)" },
          ]} />
        </Field>
        <Field label="Plate">
          <Sel value={cdPlate} onChange={setCdPlate} opts={[
            { v:"dp1",l:"1G Recept Plate" },{ v:"dp2",l:"1G Switch Plate" },
            { v:"dp3",l:"2G Duplex Plate" },{ v:"dp5",l:"WP In-Use Cover" },{ v:"dp4",l:"Blank" },
          ]} />
        </Field>
        <Field label="Whip (ft)">
          <Num value={cdWhip} onChange={setCdWhip} min={1} />
        </Field>
        <Field label="Support">
          <Sel value={cdSupp} onChange={setCdSupp} opts={[
            { v:"CJ6",l:"CJ6" },{ v:"1-Hole Strap",l:"1-Hole Strap" },
            { v:"Staple",l:"Romex Staple" },{ v:"Strut Clip",l:"Strut Clip" },
          ]} />
        </Field>
        <Field label="Difficulty">
          <Sel value={cdDiff} onChange={v => setCdDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
        <div className="flex items-end pb-1">
          <Chk checked={cd2g} onChange={setCd2g} label="2-Gang" />
        </div>
      </BuilderSection>

      {/* ── 10. LV SPECIALTY ───────────────────────────────────────────────── */}
      <BuilderSection title="10 · LV Specialty Rough-In" result={lvResult} qty={lvQty} setQty={setLvQty}
        onAdd={() => addAsm(lvResult, "LV", lvQty)}>
        <Field label="Device Type">
          <Sel value={lvDev} onChange={setLvDev} opts={[
            { v:"camera",l:"Security Camera" },{ v:"reader",l:"Access Control Reader" },
            { v:"intercom",l:"Intercom Station" },{ v:"av",l:"TV/AV Outlet" },
            { v:"speaker",l:"Speaker" },{ v:"doorbell",l:"Doorbell/Call Button" },
          ]} />
        </Field>
        <Field label="Location">
          <Sel value={lvLoc} onChange={setLvLoc} opts={[{ v:"indoor",l:"Indoor" },{ v:"outdoor",l:"Outdoor" }]} />
        </Field>
        <Field label="Footage">
          <Num value={lvFeet} onChange={setLvFeet} min={1} />
        </Field>
        <Field label="Makeup / end (in)">
          <Num value={lvMakeup} onChange={setLvMakeup} min={0} />
        </Field>
        <Field label="Difficulty">
          <Sel value={lvDiff} onChange={v => setLvDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
      </BuilderSection>

      {/* ── T&M ────────────────────────────────────────────────────────────── */}
      <BuilderSection title="T&M / Time & Materials" result={tmResult} qty={tmQty} setQty={setTmQty}
        onAdd={() => addAsm(tmResult, "TM", tmQty)}>
        <div className="col-span-2 sm:col-span-3 lg:col-span-4">
          <label className={LABEL}>Description</label>
          <input type="text" value={tmDesc} onChange={e => setTmDesc(e.target.value)} placeholder="Labor description"
            className={INPUT} />
        </div>
        <Field label="Hours">
          <Num value={tmHours} onChange={setTmHours} min={0} step={0.25} />
        </Field>
        <Field label="Material Cost ($)">
          <Num value={tmMat} onChange={setTmMat} min={0} step={1} />
        </Field>
        <Field label="Difficulty">
          <Sel value={tmDiff} onChange={v => setTmDiff(Number(v))} opts={DIFF_OPTS.map(o => ({ v:o.v, l:o.l }))} />
        </Field>
      </BuilderSection>

      {/* ── Saved assemblies ──────────────────────────────────────────────── */}
      {assemblies.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold text-gray-700 px-1">Saved Assemblies ({assemblies.length})</div>
          {assemblies.map((asm, i) => (
            <AsmCard key={asm.id} asm={asm}
              onDelete={() => setAssemblies(assemblies.filter((_, j) => j !== i))} />
          ))}
          <div className="px-4 py-3 bg-blue-50 rounded-xl text-sm font-semibold text-[#1e3a8a] flex justify-between">
            <span>Assembly Totals</span>
            <span className="font-mono">Mat {fmt$(totals.mat)} · Lab {fmt$(totals.lab)} · Total {fmt$(totals.mat + totals.lab)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
