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
  const sz = wireSize.replace('#', '');
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
