// ── lib/estimator/calc.ts ─────────────────────────────────────────────────────
// Phase 3 — Calculation Functions (built in phases 3a → 3c)
// Pure TypeScript logic — no UI, no React, no state management.
// Every function takes explicit params and returns SavedAssembly | null.

import {
  getRates, applyMarkup, WIRE_PULL_LHR, N4_BKR,
  type SavedAssembly, type AssemblyLine,
} from './constants';

import {
  getBomItem, WIRE_MAP, COND_MAP, SUPP_MAP,
  type BomItem, type ConduitMapEntry,
} from './bom';

// ─────────────────────────────────────
// Core accumulator helpers (module-private)
// ─────────────────────────────────────

interface CalcAcc {
  mat:   number;
  lab:   number;
  lines: AssemblyLine[];
}

function newAcc(): CalcAcc {
  return { mat: 0, lab: 0, lines: [] };
}

function addItem(acc: CalcAcc, id: string, qty: number, label?: string): void {
  if (qty <= 0) return;
  const R = getRates();
  let item: BomItem | undefined;
  try { item = getBomItem(id); } catch { /* id not in BOM */ }
  if (!item) {
    acc.lines.push({ name: `[MISSING BOM: ${id}]`, qty, unit: 'EA', mat: 0, lab: 0 });
    return;
  }
  const matCost = applyMarkup(item.mat * qty, item.mk);
  const labCost = item.lhr * qty * R.labor;
  acc.mat += matCost;
  acc.lab += labCost;
  acc.lines.push({ name: label ?? item.name, qty, unit: item.unit, mat: matCost, lab: labCost });
}

function addManual(
  acc:  CalcAcc,
  name: string,
  qty:  number,
  unit: string,
  mat:  number,
  lab:  number,
): void {
  acc.mat += mat;
  acc.lab += lab;
  acc.lines.push({ name, qty, unit, mat, lab });
}

function toAsm(
  acc:    CalcAcc,
  label:  string,
  params?: Record<string, unknown>,
): SavedAssembly {
  return { label, mat: acc.mat, lab: acc.lab, lines: acc.lines, params };
}

// ─────────────────────────────────────
// Lookup adapters
// bom.ts uses flat keys; these helpers translate UI param strings to those keys.
// ─────────────────────────────────────

// condType → COND_MAP key prefix
const COND_TYPE_PFX: Record<string, string> = {
  'EMT':          'emt',
  'IMC':          'emt',
  'Sch40 PVC':    'pvc',
  'Sch80 PVC':    'p80',
  'Rigid':        'rigid',
  'Flex':         'flex',
  'Liquid Tight': 'lt',
};

// condSize (display) → COND_MAP / SUPP_MAP key suffix
const COND_SIZE_SFX: Record<string, string> = {
  '1/2':   '12',
  '3/4':   '34',
  '1':     '1',
  '1-1/4': '114',
  '1-1/2': '112',
  '2':     '2',
  '2-1/2': '212',
  '3':     '3',
  '3-1/2': '312',
  '4':     '4',
};

// suppType → SUPP_MAP key prefix
const SUPP_TYPE_PFX: Record<string, string> = {
  '1-Hole Strap':   'strap',
  'Strut Clip':     'clip',
  'Conduit Hanger': 'hanger',
  'Snap Hanger':    'hanger',
  'Click-It Strap': 'clickit',
};

function condMapKey(condType: string, condSize: string): string {
  const pfx = COND_TYPE_PFX[condType] ?? condType.toLowerCase();
  const sfx = COND_SIZE_SFX[condSize] ?? condSize;
  return `${pfx}_${sfx}`;
}

// wireSize '#12' + wireMat 'Cu' → WIRE_MAP key 'thhn_12'
function wireMapKey(wireMat: string, wireSize: string): string {
  // Strip '#' (e.g. '#12') and 'kcmil' (e.g. '500kcmil') so the key matches
  // WIRE_MAP, whose large-conductor keys use plain numbers (thhn_500, al_250).
  // NOTE: only normalize for the WIRE_MAP lookup — WIRE_PULL_LHR / NEC_HINT /
  // NEC_GND_SIZE are keyed by the original 'kcmil' form and must stay as-is.
  const sz = wireSize.replace('#', '').replace('kcmil', '').trim();
  return wireMat === 'Al' ? `al_${sz}` : `thhn_${sz}`;
}

// suppType + condSize → SUPP_MAP key (e.g. 'strap_34')
function suppMapKey(suppType: string, condSize: string): string {
  const pfx = SUPP_TYPE_PFX[suppType] ?? 'strap';
  const sfx = COND_SIZE_SFX[condSize] ?? condSize;
  return `${pfx}_${sfx}`;
}

// Derive connection pattern from conduit type
function getConnType(condType: string): 'emt' | 'pvc' | 'rigid' | 'flex' | 'nmb' {
  if (condType === 'EMT' || condType === 'IMC')              return 'emt';
  if (condType === 'Sch40 PVC' || condType === 'Sch80 PVC') return 'pvc';
  if (condType === 'Rigid')                                  return 'rigid';
  if (condType === 'Flex' || condType === 'Liquid Tight')    return 'flex';
  if (condType === 'NM-B')                                   return 'nmb';
  return 'emt';
}

// ─────────────────────────────────────
// 1. calcConduitRun
// ─────────────────────────────────────

export interface ConduitRunParams {
  condType:    string;   // 'EMT' | 'Sch40 PVC' | 'Rigid' | 'Flex' | 'Liquid Tight' | 'NM-B'
  condSize:    string;   // '1/2' | '3/4' | '1' | '1-1/4' | '1-1/2' | '2' | etc.
  numCond:     number;   // number of current-carrying conductors
  wireSize:    string;   // '#14' | '#12' | '#10' | '1/0' | etc. | 'None'
  wireMat:     string;   // 'Cu' | 'Al'
  suppType:    string;   // '1-Hole Strap' | 'Strut Clip' | 'Conduit Hanger'
  feet:        number;   // footage per run
  makeup:      number;   // extra footage per end for wire makeup
  qty:         number;   // number of identical runs
  spliceBox:   boolean;  // add 4" square splice box per run
  underground: boolean;  // buried — skip surface supports, add trench labor
  sandBed:     boolean;  // add sand bedding at $0.25/ft (underground only)
  warnTape:    boolean;  // add warning tape at $0.08/ft (underground only)
  gndWire:     string;   // 'none' | '#14' | '#12' | '#10' | etc.
  gndMat:      string;   // 'Cu' | 'Al'
  diff:        number;   // difficulty multiplier (1.0 | 1.25 | 1.55)
}

