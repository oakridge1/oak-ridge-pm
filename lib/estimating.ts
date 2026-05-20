import type { BomItem } from "./bom";
import { BOM, NECA, R } from "./bom";

// ─── Core item types ──────────────────────────────────────────────────────────
export type TakeoffItem = {
  id: string;
  bomId: string;
  qty: number;
  note?: string;
  /** Per-item unit price override — overrides BOM default and BomPricing table for this estimate only */
  matOverride?: number;
  /** Per-item unit labor hrs override — overrides BOM default and BomPricing table for this estimate only */
  lhrOverride?: number;
};

/** One line in an assembly's material/labor breakdown */
export type AssemblyLine = {
  name: string;
  qty: number | string;
  unit: string;
  mat: number;
  lab: number;
};

/** Return type for all new calc functions */
export type AssemblyResult = {
  mat: number;
  lab: number;
  lines: AssemblyLine[];
  label: string;
};

export type AssemblyType =
  | "CONDUIT_RUN"
  | "MC_HOME_RUN"
  | "THREE_WAY"
  | "RACK"
  | "DATA"
  | "FA"
  | "GEAR"
  | "CAN"
  | "CUSTOM_DEV"
  | "LV"
  | "TM"
  | "CUSTOM";

export type Assembly = {
  id: string;
  type: AssemblyType;
  label: string;
  params: Record<string, string | number | boolean>;
  /** Pre-computed total material (markup included). Undefined on legacy assemblies. */
  mat?: number;
  /** Pre-computed total labor dollars. Undefined on legacy assemblies. */
  lab?: number;
  lines?: AssemblyLine[];
};

export type PanelItem = {
  id: string;
  panelBomId: string;
  breakerRows: Array<{ bomId: string; qty: number; circuit?: string }>;
};

export type PermitItem = { id: string; description: string; amount: number };
export type SubItem    = { id: string; description: string; amount: number };

export type EstimateData = {
  laborRate: number;
  bulkMarkup: number;
  lightMarkup: number;
  permitMarkup: number;
  subMarkup: number;
  overhead: number;
  profit: number;
  nonProd: number;
  designFeePct: number;
  conditionMult: number;
  heightAdj: boolean;
  takeoffItems: TakeoffItem[];
  assemblies: Assembly[];
  panelItems: PanelItem[];
  permits: PermitItem[];
  subs: SubItem[];
  /** Optional per-item price overrides loaded from the BomPricing table */
  bomOverrides?: Record<string, { mat: number; lhr: number }>;
};

export type LineCalc = {
  mat: number;
  lhr: number;
  laborCost: number;
  total: number;
};

