import type { BomItem } from "./bom";
import { BOM, NECA } from "./bom";

export type TakeoffItem = {
  id: string;          // unique row id (cuid)
  bomId: string;       // references BomItem.id
  qty: number;
  note?: string;
};

export type AssemblyType =
  | "CONDUIT_RUN"
  | "MC_HOME_RUN"
  | "THREE_WAY"
  | "CUSTOM";

export type Assembly = {
  id: string;
  type: AssemblyType;
  label: string;
  params: Record<string, string | number | boolean>;
  // computed on render from params — not stored
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
  subtotal: number;          // markedUpMat + laborWithOverhead
  profit: number;
  grandTotal: number;
  designFee: number;
  permitTotal: number;
  subTotal: number;
  grandWithSubs: number;
};

/** Apply height adjustment (+15% labor) and condition multiplier to hours */
export function adjustLhr(lhr: number, data: Pick<EstimateData, "conditionMult" | "heightAdj" | "nonProd">): number {
  let h = lhr * data.conditionMult;
  if (data.heightAdj) h *= 1.15;
  if (data.nonProd > 0) h *= (1 + data.nonProd);
  return h;
}

/** Calculate a single takeoff line */
export function calcLine(item: TakeoffItem, data: EstimateData): LineCalc {
  const bom = BOM.find(b => b.id === item.bomId);
  if (!bom) return { mat: 0, lhr: 0, laborCost: 0, total: 0 };
  const markup = bom.mk === "light" ? data.lightMarkup : data.bulkMarkup;
  const mat = bom.mat * item.qty * (1 + markup);
  const lhr = adjustLhr(bom.lhr * item.qty, data);
  const laborCost = lhr * data.laborRate;
  return { mat, lhr, laborCost, total: mat + laborCost };
}

/** Calculate conduit run assembly */
export function calcConduitRun(params: {
  size: string;    // "3/4", "1", "1-1/2", "2", "3", "4"
  footage: number;
  conductors: number;
  wireSize: string; // "12", "10", "8", "6"
  difficulty: number; // multiplier 0.8-1.5
}, data: EstimateData): { mat: number; lhr: number } {
  const conduitLhrMap: Record<string, number> = {
    "3/4": NECA.p34, "1": NECA.p1, "1-1/2": NECA.p112,
    "2": NECA.p2, "3": NECA.p3, "4": NECA.p4,
  };
  const conduitMatMap: Record<string, number> = {
    "3/4": 0.42, "1": 0.68, "1-1/2": 1.12, "2": 1.65, "3": 3.20, "4": 4.85,
  };
  const wireLhrMap: Record<string, number> = {
    "12": NECA.LT12 / 1000, "10": NECA.LT34 / 1000,
    "8": NECA.LT1 / 1000, "6": NECA.LT1 / 1000,
  };
  const wireMatMap: Record<string, number> = {
    "12": 0.065, "10": 0.098, "8": 0.165, "6": 0.245,
  };

  const ft = params.footage;
  const markup = data.bulkMarkup;

  // Conduit
  const conduitMat = (conduitMatMap[params.size] ?? 0.42) * ft * (1 + markup);
  const conduitLhr = (conduitLhrMap[params.size] ?? NECA.p34) * ft * params.difficulty;

  // Fittings: 2 connectors + couplings every 10ft
  const connMat = 0.55 * 2 * (1 + markup);
  const connLhr = 0.05 * 2;
  const couplings = Math.ceil(ft / 10);
  const coupMat = 0.42 * couplings * (1 + markup);
  const coupLhr = 0.04 * couplings;

  // Supports: 1 per 10ft
  const supports = Math.ceil(ft / 10);
  const supMat = 0.85 * supports * (1 + markup);
  const supLhr = 0.05 * supports;

  // Wire: footage + 10% waste, per conductor
  const wireFt = ft * 1.10 * params.conductors;
  const wireMat = (wireMatMap[params.wireSize] ?? 0.065) * wireFt * (1 + markup);
  const wireLhr = (wireLhrMap[params.wireSize] ?? NECA.LT12 / 1000) * wireFt * params.difficulty;

  const mat = conduitMat + connMat + coupMat + supMat + wireMat;
  const rawLhr = conduitLhr + connLhr + coupLhr + supLhr + wireLhr;
  const lhr = adjustLhr(rawLhr, data);

  return { mat, lhr };
}