export function calcConduitRun(p: ConduitRunParams): SavedAssembly | null {
  const R        = getRates();
  const acc      = newAcc();
  const connType = getConnType(p.condType);
  const ft       = p.feet;
  const q        = p.qty;

  if (ft <= 0 || q <= 0) return null;

  // ── CONDUIT MATERIAL ────────────────────────────────────────────
  if (connType === 'nmb') {
    const nmId = WIRE_MAP[`nm_${p.condSize}`] as string | undefined;
    if (!nmId) return null;
    const totalFt   = Math.ceil((ft * q + p.makeup * 2 * q) / 10) * 10;
    const stapleQty = Math.ceil(ft * q / 4) + 2 * q;
    addItem(acc, nmId, totalFt, `${p.condSize} NM-B (${totalFt}ft)`);
    addItem(acc, 'm2', stapleQty, `NM-B staples (${stapleQty})`);

  } else {
    const cm = COND_MAP[condMapKey(p.condType, p.condSize)] as ConduitMapEntry | undefined;
    if (!cm) return null;

    if (connType === 'emt') {
      const sticks = Math.ceil(ft / 10);
      const coups  = sticks - 1;
      addItem(acc, cm.ftId, sticks * q,
        `${p.condSize}" ${p.condType} (${sticks} sticks x${q})`);
      if (coups > 0) {
        addItem(acc, cm.connId.coupling, coups * q,
          `${p.condSize}" coupling (${coups} x${q})`);
      }
      addItem(acc, cm.connId.connector, 2 * q,
        `${p.condSize}" connector (2 per run x${q})`);

    } else if (connType === 'pvc') {
      // PVC items are per-foot (unit FT); bell-end sticks need no mid-run couplings
      const sticks = Math.ceil(ft / 10);
      const jointsPerPint: Record<string, number> = {
        '1/2': 24, '3/4': 20, '1': 14, '1-1/2': 8, '2': 5, '3': 3, '4': 2,
      };
      addItem(acc, cm.ftId, ft * q,
        `${p.condSize}" ${p.condType} (${ft}ft x${q})`);
      addItem(acc, cm.connId.connector, 2 * q,
        `${p.condSize}" PVC adapter (2 per run x${q})`);
      const glueQty = Math.ceil((sticks * q) / (jointsPerPint[p.condSize] ?? 10));
      addItem(acc, 'pvc_glue', glueQty, `PVC cement (${glueQty} pint)`);

    } else if (connType === 'rigid') {
      const sticks = Math.ceil(ft / 10);
      addItem(acc, cm.ftId, sticks * q,
        `${p.condSize}" Rigid (${sticks} sticks x${q})`);
      addItem(acc, cm.connId.coupling, 2 * q,
        `${p.condSize}" locknut (2 per run x${q})`);
      // 2% material incidentals (thread compound, nipples, etc.)
      addManual(acc, 'Rigid conduit incidentals (2%)', q, 'EA', acc.mat * 0.02, 0);

    } else if (connType === 'flex') {
      // Flex / LT items are per-foot (unit FT)
      addItem(acc, cm.ftId, ft * q,
        `${p.condSize}" ${p.condType} (${ft}ft x${q})`);
      addItem(acc, cm.connId.connector, 2 * q,
        `${p.condSize}" ${p.condType} connector (2 x${q})`);
    }

    // ── WIRE ──────────────────────────────────────────────────────
    if (p.wireSize && p.wireSize !== 'None') {
      const wireId = WIRE_MAP[wireMapKey(p.wireMat, p.wireSize)] as string | undefined;
      if (wireId) {
        const pullLhr = WIRE_PULL_LHR[p.wireSize] ?? 0.010;
        const wireFt  = ft * p.numCond;
        const mkupFt  = p.makeup * 2 * p.numCond;
        const totalFt = Math.ceil((wireFt + mkupFt) / 10) * 10 * q;
        addItem(acc, wireId, totalFt,
          `${p.wireSize} ${p.wireMat} THHN (${totalFt}ft)`);
        const wireLab = pullLhr * ft * p.numCond * q * p.diff * R.labor;
        addManual(acc,
          `Wire pull labor (${p.wireSize} x${p.numCond} cond x${ft}ft x${q})`,
          1, 'EA', 0, wireLab);
      }
    }

    // ── GROUND WIRE ───────────────────────────────────────────────
    if (p.gndWire && p.gndWire !== 'none') {
      const gndId = WIRE_MAP[wireMapKey(p.gndMat, p.gndWire)] as string | undefined;
      if (gndId) {
        const gndFt  = Math.ceil((ft * q + p.makeup * 2 * q) / 10) * 10;
        addItem(acc, gndId, gndFt,
          `${p.gndWire} ${p.gndMat} EGC (${gndFt}ft)`);
        const gndLab = (WIRE_PULL_LHR[p.gndWire] ?? 0.010) * ft * q * p.diff * R.labor;
        addManual(acc, `Ground wire pull (${p.gndWire})`, 1, 'EA', 0, gndLab);
      }
    }

    // ── SURFACE SUPPORTS ──────────────────────────────────────────
    if (!p.underground) {
      // Sizes > 2" fall back to the 2" support (largest in SUPP_MAP)
      const suppSz  = ['2-1/2', '3', '3-1/2', '4'].includes(p.condSize) ? '2' : p.condSize;
      const suppQty = Math.ceil(ft * q / 5);
      const suppId  = SUPP_MAP[suppMapKey(p.suppType, suppSz)] as string | undefined;
      if (suppId && suppQty > 0) {
        addItem(acc, suppId, suppQty,
          `${p.condSize}" ${p.suppType} (${suppQty})`);
      }
    }

    // ── CONDUIT INSTALL LABOR ─────────────────────────────────────
    addManual(acc,
      `${p.condType} ${p.condSize}" install labor (${ft}ft x${q} x diff ${p.diff})`,
      1, 'EA', 0, cm.lhrFt * ft * q * p.diff * R.labor);
  }

  // ── UNDERGROUND ───────────────────────────────────────────────────
  if (p.underground) {
    const totalFt = ft * q;
    addManual(acc, `Underground trench labor (${totalFt}ft)`,
      totalFt, 'FT', 0, totalFt * 0.040 * p.diff * R.labor);
    if (p.sandBed) {
      addManual(acc, `Sand bedding (${totalFt}ft @ $0.25/ft)`,
        totalFt, 'FT', applyMarkup(0.25 * totalFt, 'bulk'), 0);
    }
    if (p.warnTape) {
      addManual(acc, `Underground warning tape (${totalFt}ft)`,
        totalFt, 'FT', applyMarkup(0.08 * totalFt, 'bulk'), 0);
    }
  }

  // ── SPLICE BOX ────────────────────────────────────────────────────
  if (p.spliceBox) {
    addItem(acc, 'b1',  q, `4" splice box (${q})`);
    addItem(acc, 'bs2', 2 * q, 'CJ6 (2 per box)');
    addManual(acc, 'Splice box hardware', q, 'EA',
      applyMarkup(3.00 * q, 'bulk'), 0);
    addManual(acc, 'Splice box install labor', q, 'EA',
      0, 0.30 * q * p.diff * R.labor);
  }

  const label = `${p.condSize}" ${p.condType} — ${p.numCond}x${p.wireSize} — ${ft}ft x${q}`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────
// 2. calcRack
// ─────────────────────────────────────

export interface RackParams {
  mountType: 'wall' | 'hang';
  rackSize:  '12' | '18' | '24' | '48' | '60';   // inches
  rodLength: 'none' | '18' | '24' | '36' | '48' | '60';  // inches
  qty:       number;
  caps:      boolean;
  diff:      number;
}

export function calcRack(p: RackParams): SavedAssembly | null {
  if (p.qty <= 0) return null;
  const R   = getRates();
  const acc = newAcc();

  const STRUT_FT: Record<string, number> = {
    '12': 1.0, '18': 1.5, '24': 2.0, '48': 4.0, '60': 5.0,
  };
  const strutFt = STRUT_FT[p.rackSize] ?? 2.0;

  addItem(acc, 'sh1', strutFt * p.qty,
    `1-5/8 strut (${strutFt}ft x${p.qty})`);

  if (p.mountType === 'wall') {
    addItem(acc, 'rack_di',   2 * p.qty, '3/8" drop-in anchor');
    addItem(acc, 'rack_fw',   2 * p.qty, '3/8" fender washer');
    addItem(acc, 'rack_lw',   2 * p.qty, '3/8" lock washer');
    addItem(acc, 'rack_bolt', 2 * p.qty, '3/8" hex bolt');
  } else {
    const rodFt = p.rodLength === 'none'
      ? 0
      : Math.ceil(parseInt(p.rodLength, 10) / 12);
    addItem(acc, 'rack_bc', 2 * p.qty, 'beam clamp');
    if (rodFt > 0) {
      addItem(acc, 'rack_rod', rodFt * 2 * p.qty,
        `3/8" rod (${rodFt}ft x2 x${p.qty})`);
    }
    addItem(acc, 'rack_cn', 4 * p.qty, '3/8" coupling nut');
    addItem(acc, 'rack_fw', 4 * p.qty, '3/8" fender washer');
    addItem(acc, 'rack_lw', 4 * p.qty, '3/8" lock washer');
  }

  if (p.caps) addItem(acc, 'rack_cap', 2 * p.qty, 'strut end caps');

  const rodIn  = p.rodLength === 'none' ? 0 : parseInt(p.rodLength, 10);
  const labHrs = p.mountType === 'wall' ? 0.45
    : rodIn <= 24 ? 0.60
    : rodIn <= 48 ? 0.70
    : 0.80;

  addManual(acc,
    `Rack install labor (${p.qty} racks x ${labHrs}hr x diff ${p.diff})`,
    p.qty, 'EA', 0, labHrs * p.qty * p.diff * R.labor);

  const rodSuffix = p.rodLength !== 'none' ? ` ${p.rodLength}" rod` : '';
  const label     = `${p.rackSize}" ${p.mountType} rack x${p.qty}${rodSuffix}`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────
// 3. calcMCHomeRun
// ─────────────────────────────────────

export interface MCHomeRunParams {
  wireSize: '#14' | '#12' | '#10';
  numCond:  2 | 3;
  bkrSize:  '15A' | '20A' | '30A';
  suppType: 'Staple' | 'Strap' | 'J-Hook';
  feet:     number;
  makeup:   number;   // extra footage per end: 0 | 3 | 5 | 10
  diff:     number;
}

export function calcMCHomeRun(p: MCHomeRunParams): SavedAssembly | null {
  const R   = getRates();
  const acc = newAcc();
  if (p.feet <= 0) return null;

  const MC_ID: Record<string, Record<number, string>> = {
    '#14': { 2: 'rm1', 3: 'rm5' },
    '#12': { 2: 'w1',  3: 'w2'  },
    '#10': { 2: 'w3',  3: 'w4'  },
  };
  const mcId = MC_ID[p.wireSize]?.[p.numCond];
  if (!mcId) return null;

  const totalFt = p.feet + p.makeup * 2;

  addItem(acc, mcId, totalFt, `${p.wireSize}/${p.numCond} MC (${totalFt}ft)`);
  addItem(acc, 'mc1', 2, 'MC connector x2');
  addItem(acc, 'b1',  1, '4" square deep box');
  addItem(acc, 'bs1', 1, 'C23 bracket');
  addItem(acc, 'mr1', 1, 'SG mud ring');
  addItem(acc, 'bs2', 2, 'CJ6 x2');
  addItem(acc, 'wc1', p.numCond + 1, 'wire nuts');
  addItem(acc, 'gr1', 1, 'ground screw');

  const suppQty = Math.ceil(p.feet / 4) + 2;
  if      (p.suppType === 'Staple') addItem(acc, 'm2',  suppQty, `staples (${suppQty})`);
  else if (p.suppType === 'Strap')  addItem(acc, 'mc4', suppQty, `MC straps (${suppQty})`);
  else if (p.suppType === 'J-Hook') addItem(acc, 'lv2', Math.ceil(suppQty / 3), 'J-hooks');

  const BKR_KEY: Record<string, string> =
    { '15A': '1p15', '20A': '1p20', '30A': '1p30' };
  const bkrLab = (N4_BKR[BKR_KEY[p.bkrSize]] ?? 0.34) * p.diff * R.labor;
  addManual(acc, `${p.bkrSize} breaker termination labor`, 1, 'EA', 0, bkrLab);

  const pullLhr = WIRE_PULL_LHR[p.wireSize] ?? 0.012;
  addManual(acc, `MC pull labor (${p.feet}ft)`,
    p.feet, 'FT', 0, pullLhr * p.feet * p.diff * R.labor);

  addManual(acc, 'Box termination & makeup labor', 1, 'EA', 0,
    0.45 * p.diff * R.labor);

  const label = `${p.wireSize}/${p.numCond} MC — ${p.feet}ft — ${p.bkrSize}`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────
// 4. calcThreeWay
// ─────────────────────────────────────

export interface ThreeWayParams {
  swType:     'standard' | 'dimming' | 'volt010';
  travelerFt: number;
  lumFt:      number;   // luminaire cable footage (volt010 only, else 0)
  diff:       number;
}

export function calcThreeWay(p: ThreeWayParams): SavedAssembly | null {
  const R   = getRates();
  const acc = newAcc();
  if (p.travelerFt <= 0) return null;

  // ── FEED-SIDE BOX ────────────────────────────────────────────────
  addItem(acc, 'w1',  20, '#12/2 MC whip — feed side (20ft)');
  addItem(acc, 'mc1', 2,  'MC connector x2');
  addItem(acc, 'b1',  1,  '4" square deep box');
  addItem(acc, 'bs1', 1,  'C23 bracket');
  addItem(acc, 'mr1', 1,  'SG mud ring');
  addItem(acc, 'bs2', 2,  'CJ6 x2');
  addItem(acc, 'wc1', 4,  'wire nuts x4');
  addItem(acc, 'gr1', 1,  'ground screw');

  const feedSwId =
    p.swType === 'volt010' ? 'd14' :
    p.swType === 'dimming' ? 'd9'  : 'd7';
  addItem(acc, feedSwId, 1, 'feed-side switch/dimmer');
  addItem(acc, 'dp2',    1, 'switch plate');

  // ── TRAVELER RUN ─────────────────────────────────────────────────
  addItem(acc, 'w2',  p.travelerFt, `#12/3 MC traveler (${p.travelerFt}ft)`);
  addItem(acc, 'mc1', 2, 'MC connector x2 (traveler ends)');

  // ── LOAD-SIDE BOX ────────────────────────────────────────────────
  addItem(acc, 'w1',  20, '#12/2 MC whip — load side (20ft)');
  addItem(acc, 'mc1', 2,  'MC connector x2');
  addItem(acc, 'b1',  1,  '4" square deep box');
  addItem(acc, 'bs1', 1,  'C23 bracket');
  addItem(acc, 'mr1', 1,  'SG mud ring');
  addItem(acc, 'bs2', 2,  'CJ6 x2');
  addItem(acc, 'wc1', 4,  'wire nuts x4');
  addItem(acc, 'gr1', 1,  'ground screw');
  addItem(acc, 'd7',  1,  'load-side 3-way switch');
  addItem(acc, 'dp2', 1,  'switch plate');

  // ── 0-10V LUMINAIRE CABLE ────────────────────────────────────────
  if (p.swType === 'volt010' && p.lumFt > 0) {
    addItem(acc, 'lvc1', p.lumFt, `0-10V luminaire cable (${p.lumFt}ft)`);
    addItem(acc, 'lvc3', Math.ceil(p.lumFt / 4), 'LV staples');
  }

  // ── LABOR ────────────────────────────────────────────────────────
  addManual(acc, '3-way switch box labor (2 boxes × 0.90hr)',
    2, 'EA', 0, 0.90 * 2 * p.diff * R.labor);

  const travLhr = WIRE_PULL_LHR['#12'] ?? 0.012;
  addManual(acc, `Traveler pull labor (${p.travelerFt}ft)`,
    p.travelerFt, 'FT', 0, travLhr * p.travelerFt * p.diff * R.labor);

  const label = `3-Way ${p.swType} — ${p.travelerFt}ft traveler`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─────────────────────────────────────
// 5. calcData
// ─────────────────────────────────────

export interface DataParams {
  ports:      1 | 2 | 3 | 4;
  emtDrop:    boolean;
  support:    'J-Hook Small' | 'J-Hook Large' | 'Zip Tie';
  feet:       number;
  makeup:     number;   // 0 | 3 | 5 | 10 | 12 | 18 | 24
  patchPanel: 'none' | 'small' | 'medium' | 'large';
  diff:       number;
}

export function calcData(p: DataParams): SavedAssembly | null {
  const R   = getRates();
  const acc = newAcc();
  if (p.feet <= 0) return null;

  // Cat6 cable — round up to nearest 10ft
  const cableFt = Math.ceil((p.feet * p.ports + p.makeup * p.ports) / 10) * 10;
  addItem(acc, 'w14', cableFt, `Cat6 (${cableFt}ft)`);

  // Keystones: 2 per port (wall end + patch panel end)
  addItem(acc, 'dp7', p.ports * 2, `Cat6 keystone x${p.ports * 2}`);

  // Wall plate
  if (p.ports <= 2) {
    addItem(acc, 'dp8',  1, '2-port keystone plate');
  } else {
    addItem(acc, 'dp10', Math.ceil(p.ports / 4), 'keystone plate');
  }

  // Cable support every 4ft + 2 at ends
  const suppQty = Math.ceil(p.feet / 4) + 2;
  if      (p.support === 'J-Hook Small') addItem(acc, 'lv2', suppQty, `J-hook sm (${suppQty})`);
  else if (p.support === 'J-Hook Large') addItem(acc, 'lv3', suppQty, `J-hook lg (${suppQty})`);
  // Zip Tie = consumable, no line item

  // Box hardware
  if (p.emtDrop) {
    addItem(acc, 'e1',       1, '1/2" EMT 10ft (stub)');
    addItem(acc, 'ef1',      2, '1/2" EMT connector x2');
    addItem(acc, 'sp_emt12', 2, '1/2" strap x2');
    addItem(acc, 'mr1',      1, 'SG mud ring');
    addManual(acc, 'EMT stub field bend labor', 1, 'EA', 0,
      0.10 * p.diff * R.labor);
  } else {
    addItem(acc, 'bs2', 3, 'CJ6 x3 (flush mount)');
    addItem(acc, 'mr1', 1, 'SG mud ring');
  }

  // Patch panel
  if (p.patchPanel !== 'none') {
    const PP_ID: Record<string, string> =
      { small: 'pp1', medium: 'pp2', large: 'pp3' };
    addItem(acc, PP_ID[p.patchPanel], 1, 'patch panel');
  }

  // Labor: 0.15 hrs/port termination + 0.30 base
  addManual(acc, `Cat6 termination labor (${p.ports} ports × 0.15hr)`,
    p.ports, 'EA', 0, 0.15 * p.ports * p.diff * R.labor);
  addManual(acc, 'Data location base labor', 1, 'EA', 0,
    0.30 * p.diff * R.labor);

  const label = `${p.ports}-port Cat6 — ${p.feet}ft — ${p.support}`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─── calcFireAlarm ────────────────────────────────────────────────────────────

export interface FireAlarmParams {
  frameType:    'wood' | 'metal' | 'pipe';
  circuitType:  'slc' | 'nac' | 'ann';
  deviceId:     string;
  pricing:      'firelite' | 'quoted';
  whipFt:       number;
  homeRun:      boolean;
  qty:          number;
  diff:         number;
  includePower: boolean;
}

const FA_DEVICES: Record<string, { lbl: string; lhr: number; channels: number }> = {
  fad1:  { lbl: 'Pull Station',           lhr: 0.35, channels: -1 },
  fad2:  { lbl: 'Smoke Detector',         lhr: 0.35, channels: -1 },
  fad3:  { lbl: 'Heat Detector',          lhr: 0.35, channels: -1 },
  fad4:  { lbl: 'Smoke/CO Combo',         lhr: 0.45, channels: -1 },
  fad5:  { lbl: 'Horn/Strobe',            lhr: 0.35, channels: -1 },
  fad6:  { lbl: 'Strobe',                 lhr: 0.35, channels: -1 },
  fad7:  { lbl: 'LF Sounder',             lhr: 0.35, channels: -1 },
  fad8:  { lbl: 'Beacon',                 lhr: 0.35, channels: -1 },
  fad9:  { lbl: 'Control/Monitor Module', lhr: 0.45, channels: -1 },
  fad10: { lbl: 'Duct Smoke Detector',    lhr: 0.65, channels: -1 },
  fad11: { lbl: 'Annunciator',            lhr: 1.00, channels: -1 },
  fad12: { lbl: 'FL FACP Small (4ch)',    lhr: 3.00, channels:  4 },
  fad13: { lbl: 'FL FACP Medium (6ch)',   lhr: 4.50, channels:  6 },
  fad14: { lbl: 'FL FACP Large (10ch)',   lhr: 7.50, channels: 10 },
  fad15: { lbl: 'FL Radio Box',           lhr: 1.00, channels:  0 },
};

const FA_CABLE: Record<string, Record<string, string>> = {
  wood:  { slc: 'fa1', nac: 'fa2', ann: 'fa5' },
  metal: { slc: 'fa3', nac: 'fa4', ann: 'fa6' },
  pipe:  { slc: 'fa3', nac: 'fa4', ann: 'fa6' },
};

export function calcFireAlarm(p: FireAlarmParams): SavedAssembly | null {
  if (p.qty <= 0) return null;
  const R      = getRates();
  const acc    = newAcc();
  const devDef = FA_DEVICES[p.deviceId];
  if (!devDef) return null;
  const isPanel = devDef.channels >= 0;

  // ── CABLE (field devices only) ──────────────────────────────────
  if (!isPanel) {
    const cableId = FA_CABLE[p.frameType]?.[p.circuitType];
    if (cableId) {
      const baseFt  = p.whipFt * p.qty;
      const totalFt = p.homeRun ? baseFt * 2 : baseFt;
      const hrNote  = p.homeRun ? ' (Class A ×2)' : '';
      addItem(acc, cableId, totalFt, `FA cable${hrNote} — ${totalFt}ft`);
    }
  }

  // ── DEVICE ──────────────────────────────────────────────────────
  if (p.pricing === 'firelite') {
    addItem(acc, p.deviceId, p.qty, devDef.lbl);
  } else {
    addManual(acc, `${devDef.lbl} — PER QUOTE`, p.qty, 'EA', 0.01 * p.qty, 0);
    addManual(acc, `${devDef.lbl} install (${p.qty} × ${devDef.lhr}hr)`, p.qty, 'EA', 0,
      devDef.lhr * p.qty * p.diff * R.labor);
  }

  // ── BOX HARDWARE (field devices only) ────────────────────────────
  if (!isPanel) {
    if (p.frameType === 'wood') {
      addItem(acc, 'b7', p.qty, 'Nail-On Box');
      const staples = Math.ceil(p.whipFt / 4) * p.qty;
      addItem(acc, 'rm4', staples, `Romex staples (${staples})`);
      addManual(acc, 'Box rough-in labor', p.qty, 'EA', 0,
        0.20 * p.qty * p.diff * R.labor);
    } else {
      addItem(acc, 'b1',  p.qty, '4" Square Deep Box');
      addItem(acc, 'bs1', p.qty, 'C23 Metal Stud Bracket');
      addItem(acc, 'mr1', p.qty, 'SG 3/4" Mud Ring');
      addItem(acc, 'bs2', p.qty * 2, 'CJ6 Colorado Jim');
      if (p.frameType !== 'pipe') {
        const clips = Math.ceil(p.whipFt / 4) * p.qty;
        addItem(acc, 'bs2', clips, `CJ6 cable clips (${clips})`);
      }
      addManual(acc, 'Box rough-in labor', p.qty, 'EA', 0,
        0.30 * p.qty * p.diff * R.labor);
    }
  }

  // ── FACP PROGRAMMING LABOR ───────────────────────────────────────
  if (isPanel && devDef.channels > 0) {
    addManual(acc,
      `FA panel programming (${devDef.channels} ch × 0.75hr)`,
      devDef.channels, 'EA', 0,
      devDef.channels * 0.75 * p.diff * R.labor);
  }

  // ── 120V POWER CIRCUIT ───────────────────────────────────────────
  if (isPanel && p.includePower) {
    addItem(acc, 'w1',  30, '12/2 MC (power circuit, 30ft)');
    addItem(acc, 'mc1',  2, 'MC connector ×2');
    addItem(acc, 'b1',   1, '4" Sq Deep Box (power)');
    addItem(acc, 'bs1',  1, 'C23 Bracket');
    addItem(acc, 'mr1',  1, 'Mud Ring');
    addItem(acc, 'bs2',  2, 'CJ6 ×2');
    addManual(acc, 'MC pull labor (30ft)', 30, 'FT', 0,
      30 * 0.026 * p.diff * R.labor);
    addManual(acc, 'Box rough-in labor (power)', 1, 'EA', 0,
      0.30 * p.diff * R.labor);
    addManual(acc, '20A breaker termination', 1, 'EA', 0,
      0.34 * p.diff * R.labor);
  }

  const frameDesc   = p.frameType === 'wood' ? 'Wood/NM' : p.frameType === 'metal' ? 'Metal/MC' : 'Metal/Pipe';
  const hrDesc      = (!isPanel && p.homeRun) ? ' HR' : '';
  const pricingDesc = p.pricing === 'quoted' ? ' (quoted)' : '';
  const label = `${devDef.lbl}${pricingDesc} | ${frameDesc} | ${p.whipFt}ft${hrDesc} | ×${p.qty}`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─── calcLV ───────────────────────────────────────────────────────────────────

export interface LVParams {
  deviceType:  string;
  outdoor:     boolean;
  supportType: 'j-hook-sm' | 'j-hook-lg' | 'zip-tie' | 'staple';
  runFt:       number;
  qty:         number;
  diff:        number;
}

const LV_DEVICES: Record<string, { lbl: string; lhr: number }> = {
  camera:   { lbl: 'Security Camera',       lhr: 0.35 },
  reader:   { lbl: 'Access Control Reader', lhr: 0.35 },
  intercom: { lbl: 'Intercom Station',      lhr: 0.35 },
  av:       { lbl: 'TV/AV Outlet',          lhr: 0.35 },
  speaker:  { lbl: 'Speaker',               lhr: 0.25 },
  doorbell: { lbl: 'Doorbell/Call Button',  lhr: 0.25 },
};

export function calcLV(p: LVParams): SavedAssembly | null {
  if (p.runFt <= 0 || p.qty <= 0) return null;
  const R   = getRates();
  const acc = newAcc();
  const dev = LV_DEVICES[p.deviceType];
  if (!dev) return null;

  // Cable
  const totalFt = p.runFt * p.qty;
  addItem(acc, 'lvc1', totalFt, `LV cable (${totalFt}ft)`);

  // Supports every 4ft + 2 at ends per device
  const suppQty = (Math.ceil(p.runFt / 4) + 2) * p.qty;
  const suppId  = p.supportType === 'j-hook-sm' ? 'lv2'
    : p.supportType === 'j-hook-lg' ? 'lv3'
    : p.supportType === 'zip-tie'   ? 'lv4'
    : 'lvc3';  // staple
  addItem(acc, suppId, suppQty, `LV supports (${suppQty})`);

  // Box / mount
  if (p.outdoor) {
    addItem(acc, 'b4', p.qty, 'WP Box (outdoor)');
    addManual(acc, 'WP box mount labor', p.qty, 'EA', 0,
      0.30 * p.qty * p.diff * R.labor);
  } else {
    addItem(acc, 'lvc2', p.qty, 'LV Mud Ring / Bracket');
    addManual(acc, 'LV bracket install labor', p.qty, 'EA', 0,
      0.15 * p.qty * p.diff * R.labor);
  }

  // Device — always PER QUOTE
  addManual(acc, `${dev.lbl} — PER QUOTE`, p.qty, 'EA', 0.01 * p.qty, 0);

  // Device install labor
  addManual(acc, `${dev.lbl} install (${p.qty} × ${dev.lhr}hr)`, p.qty, 'EA', 0,
    dev.lhr * p.qty * p.diff * R.labor);

  // Termination labor
  addManual(acc, 'LV termination labor', p.qty, 'EA', 0,
    0.20 * p.qty * p.diff * R.labor);

  const locDesc = p.outdoor ? 'Outdoor' : 'Indoor';
  const label   = `${dev.lbl} | ${locDesc} | ${p.runFt}ft | ×${p.qty}`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─── GEAR_DEF + calcGear ──────────────────────────────────────────────────────

export interface GearDef {
  lbl: string;
  lhr: number;
  note: string;
  mcbAdder?: number;
}

export const GEAR_DEF: Record<string, Record<string, GearDef>> = {

  // ── COMMERCIAL PANELS ───────────────────────────────────────
  panel: {
    small:  { lbl:'Commercial Panel — Small (up to 200A)',   lhr:3.5,  note:'Up to 200A MLO/MCB' },
    medium: { lbl:'Commercial Panel — Medium (up to 400A)',  lhr:5.0,  note:'Up to 400A MLO/MCB' },
    large:  { lbl:'Commercial Panel — Large (up to 600A)',   lhr:7.0,  note:'Up to 600A MLO/MCB' },
    xl:     { lbl:'Commercial Panel — XL (up to 800A)',      lhr:10.0, note:'Up to 800A MLO/MCB' },
  },
  panel_lighting: {
    small:  { lbl:'Lighting Panel 120/277V — Small (up to 200A)', lhr:3.5,  note:'Up to 200A MLO/MCB' },
    medium: { lbl:'Lighting Panel 120/277V — Medium (up to 400A)',lhr:5.0,  note:'Up to 400A MLO/MCB' },
    large:  { lbl:'Lighting Panel 120/277V — Large (up to 600A)', lhr:7.0,  note:'Up to 600A MLO/MCB' },
    xl:     { lbl:'Lighting Panel 120/277V — XL (up to 800A)',    lhr:10.0, note:'Up to 800A MLO/MCB' },
  },

  // ── TRANSFORMERS ────────────────────────────────────────────
  xfmr: {
    small:  { lbl:'Transformer Dry 3Ph — Small (1–15 KVA)',    lhr:2.5,  note:'' },
    medium: { lbl:'Transformer Dry 3Ph — Medium (25–75 KVA)',  lhr:4.0,  note:'' },
    large:  { lbl:'Transformer Dry 3Ph — Large (100–500 KVA)', lhr:8.0,  note:'' },
    xlarge: { lbl:'Transformer Dry 3Ph — XL (750–2000 KVA)',   lhr:14.0, note:'' },
  },
  xfmr_1p: {
    small:  { lbl:'Transformer 1Ph — Small (1–15 KVA)',    lhr:2.5,  note:'' },
    medium: { lbl:'Transformer 1Ph — Medium (25–75 KVA)',  lhr:4.0,  note:'' },
    large:  { lbl:'Transformer 1Ph — Large (100–500 KVA)', lhr:8.0,  note:'' },
    xlarge: { lbl:'Transformer 1Ph — XL (750+ KVA)',       lhr:14.0, note:'' },
  },
  xfmr_iso: {
    small:  { lbl:'Isolation Transformer — Small (1–15 KVA)',    lhr:3.1,  note:'+25% labor' },
    medium: { lbl:'Isolation Transformer — Medium (25–75 KVA)',  lhr:5.0,  note:'+25% labor' },
    large:  { lbl:'Isolation Transformer — Large (100–500 KVA)', lhr:10.0, note:'+25% labor' },
    xlarge: { lbl:'Isolation Transformer — XL (750+ KVA)',       lhr:17.5, note:'+25% labor' },
  },
  xfmr_bb: {
    small:  { lbl:'Buck-Boost — Small',  lhr:2.5,  note:'' },
    medium: { lbl:'Buck-Boost — Medium', lhr:4.0,  note:'' },
    large:  { lbl:'Buck-Boost — Large',  lhr:8.0,  note:'' },
    xlarge: { lbl:'Buck-Boost — XL',     lhr:14.0, note:'' },
  },

  // ── DISCONNECTS ─────────────────────────────────────────────
  disc_nf: {
    a30:  { lbl:'Non-Fusible Disconnect 30A',  lhr:2.20, note:'3P' },
    a60:  { lbl:'Non-Fusible Disconnect 60A',  lhr:3.30, note:'3P' },
    a100: { lbl:'Non-Fusible Disconnect 100A', lhr:4.40, note:'3P' },
    a200: { lbl:'Non-Fusible Disconnect 200A', lhr:6.00, note:'3P' },
    a400: { lbl:'Non-Fusible Disconnect 400A', lhr:9.00, note:'3P' },
    a600: { lbl:'Non-Fusible Disconnect 600A', lhr:12.0, note:'3P' },
  },
  disc_f: {
    a30:  { lbl:'Fusible Disconnect 30A',  lhr:2.50, note:'Class R' },
    a60:  { lbl:'Fusible Disconnect 60A',  lhr:3.60, note:'Class R' },
    a100: { lbl:'Fusible Disconnect 100A', lhr:4.80, note:'Class J' },
    a200: { lbl:'Fusible Disconnect 200A', lhr:6.50, note:'Class L' },
    a400: { lbl:'Fusible Disconnect 400A', lhr:9.50, note:'Class L' },
    a600: { lbl:'Fusible Disconnect 600A', lhr:13.0, note:'Class L' },
  },
  disc_ac: {
    a30:  { lbl:'A/C Disconnect 30A',  lhr:2.20, note:'HVAC' },
    a60:  { lbl:'A/C Disconnect 60A',  lhr:3.30, note:'HVAC' },
    a100: { lbl:'A/C Disconnect 100A', lhr:4.40, note:'HVAC' },
  },
  disc_motor: {
    a30:  { lbl:'Motor Disconnect 30A',  lhr:2.20, note:'NEC 430' },
    a60:  { lbl:'Motor Disconnect 60A',  lhr:3.30, note:'NEC 430' },
    a100: { lbl:'Motor Disconnect 100A', lhr:4.40, note:'NEC 430' },
  },

  // ── METERS ──────────────────────────────────────────────────
  meter: {
    a100: { lbl:'Meter Socket 100A',  lhr:3.00, note:'Single' },
    a200: { lbl:'Meter Socket 200A',  lhr:3.25, note:'Single' },
    a300: { lbl:'Meter Socket 300A',  lhr:4.00, note:'Single' },
    a320: { lbl:'Meter Socket 320A',  lhr:4.25, note:'Single' },
    a400: { lbl:'Meter Socket 400A',  lhr:5.50, note:'Single' },
  },
  meter_bank: {
    pos2:  { lbl:'Meter Bank 2-Position',        lhr:5.50,  note:'' },
    pos3:  { lbl:'Meter Bank 3-Position',        lhr:7.50,  note:'' },
    pos4:  { lbl:'Meter Bank 4-Position',        lhr:9.50,  note:'' },
    pos5:  { lbl:'Meter Bank 5-Position',        lhr:11.50, note:'' },
    pos6:  { lbl:'Meter Bank 6-Position',        lhr:13.50, note:'' },
    stack: { lbl:'Meter Bank Stack (per stack)', lhr:6.75,  note:'' },
  },
  meter_main: {
    a100: { lbl:'Meter-Main Combo 100A', lhr:4.50, note:'Service entrance' },
    a200: { lbl:'Meter-Main Combo 200A', lhr:5.50, note:'Service entrance' },
    a400: { lbl:'Meter-Main Combo 400A', lhr:7.00, note:'Service entrance' },
  },
  ct_cab: {
    std: { lbl:'CT Cabinet / Metering', lhr:3.00, note:'Commercial metering' },
  },

  // ── SPECIALTY GEAR ───────────────────────────────────────────
  mdp: {
    small:  { lbl:'MDP — Small (2–4 breakers)',    lhr:8.0,  note:'Service entrance' },
    medium: { lbl:'MDP — Medium (6–12 breakers)',  lhr:14.0, note:'Service entrance' },
    large:  { lbl:'MDP — Large (14–24 breakers)',  lhr:20.0, note:'Service entrance' },
    xl:     { lbl:'MDP — XL (30+ breakers)',       lhr:28.0, note:'Service entrance' },
  },
  swgr: {
    small:  { lbl:'Switchgear — Small',  lhr:12.0, note:'Draw-out breakers' },
    medium: { lbl:'Switchgear — Medium', lhr:20.0, note:'Draw-out breakers' },
    large:  { lbl:'Switchgear — Large',  lhr:30.0, note:'Draw-out breakers' },
    xl:     { lbl:'Switchgear — XL',     lhr:40.0, note:'Draw-out breakers' },
  },
  mcc: {
    small:  { lbl:'MCC — Small (2–4 starters)',   lhr:10.0, note:'Motor starters' },
    medium: { lbl:'MCC — Medium (6–12 starters)', lhr:16.0, note:'Motor starters' },
    large:  { lbl:'MCC — Large (14–24 starters)', lhr:24.0, note:'Motor starters' },
    xl:     { lbl:'MCC — XL (30+ starters)',      lhr:32.0, note:'Motor starters' },
  },
  ats: {
    small:  { lbl:'ATS — Small (up to 100A)',  lhr:6.0,  note:'Generator transfer' },
    medium: { lbl:'ATS — Medium (up to 400A)', lhr:10.0, note:'Generator transfer' },
    large:  { lbl:'ATS — Large (up to 800A)',  lhr:14.0, note:'Generator transfer' },
    xl:     { lbl:'ATS — XL (1000A+)',         lhr:18.0, note:'Generator transfer' },
  },
  bypass: {
    small:  { lbl:'Bypass Isolation — Small',  lhr:4.0,  note:'ATS maintenance' },
    medium: { lbl:'Bypass Isolation — Medium', lhr:7.0,  note:'ATS maintenance' },
    large:  { lbl:'Bypass Isolation — Large',  lhr:10.0, note:'ATS maintenance' },
    xl:     { lbl:'Bypass Isolation — XL',     lhr:14.0, note:'ATS maintenance' },
  },
  vfd: {
    small:  { lbl:'VFD — Small (up to 10HP)',   lhr:3.0,  note:'Motor speed control' },
    medium: { lbl:'VFD — Medium (up to 50HP)',  lhr:5.0,  note:'Motor speed control' },
    large:  { lbl:'VFD — Large (up to 200HP)',  lhr:8.0,  note:'Motor speed control' },
    xl:     { lbl:'VFD — XL (200HP+)',          lhr:12.0, note:'Motor speed control' },
  },
  soft: {
    small:  { lbl:'Soft Starter — Small',  lhr:2.5, note:'Motor starting' },
    medium: { lbl:'Soft Starter — Medium', lhr:4.0, note:'Motor starting' },
    large:  { lbl:'Soft Starter — Large',  lhr:6.0, note:'Motor starting' },
    xl:     { lbl:'Soft Starter — XL',     lhr:8.0, note:'Motor starting' },
  },
  ctrl: {
    small:  { lbl:'Control Panel — Small',  lhr:3.0,  note:'Custom control' },
    medium: { lbl:'Control Panel — Medium', lhr:6.0,  note:'Custom control' },
    large:  { lbl:'Control Panel — Large',  lhr:10.0, note:'Custom control' },
    xl:     { lbl:'Control Panel — XL',     lhr:16.0, note:'Custom control' },
  },
};

export interface GearParams {
  gearType:    string;
  gearSubtype: string;
  qty:         number;
  nema3r:      boolean;
  fused:       boolean;
  mcb:         boolean;
  mountMat:    number;
  diff:        number;
}

export function calcGear(p: GearParams): SavedAssembly | null {
  if (p.qty <= 0) return null;
  const R   = getRates();
  const acc = newAcc();

  const subtypes = GEAR_DEF[p.gearType];
  if (!subtypes) return null;
  const def = subtypes[p.gearSubtype];
  if (!def) return null;

  // Gear itself — PER QUOTE
  addManual(acc, `${def.lbl} (per quote)`, p.qty, 'EA', 0.01 * p.qty, 0);

  // Install labor
  let lhrEa = def.lhr;
  if (p.nema3r) lhrEa += 0.50;
  if (p.fused)  lhrEa += 0.25;

  addManual(acc,
    `${def.lbl} install (${p.qty} × ${lhrEa}hr × diff ${p.diff})`,
    p.qty, 'EA', 0,
    lhrEa * p.qty * p.diff * R.labor);

  // MCB adder for panels with main breaker
  const isPanelType = ['panel', 'panel_lighting'].includes(p.gearType);
  if (isPanelType && p.mcb) {
    addManual(acc,
      'MCB (main circuit breaker) termination adder (0.50hr)',
      p.qty, 'EA', 0,
      0.50 * p.qty * p.diff * R.labor);
  }

  // Mount materials (parse from string defensively)
  const mountMatAmt = typeof p.mountMat === 'string'
    ? parseFloat(p.mountMat as string) || 0
    : (p.mountMat ?? 0);
  if (mountMatAmt > 0) {
    addManual(acc,
      `Mounting materials allowance ($${mountMatAmt})`,
      p.qty, 'EA',
      applyMarkup(mountMatAmt * p.qty, 'bulk'), 0);
  }

  const label = [
    def.lbl,
    `${p.qty}ea`,
    p.mcb    ? 'MCB'    : 'MLO',
    p.nema3r ? 'NEMA3R' : '',
    p.fused  ? 'fused'  : '',
  ].filter(Boolean).join(' — ');

  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─── calcFloorBox ─────────────────────────────────────────────────────────────

export interface FloorBoxParams {
  floorType: 'wood' | 'concrete_new' | 'concrete_core';
  gangs: number;
  qty: number;
  quoted: boolean;
  diff: number;
}

const FLOOR_LAB: Record<string, { base: number; perGang: number }> = {
  wood:          { base: 0.75, perGang: 0.25 },
  concrete_new:  { base: 1.00, perGang: 0.25 },
  concrete_core: { base: 1.50, perGang: 0.35 },
};

export function calcFloorBox(p: FloorBoxParams): SavedAssembly | null {
  if (p.qty <= 0) return null;
  const R = getRates();
  const acc = newAcc();
  const lab = FLOOR_LAB[p.floorType];
  if (!lab) return null;

  // Floor box — PER QUOTE
  if (p.quoted) {
    addManual(acc, 'Floor box assembly (per quote)', p.qty, 'EA', 0.01 * p.qty, 0);
  }

  // Optional mount mat for wood
  if (p.floorType === 'wood') {
    addItem(acc, 'fb_mnt', p.qty);
  }

  // Labor
  const lhrEa = lab.base + (p.gangs - 1) * lab.perGang;
  addManual(acc, `Floor box labor (${p.qty} × ${lhrEa.toFixed(2)}hr)`, p.qty, 'EA', 0,
    lhrEa * p.qty * p.diff * R.labor);

  const label = `Floor box — ${p.floorType} — ${p.gangs}-gang — ${p.qty}ea`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─── calcHighAmpRecept ────────────────────────────────────────────────────────

export interface HighAmpReceptParams {
  receptType: '30A' | '50A' | '240V' | 'twist';
  whipFeet: number;
  qty: number;
  diff: number;
}

const HA_DEF: Record<string, { cableId: string; plateId: string; lhrEa: number }> = {
  '30A':  { cableId: 'rm2', plateId: 'wn_ss',  lhrEa: 1.00 },
  '50A':  { cableId: 'w1',  plateId: 'wn_ss',  lhrEa: 1.25 },
  '240V': { cableId: 'w1',  plateId: 'wn_ss',  lhrEa: 1.00 },
  twist:  { cableId: 'w3',  plateId: 'wn_ss',  lhrEa: 1.50 },
};

export function calcHighAmpRecept(p: HighAmpReceptParams): SavedAssembly | null {
  if (p.qty <= 0) return null;
  const R = getRates();
  const acc = newAcc();
  const def = HA_DEF[p.receptType] as (typeof HA_DEF)[string] | undefined;
  if (!def) return null;

  // Whip cable
  addItem(acc, def.cableId, p.whipFeet * p.qty);
  // MC connectors (2 per whip)
  addItem(acc, 'mc1', 2 * p.qty);
  // CJ6 cord grip
  addItem(acc, 'cj6', p.qty);
  // Box hardware
  addItem(acc, 'b1', p.qty);      // 4" square box
  addItem(acc, 'bs2', p.qty);     // box support
  // Device (PER QUOTE) + plate + wire nuts + ground screw
  addManual(acc, `${p.receptType} receptacle (per quote)`, p.qty, 'EA', 0.01 * p.qty, 0);
  addItem(acc, def.plateId, p.qty);
  addItem(acc, 'wn1', p.qty * 3); // wire nuts
  addItem(acc, 'gs1', p.qty);     // ground screw

  // Device install labor
  addManual(acc, `${p.receptType} install labor (${p.qty} × ${def.lhrEa}hr)`, p.qty, 'EA', 0,
    def.lhrEa * p.qty * p.diff * R.labor);

  const label = `High-amp recept — ${p.receptType} — ${p.whipFeet}ft whip — ${p.qty}ea`;
  return toAsm(acc, label, p as unknown as Record<string, unknown>);
}

// ─── calcBid ──────────────────────────────────────────────────────────────────

export interface BidInput {
  conduitRuns:     SavedAssembly[];
  racks:           SavedAssembly[];
  mcHomeRuns:      SavedAssembly[];
  threeWays:       SavedAssembly[];
  dataDrops:       SavedAssembly[];
  fireAlarm:       SavedAssembly[];
  gear:            SavedAssembly[];
  floorBoxes:      SavedAssembly[];
  highAmpRecepts:  SavedAssembly[];
  misc:            SavedAssembly[];
  lighting:        SavedAssembly[];
  heating:         SavedAssembly[];
  tempPower:       SavedAssembly[];
  underground:     SavedAssembly[];
  other:           SavedAssembly[];
  condMult: number;  // labor-only multiplier (e.g. 1.10 for difficult access)
}

export interface BidResult {
  matTotal:   number;
  laborTotal: number;
  permits:    number;
  subs:       number;
  overhead:   number;
  profit:     number;
  grandTotal: number;
  totalHrs:   number;
  breakdown:  Record<string, { mat: number; lab: number }>;
}

export function calcBid(input: BidInput): BidResult {
  const R = getRates();

  const groups: Array<[string, SavedAssembly[]]> = [
    ['conduitRuns',    input.conduitRuns],
    ['racks',          input.racks],
    ['mcHomeRuns',     input.mcHomeRuns],
    ['threeWays',      input.threeWays],
    ['dataDrops',      input.dataDrops],
    ['fireAlarm',      input.fireAlarm],
    ['gear',           input.gear],
    ['floorBoxes',     input.floorBoxes],
    ['highAmpRecepts', input.highAmpRecepts],
    ['misc',           input.misc],
    ['lighting',       input.lighting],
    ['heating',        input.heating],
    ['tempPower',      input.tempPower],
    ['underground',    input.underground],
    ['other',          input.other],
  ];

  let matTotal   = 0;
  let laborTotal = 0;
  const breakdown: Record<string, { mat: number; lab: number }> = {};

  for (const [key, asms] of groups) {
    let gMat = 0;
    let gLab = 0;
    for (const asm of asms) {
      // null guards: old localStorage state may carry null/undefined fields
      gMat += asm.mat ?? 0;
      gLab += (asm.lab ?? 0) * (input.condMult ?? 1);
    }
    breakdown[key] = { mat: gMat, lab: gLab };
    matTotal   += gMat;
    laborTotal += gLab;
  }

  const permits  = R.permit;
  const subs     = R.sub;
  const overhead = laborTotal * R.overhead;
  const subtotal = matTotal + laborTotal + permits + subs + overhead;
  const profit   = subtotal * R.profit;
  const grandTotal = subtotal + profit;
  const totalHrs = laborTotal / R.labor;

  return { matTotal, laborTotal, permits, subs, overhead, profit, grandTotal, totalHrs, breakdown };
}