export type BidTotals = {
  rawMat: number;
  markedUpMat: number;
  rawLhr: number;
  rawLabor: number;
  laborWithOverhead: number;
  subtotal: number;
  profit: number;
  grandTotal: number;
  designFee: number;
  permitTotal: number;
  subTotal: number;
  grandWithSubs: number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getBom(id: string): BomItem | undefined {
  return BOM.find(b => b.id === id);
}

/** Material with markup (matches HTML mmk) */
function mmk(id: string, qty: number): number {
  const it = getBom(id);
  if (!it) return 0;
  const mk = it.mk === "light" ? R.light : R.bulk;
  return it.mat * qty * (1 + mk);
}

/** Create a line-builder closure for use inside calc functions */
function makeLineBuilder(linesArr: AssemblyLine[], matRef: { v: number }, labRef: { v: number }) {
  function addM(id: string, qty: number, label?: string): void {
    const it = getBom(id);
    if (!it) {
      linesArr.push({ name: (label ?? id) + " [NEED PRICE]", qty, unit: "EA", mat: 0, lab: 0 });
      return;
    }
    const m = mmk(id, qty);
    matRef.v += m;
    linesArr.push({ name: label ?? it.name, qty, unit: it.unit, mat: m, lab: 0 });
  }
  function addL(lhr: number, qty: number, label: string, diff = 1.0): void {
    const l = lhr * qty * R.labor * diff;
    labRef.v += l;
    linesArr.push({ name: label, qty, unit: "EA", mat: 0, lab: l });
  }
  function addHeader(name: string): void {
    linesArr.push({ name, qty: "", unit: "", mat: 0, lab: 0 });
  }
  return { addM, addL, addHeader };
}

// ─── Conduit run lookup tables ────────────────────────────────────────────────

type CondEntry = {
  stick: string; coup?: string; conn?: string; lknt?: string;
  lhrFt: number; connType: "emt" | "pvc" | "rigid";
  glueJtsPer?: number;
};

const COND_MAP: Record<string, Record<string, CondEntry>> = {
  "EMT": {
    "1/2":   { stick:"e1", coup:"ef4",  conn:"ef1",   lhrFt:0.023, connType:"emt" },
    "3/4":   { stick:"e2", coup:"ef5",  conn:"ef2",   lhrFt:0.028, connType:"emt" },
    "1":     { stick:"e3", coup:"ef13", conn:"ef3",   lhrFt:0.033, connType:"emt" },
    "1-1/4": { stick:"e4", coup:"ef13", conn:"ef10b", lhrFt:0.038, connType:"emt" },
    "1-1/2": { stick:"e5", coup:"ef14", conn:"ef11",  lhrFt:0.043, connType:"emt" },
    "2":     { stick:"e6", coup:"ef15", conn:"ef12",  lhrFt:0.050, connType:"emt" },
  },
  "Sch40 PVC": {
    "1/2":   { stick:"pvc1", conn:"pvf1", lhrFt:0.020, connType:"pvc", glueJtsPer:5500 },
    "3/4":   { stick:"pvc2", conn:"pvf2", lhrFt:0.023, connType:"pvc", glueJtsPer:3000 },
    "1":     { stick:"pvc3", conn:"pvf4", lhrFt:0.026, connType:"pvc", glueJtsPer:1600 },
    "1-1/4": { stick:"pvc4", conn:"pvf4", lhrFt:0.033, connType:"pvc", glueJtsPer:1000 },
    "1-1/2": { stick:"pvc4", conn:"pvf6", lhrFt:0.038, connType:"pvc", glueJtsPer:800  },
    "2":     { stick:"pvc5", conn:"pvf7", lhrFt:0.043, connType:"pvc", glueJtsPer:275  },
    "3":     { stick:"pvc6", conn:"pvf8", lhrFt:0.055, connType:"pvc", glueJtsPer:160  },
    "4":     { stick:"pvc7", conn:"pvf8", lhrFt:0.065, connType:"pvc", glueJtsPer:100  },
  },
  "Sch80 PVC": {
    "1/2":   { stick:"p80_1", conn:"pvf1", lhrFt:0.022, connType:"pvc", glueJtsPer:5500 },
    "3/4":   { stick:"p80_2", conn:"pvf2", lhrFt:0.025, connType:"pvc", glueJtsPer:3000 },
    "1":     { stick:"p80_3", conn:"pvf4", lhrFt:0.028, connType:"pvc", glueJtsPer:1600 },
    "1-1/4": { stick:"p80_4", conn:"pvf4", lhrFt:0.033, connType:"pvc", glueJtsPer:1000 },
    "1-1/2": { stick:"p80_5", conn:"pvf6", lhrFt:0.038, connType:"pvc", glueJtsPer:800  },
    "2":     { stick:"p80_6", conn:"pvf7", lhrFt:0.043, connType:"pvc", glueJtsPer:275  },
  },
  "Rigid": {
    "1/2":   { stick:"rg1", lknt:"ln_12",  lhrFt:0.035, connType:"rigid" },
    "3/4":   { stick:"rg2", lknt:"ln_34",  lhrFt:0.040, connType:"rigid" },
    "1":     { stick:"rg3", lknt:"ln_1",   lhrFt:0.045, connType:"rigid" },
    "1-1/4": { stick:"rg4", lknt:"ln_114", lhrFt:0.050, connType:"rigid" },
    "1-1/2": { stick:"rg5", lknt:"ln_112", lhrFt:0.055, connType:"rigid" },
    "2":     { stick:"rg6", lknt:"ln_2",   lhrFt:0.060, connType:"rigid" },
    "3":     { stick:"rg7", lknt:"ln_3",   lhrFt:0.075, connType:"rigid" },
    "4":     { stick:"rg8", lknt:"ln_4",   lhrFt:0.090, connType:"rigid" },
  },
};

const WIRE_MAP: Record<string, Record<string, string>> = {
  "Cu": {
    "#14":"w_14cu","#12":"w5","#10":"w_10cu","#8":"w_8cu","#6":"w8",
    "#4":"w_4cu","#3":"w_3cu","#2":"w_2cu","#1":"w_1cu",
    "1/0":"w_1_0cu","2/0":"w_2_0cu","3/0":"w_3_0cu","4/0":"w_4_0cu",
    "250kcmil":"w_250cu","350kcmil":"w_350cu","400kcmil":"w_400cu",
    "500kcmil":"w_500cu","600kcmil":"w_600cu",
  },
  "Al": {
    "#14":"w_14cu","#12":"w5","#10":"w_10cu","#8":"w_8cu","#6":"w8",
    "#4":"w_4cu","#3":"w_3cu",
    "#2":"w_2al","#1":"w_1al",
    "1/0":"w_1_0al","2/0":"w_2_0al","3/0":"w_3_0al","4/0":"w_4_0al",
    "250kcmil":"w_250al","300kcmil":"w_300al","350kcmil":"w_350al",
    "400kcmil":"w_400al","500kcmil":"w_500al","600kcmil":"w_600al",
  },
};

const SUPP_MAP: Record<string, Record<string, string>> = {
  "1-Hole Strap":   { "1/2":"sp_emt12","3/4":"sp_emt34","1":"sp_emt1","1-1/4":"sp_emt114","1-1/2":"sp_emt112","2":"sp_emt2" },
  "Conduit Hanger": { "1/2":"sp_hng12","3/4":"sp_hng34","1":"sp_hng1","1-1/4":"sp_hng114","1-1/2":"sp_hng112","2":"sp_hng2" },
  "Strut Clip":     { "1/2":"sc1","3/4":"sp_cli34","1":"sc2","1-1/4":"sp_cli114","1-1/2":"sc3","2":"sp_cli2" },
};

const WIRE_PULL_LHR: Record<string, number> = {
  "#14":0.005,"#12":0.006,"#10":0.008,"#8":0.010,"#6":0.011,
  "#4":0.013,"#3":0.015,"#2":0.017,"#1":0.020,
  "1/0":0.023,"2/0":0.026,"3/0":0.030,"4/0":0.034,
  "250kcmil":0.038,"350kcmil":0.042,"400kcmil":0.045,"500kcmil":0.050,"600kcmil":0.055,
};

const MC_WIRE_MAP: Record<string, { mc2: string; mc3: string | null; lhr: number }> = {
  "12": { mc2:"w1",  mc3:"w2",  lhr:0.026 },
  "10": { mc2:"w3",  mc3:"w4",  lhr:0.029 },
  "14": { mc2:"w11", mc3:null,  lhr:0.026 },
};

const BKRTERM: Record<string, number> = { "15":0.32, "20":0.34, "30":0.38, "60":0.47, "100":0.61 };

const RACK_STRUT_FT: Record<string, number> = { "18":1.5, "24":2.0, "48":4.0, "60":5.0 };

const FA_DEVICES: Array<{ id: string; lbl: string; circuit: string; lhr: number }> = [
  { id:"fad2", lbl:"Smoke Detector",          circuit:"slc", lhr:0.35 },
  { id:"fad3", lbl:"Heat Detector",           circuit:"slc", lhr:0.35 },
  { id:"fad4", lbl:"Smoke/CO Combo",          circuit:"slc", lhr:0.45 },
  { id:"fad1", lbl:"Pull Station",            circuit:"slc", lhr:0.35 },
  { id:"fad9", lbl:"Control/Monitor Module",  circuit:"slc", lhr:0.45 },
  { id:"fad5", lbl:"Horn/Strobe",             circuit:"nac", lhr:0.35 },
  { id:"fad6", lbl:"Strobe",                  circuit:"nac", lhr:0.35 },
  { id:"fad7", lbl:"LF Sounder",              circuit:"nac", lhr:0.35 },
  { id:"fad8", lbl:"Beacon",                  circuit:"nac", lhr:0.35 },
  { id:"fad10",lbl:"Duct Smoke",              circuit:"slc", lhr:0.65 },
  { id:"fad11",lbl:"Annunciator",             circuit:"ann", lhr:1.00 },
];

const CUST_DEVICES: Array<{ id: string; lbl: string; aHr: number; gfci?: boolean }> = [
  { id:"d3",  lbl:"20A GFCI Receptacle",    aHr:0.85, gfci:true  },
  { id:"d4",  lbl:"15A TR GFCI Receptacle", aHr:0.85, gfci:true  },
  { id:"d1",  lbl:"20A Receptacle",         aHr:0.77 },
  { id:"d2",  lbl:"15A TR Receptacle",      aHr:0.77 },
  { id:"d5",  lbl:"SP Switch (spec)",       aHr:0.77 },
  { id:"d6",  lbl:"SP Switch (trade)",      aHr:0.77 },
  { id:"d7",  lbl:"3-Way Switch",           aHr:0.95 },
  { id:"d9",  lbl:"Dimmer AYCL-153P",       aHr:0.95 },
  { id:"d14", lbl:"0-10V Dimmer (Lutron)",  aHr:1.10 },
  { id:"d15", lbl:"Occupancy Sensor",       aHr:1.10 },
];

const LV_DEVICES: Array<{ id: string; lbl: string; lhr: number; autoBox: string; autoBox_out: string }> = [
  { id:"camera",   lbl:"Security Camera",      lhr:0.35, autoBox:"indoor_4sq", autoBox_out:"wp"       },
  { id:"reader",   lbl:"Access Control Reader", lhr:0.35, autoBox:"indoor_4sq", autoBox_out:"wp"       },
  { id:"intercom", lbl:"Intercom Station",      lhr:0.35, autoBox:"lv_ring",    autoBox_out:"wp"       },
  { id:"av",       lbl:"TV/AV Outlet",          lhr:0.35, autoBox:"lv_ring",    autoBox_out:"lv_ring"  },
  { id:"speaker",  lbl:"Speaker",               lhr:0.25, autoBox:"lv_ring",    autoBox_out:"wp"       },
  { id:"doorbell", lbl:"Doorbell/Call Button",  lhr:0.25, autoBox:"lv_ring",    autoBox_out:"wp"       },
];

const GEAR_DEF: Record<string, Record<string, { lbl: string; lhr: number; note: string }>> = {
  panel: {
    small:  { lbl:"Commercial Panel - Small (up to 225A)",  lhr:3.5,  note:"Up to 225A, 42 space" },
    medium: { lbl:"Commercial Panel - Medium (400A-800A)",  lhr:6.0,  note:"400A-800A distribution" },
    large:  { lbl:"Commercial Panel - Large (1000A+ gear)", lhr:12.0, note:"1000A+ switchgear/switchboard" },
  },
  xfmr: {
    small:  { lbl:"Transformer - Small (1-15 KVA)",          lhr:2.5,  note:"Dry type, 1-15 KVA" },
    medium: { lbl:"Transformer - Medium (25-75 KVA)",        lhr:4.0,  note:"Dry type, 25-75 KVA" },
    large:  { lbl:"Transformer - Large (100-500 KVA)",       lhr:8.0,  note:"Dry type, 100-500 KVA" },
    xlarge: { lbl:"Transformer - Very Large (750-2000 KVA)", lhr:14.0, note:"Dry type, 750-2000 KVA" },
  },
};

const CAN_DEF: Record<string, { lbl: string; lhr: number }> = {
  small:  { lbl:"Small (12x12x8)",  lhr:1.0 },
  medium: { lbl:"Medium (18x18x8)", lhr:1.5 },
  large:  { lbl:"Large (24x24x10)", lhr:2.5 },
  xl:     { lbl:"XL (36x36x18)",    lhr:4.0 },
};

// ─── Shared utility ───────────────────────────────────────────────────────────

/** Apply height adjustment (+15% labor) and condition multiplier to hours */
export function adjustLhr(lhr: number, data: Pick<EstimateData, "conditionMult" | "heightAdj" | "nonProd">): number {
  let h = lhr * data.conditionMult;
  if (data.heightAdj) h *= 1.15;
  if (data.nonProd > 0) h *= (1 + data.nonProd);
  return h;
}

/** Calculate a single takeoff line.
 *  Priority: item.matOverride > data.bomOverrides > static BOM default */
export function calcLine(item: TakeoffItem, data: EstimateData): LineCalc {
  const bom = BOM.find(b => b.id === item.bomId);
  if (!bom) return { mat: 0, lhr: 0, laborCost: 0, total: 0 };
  const ov = data.bomOverrides?.[item.bomId];
  const matBase = item.matOverride ?? ov?.mat ?? bom.mat;
  const lhrBase = item.lhrOverride ?? ov?.lhr ?? bom.lhr;
  const markup = bom.mk === "light" ? data.lightMarkup : data.bulkMarkup;
  const mat = matBase * item.qty * (1 + markup);
  const lhr = adjustLhr(lhrBase * item.qty, data);
  const laborCost = lhr * data.laborRate;
  return { mat, lhr, laborCost, total: mat + laborCost };
}

// ─── CONDUIT RUN ──────────────────────────────────────────────────────────────

/**
 * Calculate a conduit run assembly.
 * @param condType  "EMT" | "Sch40 PVC" | "Sch80 PVC" | "Rigid"
 * @param condSize  "1/2" | "3/4" | "1" | "1-1/4" | "1-1/2" | "2" | "3" | "4"
 * @param numCond   number of conductors
 * @param wireSize  "#12" | "#10" | "#8" | "#6" | ... | "None"
 * @param wireMat   "Cu" | "Al"
 * @param suppType  "1-Hole Strap" | "Conduit Hanger" | "Strut Clip" | "None"
 * @param feet      run length in feet
 * @param makeup    makeup length per end in feet (e.g. 2)
 * @param qty       number of identical runs
 * @param spliceBox add a splice box at end
 * @param diff      per-assembly difficulty multiplier
 */
export function calcConduitRun(
  condType: string, condSize: string, numCond: number,
  wireSize: string, wireMat: string, suppType: string,
  feet: number, makeup: number, qty: number, spliceBox: boolean, diff = 1.0
): AssemblyResult {
  const ft = feet;
  const q = qty || 1;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);

  const cm = COND_MAP[condType]?.[condSize];
  if (cm) {
    const sticksPerRun = Math.ceil(ft / 10);

    if (cm.connType === "emt") {
      const coupsPerRun = Math.max(0, sticksPerRun - 1);
      addM(cm.stick, sticksPerRun * q, `${condType} ${condSize} conduit (${sticksPerRun} sticks × ${q} runs)`);
      if (coupsPerRun > 0 && cm.coup) addM(cm.coup, coupsPerRun * q, `${condSize} coupling (${coupsPerRun} × ${q} runs)`);
      if (cm.conn) addM(cm.conn, 2 * q, `${condSize} connector (2/run × ${q} runs)`);

    } else if (cm.connType === "pvc") {
      addM(cm.stick, ft * q, `${condType} ${condSize} (${ft * q} ft total)`);
      const joints = sticksPerRun * q;
      const jtsPerCan = cm.glueJtsPer ?? 200;
      const cans = Math.max(0.05, Math.ceil((joints / jtsPerCan) * 100) / 100);
      const glueIt = getBom("pvc_glue");
      if (glueIt) {
        const gm = glueIt.mat * cans * (1 + R.bulk);
        matRef.v += gm;
        lines.push({ name: `PVC cement (${joints} joints)`, qty: +cans.toFixed(2), unit: "can", mat: gm, lab: 0 });
      }
      if (cm.conn) addM(cm.conn, 2 * q, `${condSize} terminal adapter (2/run × ${q} runs)`);

    } else if (cm.connType === "rigid") {
      addM(cm.stick, sticksPerRun * q, `Rigid ${condSize} (${sticksPerRun} sticks × ${q} runs)`);
      if (cm.lknt) addM(cm.lknt, 2 * q, `${condSize} locknut (2/run × ${q} runs)`);
    }

    // Conduit run labor
    const totalFt = ft * q;
    const runLab = totalFt * cm.lhrFt * diff * R.labor;
    labRef.v += runLab;
    lines.push({ name: `Conduit run labor (${totalFt} ft @ ${cm.lhrFt.toFixed(3)} × diff ${diff.toFixed(2)})`, qty: totalFt, unit: "FT", mat: 0, lab: runLab });

    if (cm.connType === "rigid") {
      const adder = matRef.v * 0.02;
      matRef.v += adder;
      lines.push({ name: "Rigid incidentals 2% adder", qty: 1, unit: "EA", mat: adder, lab: 0 });
    }
  }

  // Wire
  if (wireSize && wireSize !== "None") {
    const wireId = WIRE_MAP[wireMat]?.[wireSize];
    if (wireId) {
      const pullLhr = WIRE_PULL_LHR[wireSize] ?? 0.010;
      const wireFtPerRun = ft * numCond;
      const makeupFtPerRun = makeup * 2 * numCond;
      const totalWireFt = Math.ceil((wireFtPerRun + makeupFtPerRun) / 10) * 10 * q;
      const mkNote = makeup > 0 ? ` + ${makeup}ft/end makeup` : "";
      addM(wireId, totalWireFt, `${wireSize} ${wireMat} THHN (${numCond}×${ft}ft${mkNote} × ${q} = ${totalWireFt}ft bought)`);
      const wireLab = wireFtPerRun * q * pullLhr * diff * R.labor;
      labRef.v += wireLab;
      lines.push({ name: `Wire pull labor (${numCond}×${ft}ft × ${q} @ ${pullLhr.toFixed(3)} × diff ${diff.toFixed(2)})`, qty: wireFtPerRun * q, unit: "FT", mat: 0, lab: wireLab });
    }
  }

  // Supports — every 5ft
  if (suppType && suppType !== "None") {
    const totalRunFt = ft * q;
    const suppQty = Math.ceil(totalRunFt / 5);
    const suppId = SUPP_MAP[suppType]?.[condSize] ?? SUPP_MAP[suppType]?.["3/4"];
    if (suppId) addM(suppId, suppQty, `${condSize} ${suppType} (${suppQty} @ every 5ft)`);
  }

  // Splice box
  if (spliceBox) {
    addM("b1", q, `4" Square Deep Box for splice (×${q} runs)`);
    const mountCost = 3.00 * q * (1 + R.bulk);
    matRef.v += mountCost;
    lines.push({ name: `Splice box mount materials ($3 × ${q})`, qty: q, unit: "EA", mat: mountCost, lab: 0 });
    const boxLab = 0.30 * q * diff * R.labor;
    labRef.v += boxLab;
    lines.push({ name: `Box rough-in labor (${q} × 0.30hr × diff ${diff.toFixed(2)})`, qty: q, unit: "EA", mat: 0, lab: boxLab });
  }

  const qtyNote = q > 1 ? ` ×${q} runs` : "";
  const label = `${condType} ${condSize} | ${numCond}×${wireSize} ${wireMat} | ${suppType} | ${ft}ft${qtyNote}${spliceBox ? " + splice box" : ""}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── STRUT RACK ───────────────────────────────────────────────────────────────

/**
 * @param mountType  "wall" | "hang"
 * @param rackSize   "18" | "24" | "48" | "60" (inches)
 * @param rodLength  rod length in inches ("none" or number string)
 * @param qty        number of racks
 * @param caps       include strut end caps
 * @param diff       difficulty multiplier
 */
export function calcRack(
  mountType: string, rackSize: string, rodLength: string,
  qty: number, caps: boolean, diff = 1.0
): AssemblyResult {
  const q = qty || 1;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);

  const strutFt = (RACK_STRUT_FT[rackSize] ?? 2.0) * q;
  const strutIt = getBom("sh1");
  if (strutIt) {
    const sm = mmk("sh1", strutFt);
    const sl = strutIt.lhr * strutFt * R.labor; // strut has NECA lhr for install
    matRef.v += sm;
    labRef.v += sl;
    lines.push({ name: `1-5/8 Strut: ${strutFt}ft for ${q}×${rackSize}in racks`, qty: strutFt, unit: "FT", mat: sm, lab: sl });
  }

  if (mountType === "wall") {
    addM("rack_di",   2*q, "3/8 in Drop-In Anchor");
    addM("rack_fw",   2*q, "3/8 in Fender Washer");
    addM("rack_lw",   2*q, "3/8 in Lock Washer");
    addM("rack_bolt", 2*q, "3/8 in Hex Bolt");
  } else {
    addM("rack_bc", 2*q, "Beam Clamp 3/8 in");
    const rodFt = (parseInt(rodLength) || 0) / 12;
    if (rodFt > 0) {
      const totalRodFt = Math.ceil(rodFt * 2 * q);
      addM("rack_rod", totalRodFt, `3/8 in Threaded Rod (${totalRodFt}ft)`);
    }
    addM("rack_cn", 4*q, "3/8 in Coupling Nut");
    addM("rack_fw", 4*q, "3/8 in Fender Washer");
    addM("rack_lw", 4*q, "3/8 in Lock Washer");
  }

  if (caps) addM("rack_cap", 2*q, "Strut End Cap");

  // Labor
  let lhrEa: number;
  if (mountType === "wall") {
    lhrEa = 0.45 * diff;
  } else {
    const rl = parseInt(rodLength) || 0;
    lhrEa = (rl <= 24 ? 0.60 : rl <= 48 ? 0.70 : 0.80) * diff;
  }
  const totalLab = lhrEa * q * R.labor;
  labRef.v += totalLab;
  lines.push({ name: `Rack install labor (${q} racks × ${lhrEa.toFixed(2)}hr)`, qty: q, unit: "EA", mat: 0, lab: totalLab });

  const rodDesc = mountType === "hang" && rodLength !== "none" ? ` ${rodLength}in rod` : "";
  const capsDesc = caps ? " + caps" : "";
  const label = `${rackSize}in ${mountType} rack ×${q}${rodDesc}${capsDesc}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── MC HOME RUN ──────────────────────────────────────────────────────────────

/**
 * @param wireSize   "12" | "10" | "14"
 * @param numCond    2 or 3
 * @param bkrSize    "15" | "20" | "30"
 * @param suppType   "CJ6" | "1-Hole Strap" | "Strut Clip"
 * @param feet       run length in feet
 * @param makeupIn   makeup per end in inches (default 12)
 * @param diff       difficulty multiplier
 */
export function calcMCHR(
  wireSize: string, numCond: number, bkrSize: string,
  suppType: string, feet: number, makeupIn: number, diff = 1.0
): AssemblyResult {
  const ft = feet;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);

  const mkFt = makeupIn / 12;
  const wm = MC_WIRE_MAP[wireSize];
  const wireId = wm ? (numCond >= 3 && wm.mc3 ? wm.mc3 : wm.mc2) : "w1";
  const totalFt = Math.ceil((ft + mkFt * 2) / 10) * 10;
  addM(wireId, totalFt, `#${wireSize}/${numCond} MC Glide (${ft}ft + ${makeupIn}in/end = ${totalFt}ft bought)`);

  const pullLhr = (wm?.lhr ?? 0.026) * ft * diff * R.labor;
  labRef.v += pullLhr;
  lines.push({ name: `MC pull labor (${ft}ft × ${(wm?.lhr ?? 0.026).toFixed(3)} × diff ${diff.toFixed(2)})`, qty: ft, unit: "FT", mat: 0, lab: pullLhr });

  addM("mc1", 2, "Duplex Snap-In MC Connector (2 ends)");
  addM("b1",  1, '4" Square Deep Box');
  addM("mr1", 1, "SG 3/4 Mud Ring");
  addM("bs2", 2, "CJ6 box supports ×2");
  addM("wc1", numCond + 1, `Wire nuts (${numCond + 1})`);
  addM("gr1", 1, "Ground screw");

  const suppQty = Math.ceil(ft / 4) + 2;
  const MC_SUPP: Record<string, string> = { "CJ6":"bs2", "1-Hole Strap":"mc4", "Strut Clip":"sc1" };
  const suppId = MC_SUPP[suppType] ?? "bs2";
  addM(suppId, suppQty, `${suppType} supports (${suppQty} @ every 4ft + 2 at boxes)`);

  addL(0.30, 1, "Box rough-in labor", diff);
  addL(0.04, numCond + 1, `Wire nut terminations (${numCond + 1})`, diff);
  addL(0.04, 1, "Ground screw termination", diff);

  const bkrTerm = BKRTERM[bkrSize] ?? 0.34;
  addL(bkrTerm, 1, `${bkrSize}A breaker termination (NECA Sec 4)`, diff);

  const label = `#${wireSize}/${numCond} MC | ${ft}ft | ${bkrSize}A bkr | ${suppType}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── THREE-WAY CIRCUIT ────────────────────────────────────────────────────────

/**
 * @param swType     "standard" | "dimming" | "volt010"
 * @param travelerFt traveler cable footage
 * @param lumFt      luminaire cable footage (0-10V only)
 * @param diff       difficulty multiplier
 */
export function calcThreeWay(
  swType: string, travelerFt: number, lumFt: number, diff = 1.0
): AssemblyResult {
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL, addHeader } = makeLineBuilder(lines, matRef, labRef);

  // ── Feed Side ────────────────────────────────────────────────────────────────
  addHeader("── Feed Side ──");
  addM("w1",  20,  "12/2 MC 20ft (feed)");
  addM("mc1",  1,  "MC Connector (feed)");
  addM("b1",   1,  '4" Square Deep Box');
  addM("bs1",  1,  "C23 Bracket");
  addM("mr1",  1,  "SG Mud Ring");
  addM("bs2",  2,  "CJ6 ×2");
  addM("d7",   1,  "3-Way Switch (feed)");
  addM("dp2",  1,  "1G Switch Plate");
  addM("wc1",  3,  "Wire Nuts ×3");
  addM("gr1",  1,  "Ground Screw");
  addL(0.30,   1,  "Box rough-in labor (feed)", diff);
  addL(0.95,   1,  "3-Way switch termination (feed)", diff);

  // ── Traveler ─────────────────────────────────────────────────────────────────
  addHeader("── Traveler ──");
  const tvBought = Math.ceil((travelerFt + 2) / 10) * 10;
  addM("w2", tvBought, `12/3 MC Traveler (${travelerFt}ft + makeup = ${tvBought}ft bought)`);
  addM("mc1", 2, "MC Connector ×2 (traveler ends)");
  const tvPull = travelerFt * 0.028 * diff * R.labor;
  labRef.v += tvPull;
  lines.push({ name: `12/3 MC pull labor (${travelerFt}ft @ 0.028 × diff ${diff.toFixed(2)})`, qty: travelerFt, unit: "FT", mat: 0, lab: tvPull });

  // ── Switchleg Side ───────────────────────────────────────────────────────────
  addHeader("── Switchleg Side ──");
  addM("w1",  20,  "12/2 MC 20ft (switchleg)");
  addM("mc1",  1,  "MC Connector (switchleg)");
  addM("b1",   1,  '4" Square Deep Box');
  addM("bs1",  1,  "C23 Bracket");
  addM("mr1",  1,  "SG Mud Ring");
  addM("bs2",  2,  "CJ6 ×2");
  addM("wc1",  3,  "Wire Nuts ×3");
  addM("gr1",  1,  "Ground Screw");
  addL(0.30,   1,  "Box rough-in labor (switchleg)", diff);

  if (swType === "standard" || swType === "") {
    addM("d7",  1,  "3-Way Switch (switchleg)");
    addM("dp2", 1,  "1G Switch Plate");
    addL(0.95,  1,  "3-Way switch termination (switchleg)", diff);
  } else if (swType === "dimming") {
    addM("d9",  1,  "Dimmer AYCL-153P (switchleg)");
    addM("dp2", 1,  "1G Switch Plate");
    addL(0.95,  1,  "Dimmer termination (switchleg)", diff);
  } else if (swType === "volt010") {
    addM("d14", 1,  "Lutron 0-10V DVSTV Dimmer (switchleg)");
    addM("dp2", 1,  "1G Switch Plate");
    addL(1.10,  1,  "0-10V Dimmer termination (switchleg)", diff);
    if (lumFt > 0) {
      const lumBought = Math.ceil((lumFt + 2) / 10) * 10;
      addM("w16", lumBought, `Luminaire Cable (${lumFt}ft = ${lumBought}ft bought)`);
      const lumPull = lumFt * 0.026 * diff * R.labor;
      labRef.v += lumPull;
      lines.push({ name: `Luminaire cable pull (${lumFt}ft @ 0.026 × diff ${diff.toFixed(2)})`, qty: lumFt, unit: "FT", mat: 0, lab: lumPull });
    }
  }

  const typeLabel = swType === "standard" || swType === "" ? "Standard" : swType === "dimming" ? "Dimming (AYCL)" : "0-10V (Lutron)";
  const label = `3-Way ${typeLabel} | ${travelerFt}ft traveler${swType === "volt010" && lumFt ? ` | ${lumFt}ft lum cable` : ""}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── DATA / CAT6 ──────────────────────────────────────────────────────────────

/**
 * @param ports      1 | 2 | 3 | 4
 * @param emtDrop    include 10ft EMT drop at box end
 * @param support    "jhook_sm" | "jhook_lg" | "ziptie"
 * @param feet       cable run footage
 * @param makeupIn   makeup per end in inches (default 12)
 * @param patchPanel "none" | "pp1" | "pp2" | "pp3"
 * @param diff       difficulty multiplier
 */
export function calcData(
  ports: number, emtDrop: boolean, support: string,
  feet: number, makeupIn: number, patchPanel: string, diff = 1.0
): AssemblyResult {
  const ft = feet;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);

  const mkFt = makeupIn / 12;
  const totalCableFt = Math.ceil((ft * ports + mkFt * 2 * ports) / 10) * 10;
  addM("w14", totalCableFt, `Cat6 Cable (${ports} runs × ${ft}ft + makeup = ${totalCableFt}ft bought)`);

  const pullLab = ft * ports * 0.010 * diff * R.labor;
  labRef.v += pullLab;
  lines.push({ name: `Cable pull labor (${ports}×${ft}ft @ 0.010 × diff ${diff.toFixed(2)})`, qty: ports * ft, unit: "FT", mat: 0, lab: pullLab });

  const suppQty = Math.ceil(ft / 4) + 2;
  const suppId = support === "jhook_sm" ? "lv2" : support === "jhook_lg" ? "lv3" : "lv4";
  const suppName = support === "jhook_sm" ? "J-Hook Small" : support === "jhook_lg" ? "J-Hook Large" : "Zip Tie";
  addM(suppId, suppQty, `${suppName} (${suppQty} @ every 4ft + 2 at ends)`);

  if (emtDrop) {
    addM("e1",       1, '1/2" EMT 10ft stick');
    addM("lv1",      2, "TSGB16 Strut Bracket ×2");
    addM("sp_emt12", 2, '1/2" 1-Hole Strap ×2');
    addM("ef1",      1, '1/2" Box Connector');
    addM("mr1",      1, "SG Mud Ring");
    addL(0.15,       1, "Field bent 90 labor", diff);
    addL(0.30,       1, "EMT drop install labor", diff);
  } else {
    addM("bs2", 3, "CJ6 ×3");
    addM("mr1", 1, "SG Mud Ring");
    addL(0.20,  1, "Box rough-in labor", diff);
  }

  addM("dp7", ports, `Cat6 Keystone (${ports} port)`);
  if (ports <= 2) {
    addM(ports === 1 ? "dp9" : "dp8", 1, `${ports}-port keystone plate`);
  } else {
    addM("dp8", 2, `2-port keystone plate ×2 (${ports} ports)`);
  }
  addL(0.15, ports, `Keystone termination ×${ports} (patch panel end)`, diff);
  addL(0.15, ports, `Keystone termination ×${ports} (outlet end)`, diff);

  if (patchPanel && patchPanel !== "none") {
    addM(patchPanel, 1, "Patch Panel");
    addL(0.50, 1, "Patch panel mount labor", diff);
  }

  const dropDesc = emtDrop ? " + EMT drop" : "";
  const suppDesc = support === "jhook_sm" ? "sm J-hook" : support === "jhook_lg" ? "lg J-hook" : "zip tie";
  const ppDesc = patchPanel && patchPanel !== "none" ? " + patch panel" : "";
  const label = `${ports}-port data${dropDesc} | ${ft}ft | ${suppDesc}${ppDesc}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── FIRE ALARM ───────────────────────────────────────────────────────────────

function faCableId(frameType: string, circuitType: string): string {
  if (circuitType === "ann") return frameType === "wood" ? "fa5" : "fa6";
  if (circuitType === "slc") return frameType === "wood" ? "fa1" : "fa3";
  return frameType === "wood" ? "fa2" : "fa4";
}

function _calcFAPower(diff: number): AssemblyResult {
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);
  const wireFt = Math.ceil(27 / 10) * 10;
  addM("w1",  wireFt, `12/2 MC 25ft power circuit (${wireFt}ft bought)`);
  addM("mc1", 2, "MC Connector ×2");
  addM("b1",  1, '4" Square Deep Box');
  addM("bs1", 1, "C23 Bracket");
  addM("mr1", 1, "SG Mud Ring");
  addM("bs2", 2, "CJ6 ×2");
  addM("wc1", 3, "Wire Nuts ×3");
  addM("gr1", 1, "Ground Screw");
  addL(0.30, 1, "Box rough-in labor", diff);
  addL(0.34, 1, "20A Breaker termination (NECA Sec 4)", diff);
  const pullLab = 25 * 0.026 * diff * R.labor;
  labRef.v += pullLab;
  lines.push({ name: "MC pull labor (25ft)", qty: 25, unit: "FT", mat: 0, lab: pullLab });
  return { mat: matRef.v, lab: labRef.v, lines, label: "FA Power Circuit" };
}

/**
 * @param frameType   "wood" | "metal" | "pipe"
 * @param circuitType "slc" | "nac" | "ann"
 * @param deviceId    BOM ID e.g. "fad2"
 * @param pricing     "firelite" | "quoted"
 * @param whipFt      cable footage per device
 * @param homeRun     Class A (doubles footage)
 * @param qty         number of devices
 * @param diff        difficulty multiplier
 */
export function calcFA(
  frameType: string, circuitType: string, deviceId: string,
  pricing: string, whipFt: number, homeRun: boolean, qty: number, diff = 1.0
): AssemblyResult {
  const q = qty || 1;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL, addHeader } = makeLineBuilder(lines, matRef, labRef);

  const devDef = FA_DEVICES.find(d => d.id === deviceId);
  const devLhr = devDef?.lhr ?? 0.35;

  const cableId = faCableId(frameType, circuitType);
  const baseFt = whipFt * q;
  const totalFt = homeRun ? baseFt * 2 : baseFt;
  const cableBought = Math.ceil((totalFt + q * 2) / 10) * 10;
  const hrNote = homeRun ? " (Class A ×2)" : "";
  addM(cableId, cableBought, `FA Cable (${q}×${whipFt}ft${hrNote} = ${cableBought}ft bought)`);

  const cableIt = getBom(cableId);
  const cableLhr = cableIt?.lhr ?? 0.010;
  const pullLab = totalFt * cableLhr * diff * R.labor;
  labRef.v += pullLab;
  lines.push({ name: `Cable pull labor (${totalFt}ft @ ${cableLhr.toFixed(3)})`, qty: totalFt, unit: "FT", mat: 0, lab: pullLab });

  if (frameType === "wood") {
    addM("b7", q, "Nail-On Box");
    const stapleQty = (Math.ceil(whipFt / 4) + 2) * q;
    addM("rm4", stapleQty, `Romex Staple (${stapleQty})`);
  } else {
    addM("b1",  q,   '4" Square Deep Box');
    addM("bs1", q,   "C23 Bracket");
    addM("mr1", q,   "SG Mud Ring");
    addM("bs2", 2*q, "CJ6 ×2");
    if (frameType !== "pipe") {
      const clipQty = (Math.ceil(whipFt / 4) + 2) * q;
      addM("bs2", clipQty, `CJ6 clips (${clipQty})`);
    }
  }

  if (pricing === "firelite") {
    addM(deviceId, q, devDef?.lbl ?? deviceId);
  } else {
    const pqMat = 0.01 * q;
    matRef.v += pqMat;
    lines.push({ name: `${devDef?.lbl ?? "FA Device"} — PER QUOTE`, qty: q, unit: "EA", mat: pqMat, lab: 0 });
  }

  addM("wc1", 2*q, "Wire Nuts ×2");
  addL(devLhr, q, `${devDef?.lbl ?? "Device"} install labor (${q}× ${devLhr}hr × diff ${diff.toFixed(2)})`, diff);

  const isPanelOrRadio = ["fad12","fad13","fad14","fad15"].includes(deviceId);
  if (isPanelOrRadio) {
    addHeader("── 120V Power Circuit ──");
    const pwr = _calcFAPower(diff);
    pwr.lines.forEach(l => lines.push(l));
    matRef.v += pwr.mat;
    labRef.v += pwr.lab;
    if (deviceId !== "fad15") {
      const channels = deviceId === "fad12" ? 4 : deviceId === "fad13" ? 6 : 10;
      addL(0.75, channels, `FA Panel programming (${channels} channels × 0.75hr)`, diff);
    }
  }

  const frameDesc = frameType === "wood" ? "Wood/NM" : frameType === "metal" ? "Metal/MC" : "Metal/Pipe";
  const hrDesc = homeRun ? " HR" : "";
  const pricingDesc = pricing === "quoted" ? " (quoted)" : "";
  const label = `${devDef?.lbl ?? deviceId}${pricingDesc} | ${frameDesc} | ${whipFt}ft${hrDesc} | ×${q}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── GEAR & TRANSFORMERS ──────────────────────────────────────────────────────

/**
 * @param gearType  "panel" | "xfmr"
 * @param size      "small" | "medium" | "large" | "xlarge"
 * @param mountMat  mounting materials allowance ($)
 * @param kva       transformer KVA (optional display)
 * @param desc      description override
 * @param qty       number of units
 * @param diff      difficulty multiplier
 */
export function calcGear(
  gearType: string, size: string, mountMat: number,
  kva: string, desc: string, qty: number, diff = 1.0
): AssemblyResult | null {
  const q = qty || 1;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };

  const def = GEAR_DEF[gearType]?.[size];
  if (!def) return null;

  const mountCost = mountMat * q * (1 + R.bulk);
  matRef.v += mountCost;
  lines.push({ name: "Mounting materials allowance", qty: q, unit: "EA", mat: mountCost, lab: 0 });

  const gearDesc = kva ? `${kva} KVA - ${desc || def.note}` : desc || def.note;
  const pqMat = 0.01 * q;
  matRef.v += pqMat;
  lines.push({ name: `${gearDesc} — PER QUOTE`, qty: q, unit: "EA", mat: pqMat, lab: 0 });

  const totalLab = def.lhr * q * diff * R.labor;
  labRef.v += totalLab;
  lines.push({ name: `Install labor - ${def.lbl} (${(def.lhr * diff).toFixed(2)}hr × ${q})`, qty: q, unit: "EA", mat: 0, lab: totalLab });

  const label = `${def.lbl}${kva ? " - " + kva + "KVA" : ""}${desc ? " - " + desc : ""} ×${q}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── PULL / SPLICE CAN ────────────────────────────────────────────────────────

/**
 * @param canSize     "small" | "medium" | "large" | "xl"
 * @param mountMethod "wall" | "strut" | "rod" | "surface"
 * @param mountMat    mounting materials allowance ($)
 * @param spliceSize  wire size for splices e.g. "#12"
 * @param spliceQty   number of splices
 * @param qty         number of cans
 * @param diff        difficulty multiplier
 */
export function calcCan(
  canSize: string, mountMethod: string, mountMat: number,
  spliceSize: string, spliceQty: number, qty: number, diff = 1.0
): AssemblyResult | null {
  const q = qty || 1;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addL } = makeLineBuilder(lines, matRef, labRef);

  const def = CAN_DEF[canSize];
  if (!def) return null;

  const pqMat = 0.01 * q;
  matRef.v += pqMat;
  lines.push({ name: `${def.lbl} Pull/Splice Can — PER QUOTE`, qty: q, unit: "EA", mat: pqMat, lab: 0 });

  const mountCost = mountMat * q * (1 + R.bulk);
  matRef.v += mountCost;
  lines.push({ name: `Mount materials allowance (${mountMethod})`, qty: q, unit: "EA", mat: mountCost, lab: 0 });

  addL(def.lhr, q, `${def.lbl} install labor (${q}× ${def.lhr}hr × diff ${diff.toFixed(2)})`, diff);

  const sQty = spliceQty || 0;
  if (sQty > 0) {
    const large = ["#1","1/0","2/0","3/0","4/0","250kcmil","350kcmil","400kcmil","500kcmil","600kcmil"];
    const medium = ["#8","#6","#4","#3","#2"];
    const slhr = large.includes(spliceSize) ? 0.10 : medium.includes(spliceSize) ? 0.06 : 0.04;
    const sType = slhr >= 0.10 ? "mechanical lug" : slhr >= 0.06 ? "wire nut/lug" : "wire nut";
    addL(slhr, sQty * q, `${sQty}× ${spliceSize} splice (${sType}, ${slhr}hr each × ${q} cans)`, diff);
  }

  const mountDesc: Record<string, string> = { wall:"Wall", strut:"Strut", rod:"Rod/Clamp", surface:"Surface" };
  const spliceDesc = sQty > 0 ? ` | ${sQty}× ${spliceSize} splices` : "";
  const label = `${def.lbl} can | ${mountDesc[mountMethod] ?? mountMethod}${spliceDesc} | ×${q}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── CUSTOM DEVICE ────────────────────────────────────────────────────────────

/**
 * @param deviceId  BOM ID of device (e.g. "d1")
 * @param cableId   BOM ID of cable (e.g. "w1" = 12/2 MC)
 * @param boxId     BOM ID of box (e.g. "b1")
 * @param plateId   BOM ID of plate (e.g. "dp1")
 * @param whipFt    whip length in feet
 * @param twoGang   add 2nd device / 2-gang plate
 * @param suppType  "CJ6" | "1-Hole Strap" | "Staple" | "Strut Clip"
 * @param qty       number of devices
 * @param diff      difficulty multiplier
 */
export function calcCustomDev(
  deviceId: string, cableId: string, boxId: string, plateId: string,
  whipFt: number, twoGang: boolean, suppType: string, qty: number, diff = 1.0
): AssemblyResult {
  const q = qty || 1;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);

  const devDef = CUST_DEVICES.find(d => d.id === deviceId);
  const aHr = devDef?.aHr ?? 0.77;
  const isGfci = devDef?.gfci ?? false;

  const totalWireFt = Math.ceil((whipFt * q + 2 * q) / 10) * 10;
  addM(cableId, totalWireFt, `Cable whip (${whipFt}ft ×${q} = ${totalWireFt}ft bought)`);

  const isMC = ["w1","w10","w2","w3","w4"].includes(cableId);
  if (isMC) addM("mc1", q, "MC Connector");

  addM(boxId, q, "Box");
  if (boxId === "b1" || boxId === "b2") {
    addM("bs1", q, "C23 Bracket");
    addM("mr1", q, "SG Mud Ring");
    addM("bs2", 2*q, "CJ6 ×2");
  } else if (boxId !== "b7") {
    addM("bs2", 2*q, "CJ6 ×2");
  }

  addM(deviceId, q, devDef?.lbl ?? deviceId);

  if (twoGang) {
    addM(isGfci ? "d1" : deviceId, q, isGfci ? "2nd device - 20A Recept (2-gang)" : "2nd device (2-gang)");
    addM("dp3", q, "2G Duplex Plate");
  } else {
    addM(plateId, q, "Plate");
  }

  addM("wc1", (twoGang ? 5 : 4) * q, "Wire Nuts");
  addM("gr1", q, "Ground Screw");

  const suppQty = (Math.ceil(whipFt / 4) + 2) * q;
  const CUST_SUPP: Record<string, string> = { "CJ6":"bs2", "1-Hole Strap":"mc4", "Staple":"rm4", "Strut Clip":"sc1" };
  const suppId = CUST_SUPP[suppType] ?? "bs2";
  addM(suppId, suppQty, `${suppType} supports (${suppQty})`);

  let totalLab = aHr * q * R.labor * diff;
  if (twoGang) totalLab += 0.17 * q * R.labor * diff;
  labRef.v += totalLab;
  lines.push({ name: `Device install labor (${q}× ${aHr}hr${twoGang ? " +2G" : ""} × diff ${diff.toFixed(2)})`, qty: q, unit: "EA", mat: 0, lab: totalLab });

  const devName = devDef?.lbl ?? deviceId;
  const label = `${devName}${twoGang ? " 2-Gang" : ""} | ${whipFt}ft | ${cableId} | ×${q}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── LV SPECIALTY ─────────────────────────────────────────────────────────────

/**
 * @param deviceType "camera" | "reader" | "intercom" | "av" | "speaker" | "doorbell"
 * @param location   "indoor" | "outdoor"
 * @param feet       cable run footage
 * @param makeupIn   makeup per end in inches (default 12)
 * @param qty        number of devices
 * @param diff       difficulty multiplier
 */
export function calcLV(
  deviceType: string, location: string, feet: number,
  makeupIn: number, qty: number, diff = 1.0
): AssemblyResult {
  const ft = feet;
  const q = qty || 1;
  const mkFt = makeupIn / 12;
  const lines: AssemblyLine[] = [];
  const matRef = { v: 0 };
  const labRef = { v: 0 };
  const { addM, addL } = makeLineBuilder(lines, matRef, labRef);

  const devDef = LV_DEVICES.find(d => d.id === deviceType);
  const devLhr = devDef?.lhr ?? 0.35;

  const totalCableFt = Math.ceil((ft * q + mkFt * 2 * q) / 10) * 10;
  addM("lvc1", totalCableFt, `LV Cable (${q}×${ft}ft + makeup = ${totalCableFt}ft bought)`);

  const pullLab = ft * q * 0.010 * diff * R.labor;
  labRef.v += pullLab;
  lines.push({ name: `Cable pull labor (${q}×${ft}ft @ 0.010 × diff ${diff.toFixed(2)})`, qty: ft * q, unit: "FT", mat: 0, lab: pullLab });

  const boxType = location === "outdoor" ? (devDef?.autoBox_out ?? "wp") : (devDef?.autoBox ?? "indoor_4sq");
  if (boxType === "wp") {
    addM("b4", q, "Weatherproof Box (outdoor)");
    addL(0.30, q, `Box mount labor (outdoor ×${q})`, diff);
  } else if (boxType === "indoor_4sq") {
    addM("b1",  q, '4" Square Deep Box');
    addM("bs1", q, "C23 Bracket");
    addM("mr1", q, "SG Mud Ring");
    addM("bs2", 2*q, "CJ6 ×2");
    addL(0.25, q, `Box rough-in labor (×${q})`, diff);
  } else {
    addM("lvc2", q, "LV Mud Ring/Bracket");
    addL(0.15, q, `LV bracket install (×${q})`, diff);
  }

  const suppQty = (Math.ceil(ft / 4) + 2) * q;
  addM("lvc3", suppQty, `LV Staples (${suppQty})`);

  addL(devLhr, q, `${devDef?.lbl ?? "LV Device"} rough-in (${q}× ${devLhr}hr × diff ${diff.toFixed(2)})`, diff);
  addL(0.20, q, `LV termination labor (${q}× 0.20hr)`, diff);

  const pqMat = 0.01 * q;
  matRef.v += pqMat;
  lines.push({ name: `${devDef?.lbl ?? "LV Device"} — PER QUOTE`, qty: q, unit: "EA", mat: pqMat, lab: 0 });

  const locDesc = location === "outdoor" ? "Outdoor" : "Indoor";
  const label = `${devDef?.lbl ?? "LV"} | ${locDesc} | ${ft}ft | ×${q}`;
  return { mat: matRef.v, lab: labRef.v, lines, label };
}

// ─── TIME & MATERIALS ─────────────────────────────────────────────────────────

/**
 * @param desc    description
 * @param hours   labor hours
 * @param matCost material cost (before bulk markup)
 * @param diff    difficulty multiplier
 */
export function calcTM(
  desc: string, hours: number, matCost: number, diff = 1.0
): AssemblyResult {
  const lab = hours * R.labor * diff;
  const mat = matCost * (1 + R.bulk);
  const label = `${desc || "T&M Item"} | ${hours.toFixed(2)}hr | $${mat.toFixed(2)}`;
  return {
    mat,
    lab,
    label,
    lines: [
      { name: desc || "T&M Item", qty: "", unit: "", mat: 0, lab: 0 },
      { name: `Labor (${hours.toFixed(2)}hr × diff ${diff.toFixed(2)})`, qty: hours, unit: "hr", mat: 0, lab: lab },
      { name: "Material (w/bulk markup)", qty: 1, unit: "EA", mat: mat, lab: 0 },
    ],
  };
}

// ─── Legacy calc functions (backward-compat for counter-sync assemblies) ──────

function _legacyCalcThreeWay(params: Record<string, string | number | boolean>, data: EstimateData): { mat: number; lhr: number } {
  const travelerFt = typeof params.travelerFt === "number" ? params.travelerFt : 0;
  // Rough estimate: 12/2 MC × 40ft (2×20), 12/3 traveler, 2 boxes
  const markup = data.bulkMarkup;
  const w1 = BOM.find(b => b.id === "w1");
  const w2 = BOM.find(b => b.id === "w2");
  const mat = ((w1?.mat ?? 0.60) * 40 + (w2?.mat ?? 1.17) * travelerFt) * (1 + markup);
  const lhr = adjustLhr((40 * (w1?.lhr ?? 0.026) + travelerFt * (w2?.lhr ?? 0.028)), data);
  return { mat, lhr };
}

function _legacyCalcMcHomeRun(params: Record<string, string | number | boolean>, data: EstimateData): { mat: number; lhr: number } {
  const wireSize = String(params.wireSize ?? "12");
  const footage = typeof params.footage === "number" ? params.footage : 0;
  const wm = MC_WIRE_MAP[wireSize];
  const wireId = wm?.mc2 ?? "w1";
  const it = BOM.find(b => b.id === wireId);
  const markup = data.bulkMarkup;
  const mat = (it?.mat ?? 0.60) * footage * (1 + markup);
  const lhr = adjustLhr((wm?.lhr ?? 0.026) * footage, data);
  return { mat, lhr };
}

// ─── BID TOTALS ───────────────────────────────────────────────────────────────

export function calcBid(data: EstimateData): BidTotals {
  let rawMat = 0;
  let rawLhr = 0;
  let rawAsmLab = 0; // assembly labor in dollars (gets global multipliers applied separately)

  // Takeoff items (apply global multipliers via adjustLhr)
  for (const item of data.takeoffItems) {
    const line = calcLine(item, data);
    rawMat += line.mat;
    rawLhr += line.lhr;
  }

  // Assemblies
  for (const asm of data.assemblies) {
    if (asm.mat !== undefined && asm.lab !== undefined) {
      // New-style assembly: pre-computed mat/lab
      rawMat += asm.mat;
      rawAsmLab += asm.lab;
    } else if (asm.type === "THREE_WAY") {
      const r = _legacyCalcThreeWay(asm.params, data);
      rawMat += r.mat;
      rawLhr += r.lhr;
    } else if (asm.type === "MC_HOME_RUN") {
      const r = _legacyCalcMcHomeRun(asm.params, data);
      rawMat += r.mat;
      rawLhr += r.lhr;
    } else if (asm.type === "CUSTOM") {
      const mat = typeof asm.params.mat === "number" ? asm.params.mat : 0;
      const lhr = typeof asm.params.lhr === "number" ? asm.params.lhr : 0;
      rawMat += mat;
      rawLhr += adjustLhr(lhr, data);
    }
    // Other legacy assembly types without mat/lab: contribute 0
  }

  // Panel items (respect BomPricing overrides)
  for (const panel of data.panelItems) {
    const panelBom = BOM.find(b => b.id === panel.panelBomId);
    if (panelBom) {
      const ov = data.bomOverrides?.[panel.panelBomId];
      rawMat += (ov?.mat ?? panelBom.mat) * (1 + data.bulkMarkup);
      rawLhr += adjustLhr(ov?.lhr ?? panelBom.lhr, data);
    }
    for (const row of panel.breakerRows) {
      const brkBom = BOM.find(b => b.id === row.bomId);
      if (brkBom) {
        const ov = data.bomOverrides?.[row.bomId];
        rawMat += (ov?.mat ?? brkBom.mat) * row.qty * (1 + data.bulkMarkup);
        rawLhr += adjustLhr((ov?.lhr ?? brkBom.lhr) * row.qty, data);
      }
    }
  }

  // Apply global multipliers to assembly lab
  const asmLaborMult = data.conditionMult * (data.heightAdj ? 1.15 : 1.0) * (1 + (data.nonProd ?? 0));
  const adjustedAsmLab = rawAsmLab * asmLaborMult;

  const markedUpMat = rawMat;
  const rawLabor = rawLhr * data.laborRate;
  const laborWithOverhead = (rawLabor + adjustedAsmLab) * (1 + data.overhead);
  const subtotal = markedUpMat + laborWithOverhead;
  const profit = subtotal * data.profit;
  const grandTotal = subtotal + profit;

  const permitTotal = data.permits.reduce((s, p) => s + p.amount, 0) * (1 + data.permitMarkup);
  const subTotal = data.subs.reduce((s, sub) => s + sub.amount, 0) * (1 + data.subMarkup);
  const grandWithSubs = grandTotal + permitTotal + subTotal;

  const designFee = grandTotal * data.profit * data.designFeePct;

  return {
    rawMat, markedUpMat, rawLhr,
    rawLabor: rawLabor + adjustedAsmLab,
    laborWithOverhead,
    subtotal, profit, grandTotal, designFee,
    permitTotal, subTotal, grandWithSubs,
  };
}

export function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