/** Calculate MC home run assembly */
export function calcMcHomeRun(params: {
  wireSize: "12" | "10" | "8" | "6";
  footage: number;
  circuits: number;
  hasBox: boolean;
}, data: EstimateData): { mat: number; lhr: number } {
  const mcMatMap: Record<string, number> = { "12": 0.88, "10": 1.45, "8": 2.20, "6": 3.10 };
  const mcLhrMap: Record<string, number> = { "12": NECA.WNOB, "10": NECA.WNRD, "8": NECA.WNRD, "6": NECA.WNGN };
  const markup = data.bulkMarkup;

  const ft = params.footage * params.circuits;
  const mcMat = (mcMatMap[params.wireSize] ?? 0.88) * ft * (1 + markup);
  const mcLhr = (mcLhrMap[params.wireSize] ?? NECA.WNOB) * ft;

  // Connectors: 2 per circuit
  const connQty = 2 * params.circuits;
  const connMat = 0.85 * connQty * (1 + markup);
  const connLhr = 0.06 * connQty;

  // Straps: 1 per 5ft
  const straps = Math.ceil(params.footage / 5) * params.circuits;
  const strapMat = 0.35 * straps * (1 + markup);
  const strapLhr = 0.03 * straps;

  // Box if selected
  const boxMat = params.hasBox ? 1.85 * (1 + markup) : 0;
  const boxLhr = params.hasBox ? 0.20 : 0;

  const mat = mcMat + connMat + strapMat + boxMat;
  const rawLhr = mcLhr + connLhr + strapLhr + boxLhr;
  const lhr = adjustLhr(rawLhr, data);
  return { mat, lhr };
}

/** Calculate 3-way circuit */
export function calcThreeWay(params: {
  feedFt: number;
  travelerFt: number;
  switchLegFt: number;
  wireSize: "12" | "10";
}, data: EstimateData): { mat: number; lhr: number } {
  const wMat: Record<string, number> = { "12": 0.065, "10": 0.098 };
  const wLhr: Record<string, number> = { "12": NECA.LT12 / 1000, "10": NECA.LT34 / 1000 };
  const markup = data.bulkMarkup;
  // Feed: 2 conductors. Travelers: 3 conductors. Switch leg: 2 conductors
  const totalFt = (params.feedFt * 2) + (params.travelerFt * 3) + (params.switchLegFt * 2);
  const mat = (wMat[params.wireSize] ?? 0.065) * totalFt * 1.10 * (1 + markup);
  const rawLhrWire = (wLhr[params.wireSize] ?? NECA.LT12 / 1000) * totalFt * 1.10;
  // Boxes: 2 switches + 1 outlet = 3 boxes
  const boxMat = 0.95 * 3 * (1 + markup);
  const boxLhr = 0.15 * 3;
  // Switches: 2x 3-way
  const swMat = 4.50 * 2 * (1 + markup);
  const swLhr = NECA.sw3 * 2;
  const lhr = adjustLhr(rawLhrWire + boxLhr + swLhr, data);
  return { mat: mat + boxMat + swMat, lhr };
}

/** Calculate full bid totals */
export function calcBid(data: EstimateData): BidTotals {
  let rawMat = 0;
  let rawLhr = 0;

  // Takeoff items
  for (const item of data.takeoffItems) {
    const line = calcLine(item, data);
    rawMat += line.mat;
    rawLhr += line.lhr;
  }

  // Assemblies
  for (const asm of data.assemblies) {
    let asmResult = { mat: 0, lhr: 0 };
    if (asm.type === "CONDUIT_RUN") {
      asmResult = calcConduitRun(asm.params as Parameters<typeof calcConduitRun>[0], data);
    } else if (asm.type === "MC_HOME_RUN") {
      asmResult = calcMcHomeRun(asm.params as Parameters<typeof calcMcHomeRun>[0], data);
    } else if (asm.type === "THREE_WAY") {
      asmResult = calcThreeWay(asm.params as Parameters<typeof calcThreeWay>[0], data);
    } else if (asm.type === "CUSTOM") {
      const mat = typeof asm.params.mat === "number" ? asm.params.mat : 0;
      const lhr = typeof asm.params.lhr === "number" ? asm.params.lhr : 0;
      asmResult = { mat, lhr };
    }
    rawMat += asmResult.mat;
    rawLhr += asmResult.lhr;
  }

  // Panel items
  for (const panel of data.panelItems) {
    const panelBom = BOM.find(b => b.id === panel.panelBomId);
    if (panelBom) {
      rawMat += panelBom.mat * (1 + data.bulkMarkup);
      rawLhr += adjustLhr(panelBom.lhr, data);
    }
    for (const row of panel.breakerRows) {
      const brkBom = BOM.find(b => b.id === row.bomId);
      if (brkBom) {
        rawMat += brkBom.mat * row.qty * (1 + data.bulkMarkup);
        rawLhr += adjustLhr(brkBom.lhr * row.qty, data);
      }
    }
  }

  const markedUpMat = rawMat; // markup already applied in calcLine
  const rawLabor = rawLhr * data.laborRate;
  const laborWithOverhead = rawLabor * (1 + data.overhead);
  const subtotal = markedUpMat + laborWithOverhead;
  const profit = subtotal * data.profit;
  const grandTotal = subtotal + profit;

  const permitTotal = data.permits.reduce((s, p) => s + p.amount, 0) * (1 + data.permitMarkup);
  const subTotal = data.subs.reduce((s, sub) => s + sub.amount, 0) * (1 + data.subMarkup);
  const grandWithSubs = grandTotal + permitTotal + subTotal;

  const designFee = grandTotal * data.profit * data.designFeePct;

  return {
    rawMat, markedUpMat, rawLhr, rawLabor, laborWithOverhead,
    subtotal, profit, grandTotal, designFee,
    permitTotal, subTotal, grandWithSubs,
  };
}

export function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
