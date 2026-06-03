import {
  getRates, applyMarkup, N4_BKR,
  type SavedAssembly, type AssemblyLine,
} from './constants';
import { getBomItem } from './bom';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface CircuitSlot {
  id:          string;   // uuid
  slot:        number;   // slot number (1, 3, 5... for 1P; 1, 3... for 2P)
  desc:        string;   // description e.g. "Kitchen Recepts"
  breakerType: string;   // key into BREAKER_DEFS
  bomId:       string;   // BOM id of breaker
}

export interface PanelBuilderState {
  panelBomId:  string;   // 'pg1' | 'pg2'
  panelDesc:   string;   // e.g. "Main Panel - Building A"
  mountType:   'surface' | 'recessed';
  circuits:    CircuitSlot[];
  surge:       boolean;  // add whole-home surge protector
  diff:        number;
}

export interface BreakerDef {
  label:    string;
  bomId:    string;
  poles:    1 | 2 | 3;
  amps:     number;
  isAfci:   boolean;
  isGfci:   boolean;
  isTandem: boolean;
  lhrKey:   string;  // key in N4_BKR
}

// ─────────────────────────────────────
// Breaker definitions
// ─────────────────────────────────────

export const BREAKER_DEFS: Record<string, BreakerDef> = {
  '1p15':      { label:'1P 15A',           bomId:'pg3',  poles:1, amps:15,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'1p15'  },
  '1p15_afci': { label:'1P 15A AFCI',      bomId:'pg5b', poles:1, amps:15,  isAfci:true,  isGfci:false, isTandem:false, lhrKey:'1p15'  },
  '1p20':      { label:'1P 20A',           bomId:'pg4',  poles:1, amps:20,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'1p20'  },
  '1p20_afci': { label:'1P 20A AFCI/GFCI', bomId:'pg5',  poles:1, amps:20,  isAfci:true,  isGfci:true,  isTandem:false, lhrKey:'1p20'  },
  '1p20_gfci': { label:'1P 20A GFCI',      bomId:'pg6',  poles:1, amps:20,  isAfci:false, isGfci:true,  isTandem:false, lhrKey:'1p20'  },
  '1p30':      { label:'1P 30A',           bomId:'pg7',  poles:1, amps:30,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'1p30'  },
  '1p60':      { label:'1P 60A',           bomId:'pg8',  poles:1, amps:60,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'1p60'  },
  '2p20':      { label:'2P 20A',           bomId:'pg9',  poles:2, amps:20,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'2p20'  },
  '2p30':      { label:'2P 30A',           bomId:'pg10', poles:2, amps:30,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'2p30'  },
  '2p50':      { label:'2P 50A',           bomId:'pg11', poles:2, amps:50,  isAfci:false, isGfci:false, isTandem:false, lhrKey:'2p50'  },
  '2p50_gfci': { label:'2P 50A GFCI',      bomId:'pg12', poles:2, amps:50,  isAfci:false, isGfci:true,  isTandem:false, lhrKey:'2p50'  },
  'tandem_20': { label:'Tandem 2×20A',     bomId:'pg18', poles:1, amps:20,  isAfci:false, isGfci:false, isTandem:true,  lhrKey:'1p20'  },
};

// ─────────────────────────────────────
// Panel mount labor
// ─────────────────────────────────────

// NECA Section 4 panel mount labor (hrs)
// Based on amperage + mount type
export const PANEL_MOUNT_LABOR: Record<string, Record<string, number>> = {
  pg1: { surface: 2.6, recessed: 3.6 },   // 100A
  pg2: { surface: 3.4, recessed: 4.6 },   // 200A
};

// ─────────────────────────────────────
// Calc function
// ─────────────────────────────────────

export function calcPanel(p: PanelBuilderState): SavedAssembly | null {
  const R   = getRates();
  const acc = { mat: 0, lab: 0, lines: [] as AssemblyLine[] };

  function addItem(id: string, qty: number, label?: string) {
    let item;
    try {
      item = getBomItem(id);
    } catch {
      acc.lines.push({ name: `[MISSING: ${id}]`, qty, unit: 'EA', mat: 0, lab: 0 });
      return;
    }
    const m = applyMarkup(item.mat * qty, item.mk);
    const l = item.lhr * qty * R.labor;
    acc.mat += m;
    acc.lab += l;
    acc.lines.push({
      name: label ?? item.name, qty,
      unit: item.unit, mat: m, lab: l,
    });
  }

  function addManual(
    name: string, qty: number, unit: string,
    mat: number, lab: number
  ) {
    acc.mat += mat;
    acc.lab += lab;
    acc.lines.push({ name, qty, unit, mat, lab });
  }

  // Panel load center
  let panelItem;
  try {
    panelItem = getBomItem(p.panelBomId);
  } catch {
    return null;
  }
  addItem(p.panelBomId, 1,
    panelItem.name + (p.panelDesc ? ` — ${p.panelDesc}` : ''));

  // Panel mount labor (NECA S4)
  const mountLhr =
    PANEL_MOUNT_LABOR[p.panelBomId]?.[p.mountType] ?? 3.0;
  addManual(
    `Panel mount labor — ${p.mountType} (${mountLhr}hr x diff ${p.diff})`,
    1, 'EA', 0,
    mountLhr * p.diff * R.labor
  );

  // Breakers — group by bomId and count
  const bkrCounts: Record<string, number> = {};
  for (const circuit of p.circuits) {
    bkrCounts[circuit.bomId] =
      (bkrCounts[circuit.bomId] ?? 0) + 1;
  }
  for (const [bomId, qty] of Object.entries(bkrCounts)) {
    addItem(bomId, qty);
  }

  // Breaker termination labor (N4_BKR per circuit)
  let termLab = 0;
  for (const circuit of p.circuits) {
    const def = BREAKER_DEFS[circuit.breakerType];
    if (!def) continue;
    const baseLhr  = N4_BKR[def.lhrKey] ?? 0.34;
    const afciAdder = (def.isAfci || def.isGfci)
      ? (N4_BKR['afci_adder'] ?? 0.15) : 0;
    termLab += (baseLhr + afciAdder) * p.diff * R.labor;
  }
  if (termLab > 0) {
    addManual(
      `Breaker termination labor (${p.circuits.length} circuits)`,
      p.circuits.length, 'EA', 0, termLab
    );
  }

  // Surge protector (optional)
  if (p.surge) addItem('pg19', 1, 'Whole Home Surge Protector 50kA');

  const panelLabel = panelItem.name +
    (p.panelDesc ? ` — ${p.panelDesc}` : '') +
    ` (${p.circuits.length} circuits)`;

  return {
    label:  panelLabel,
    mat:    acc.mat,
    lab:    acc.lab,
    lines:  acc.lines,
    params: p as unknown as Record<string, unknown>,
  };
}

// ─────────────────────────────────────
// Default state
// ─────────────────────────────────────

export function createPanelState(): PanelBuilderState {
  return {
    panelBomId:  'pg2',
    panelDesc:   '',
    mountType:   'surface',
    circuits:    [],
    surge:       false,
    diff:        1.0,
  };
}
