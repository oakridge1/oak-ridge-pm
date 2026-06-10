// ── lib/estimator/customAssembly.ts ──────────────────────────────────────────
// Custom Assembly Builder — data model, conductor lookup, library persistence.
// Permanent library defs live in localStorage (same pattern as
// 'ore_master_templates' in useEstimator) so they survive across jobs.

import type { SavedAssembly, AssemblyLine } from './constants';
import { getRates, applyMarkup } from './constants';
import { getBomItem, WIRE_MAP } from './bom';

// ─────────────────────────────────────
// Types
// ─────────────────────────────────────

export interface CustomAsmLine {
  id:       string;
  name:     string;
  unit:     'EA' | 'FT';
  qty:      number;
  matUnit:  number;   // $ per unit/foot (already marked up)
  hrs:      number;   // total hours for this line
  bomId?:   string;   // set if matched from BOM
  isNew?:   boolean;  // true = not in BOM, flagged for writeback
}

export interface ConductorRow {
  id:       string;
  size:     string;        // '#14' … '500'
  material: 'Cu' | 'Al';
  feet:     number;
  matUnit:  number;        // $ per foot (already marked up)
  lhrFt:    number;        // labor hours per foot
  bomId?:   string;
}

export interface CustomAssemblyDef {
  id:         string;
  name:       string;
  category:   string;
  lines:      CustomAsmLine[];
  conductors: ConductorRow[];
  totalMat:   number;
  totalHrs:   number;
  permanent:  boolean;
  createdAt:  string;
}

// ─────────────────────────────────────
// Conductor sizes
// ─────────────────────────────────────

export const CONDUCTOR_SIZES = [
  '#14', '#12', '#10', '#8', '#6', '#4', '#3', '#2', '#1',
  '1/0', '2/0', '3/0', '4/0', '250', '300', '350', '400', '500',
] as const;

// Look up a conductor's BOM entry by size + material.
// Returns null when the BOM has no matching wire (price becomes manual).
export function lookupConductor(
  size: string,
  material: 'Cu' | 'Al',
): { bomId: string; matUnit: number; lhrFt: number } | null {
  const key = (material === 'Cu' ? 'thhn_' : 'al_') + size.replace('#', '');
  const bomId = WIRE_MAP[key];
  if (!bomId) return null;
  try {
    const item = getBomItem(bomId);
    return { bomId, matUnit: applyMarkup(item.mat, item.mk), lhrFt: item.lhr };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────
// Totals
// ─────────────────────────────────────

export function calcCustomAsmTotals(
  lines: CustomAsmLine[],
  conductors: ConductorRow[],
): { totalMat: number; totalHrs: number } {
  let totalMat = 0, totalHrs = 0;
  for (const l of lines) {
    totalMat += l.matUnit * l.qty;
    totalHrs += l.hrs;
  }
  for (const c of conductors) {
    totalMat += c.matUnit * c.feet;
    totalHrs += c.lhrFt * c.feet;
  }
  return { totalMat, totalHrs };
}

// ─────────────────────────────────────
// Def → SavedAssembly conversion
// ─────────────────────────────────────

export function defToSavedAssembly(def: CustomAssemblyDef): SavedAssembly {
  const R = getRates();
  const lines: AssemblyLine[] = [
    ...def.lines.map(l => ({
      name: l.name,
      qty:  l.qty,
      unit: l.unit,
      mat:  l.matUnit * l.qty,
      lab:  l.hrs * R.labor,
    })),
    ...def.conductors.map(c => ({
      name: `${c.size} THHN ${c.material} (${c.feet}ft)`,
      qty:  c.feet,
      unit: 'FT',
      mat:  c.matUnit * c.feet,
      lab:  c.lhrFt * c.feet * R.labor,
    })),
  ];
  return {
    label: def.name,
    mat:   def.totalMat,
    lab:   def.totalHrs * R.labor,
    lines,
  };
}

// ─────────────────────────────────────
// Permanent library persistence (localStorage, cross-job)
// ─────────────────────────────────────

const LIBRARY_KEY = 'ore_custom_asm_library';

export function loadAsmLibrary(): CustomAssemblyDef[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as CustomAssemblyDef[];
  } catch {
    return [];
  }
}

export function saveAsmLibrary(defs: CustomAssemblyDef[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(defs));
}
