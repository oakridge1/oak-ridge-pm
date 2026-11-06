// Pure helpers for the Takeoff tab "Drops preview (included whip - view only)" panel.
// Reads the PDF tool's Ridge tally and the estimate's assemblies; changes nothing and has no dollars.
// Whip cable is already priced inside each assembly, so this only reports the feet already included.

import type { SavedAssembly } from './constants';

export interface RidgeTally {
  estimateId: string;
  updatedAt: string;
  counts: Record<string, number>;
}

/** Parse the saved ore_ridge_tally JSON. Returns null for missing or malformed data; never throws. */
export function parseRidgeTally(raw: string | null | undefined): RidgeTally | null {
  try {
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.counts || typeof data.counts !== 'object' || Array.isArray(data.counts)) {
      return null;
    }
    const counts: Record<string, number> = {};
    for (const [label, n] of Object.entries(data.counts as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) counts[label] = n;
    }
    return {
      estimateId: typeof data.estimateId === 'string' ? data.estimateId : '',
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      counts,
    };
  } catch {
    return null;
  }
}

export const NO_MATCH_REASON = 'No matching assembly';
export const NO_WHIP_REASON = 'No whip line found';

export interface DropRow {
  label: string;
  /** Placements counted by the PDF tool for this label (one device each). */
  placed: number;
  assembly: SavedAssembly | null;
  /** Included whip feet per device, or null when it can't be found. */
  whipFtEach: number | null;
  /** Plain-English reason when whipFtEach is null. */
  reason: string | null;
}

export interface DropsPreview {
  rows: DropRow[];
  totalDevices: number;
  totalWhipFt: number;
}

// "(20ft x3)" or "(20ft ×3)" inside a whip line name: feet per device, then device count.
const WHIP_NAME_QTY = /\(\s*[\d.]+\s*ft\s*[x×]\s*(\d+)\s*\)/i;

/** Devices the assembly covers: from its whip line name, else its label ("x3", "×3", "3ea"), else 1. */
export function assemblyDeviceQty(asm: SavedAssembly, whipLines: SavedAssembly['lines']): number {
  for (const l of whipLines) {
    const m = WHIP_NAME_QTY.exec(l.name ?? '');
    if (m && Number(m[1]) > 0) return Number(m[1]);
  }
  const label = asm.label ?? '';
  const x = /[x×]\s*(\d+)\s*(?:\[[^\]]*\])?\s*$/i.exec(label);
  if (x && Number(x[1]) > 0) return Number(x[1]);
  const ea = /(\d+)\s*ea\s*$/i.exec(label);
  if (ea && Number(ea[1]) > 0) return Number(ea[1]);
  return 1;
}

/**
 * Included whip feet per device for one assembly: the feet on its cable lines (unit FT, name contains
 * "whip") divided by the devices it covers. null if there is no such line.
 */
export function includedWhipFtEach(asm: SavedAssembly): number | null {
  const whipLines = (asm.lines ?? []).filter(
    (l) => String(l.unit ?? '').toUpperCase() === 'FT' && /whip/i.test(l.name ?? '') && Number(l.qty) > 0,
  );
  if (whipLines.length === 0) return null;
  const totalFt = whipLines.reduce((s, l) => s + Number(l.qty), 0);
  const devices = assemblyDeviceQty(asm, whipLines);
  const each = totalFt / devices;
  return Number.isFinite(each) && each > 0 ? each : null;
}

/** First unflagged assembly with this label (list order), else any assembly with the label. */
export function findMatchingAssembly(assemblies: SavedAssembly[], label: string): SavedAssembly | null {
  return (
    assemblies.find((a) => !a.fromPdf && a.label === label) ??
    assemblies.find((a) => a.label === label) ??
    null
  );
}

/**
 * Per device type (Ridge label): placed count, matching assembly and included whip ft per device.
 * `assemblies` is the estimate's saved assemblies flattened in list order.
 * Totals use the included whip; rows without one count for nothing.
 */
export function computeDropsPreview(tally: Record<string, number>, assemblies: SavedAssembly[]): DropsPreview {
  const rows: DropRow[] = [];
  for (const [label, n] of Object.entries(tally)) {
    const placed = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    if (placed === 0) continue;
    const assembly = findMatchingAssembly(assemblies, label);
    if (!assembly) {
      rows.push({ label, placed, assembly: null, whipFtEach: null, reason: NO_MATCH_REASON });
      continue;
    }
    const each = includedWhipFtEach(assembly);
    rows.push({
      label, placed, assembly,
      whipFtEach: each,
      reason: each === null ? NO_WHIP_REASON : null,
    });
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return { rows, ...dropTotals(rows, {}) };
}

/**
 * Totals for the rows, optionally with what-if feet-per-device overrides (by label).
 * Rows without a usable whip are ignored; an override only applies to a usable row and must be >= 0.
 */
export function dropTotals(
  rows: DropRow[],
  overrides: Record<string, number>,
): { totalDevices: number; totalWhipFt: number } {
  let totalDevices = 0;
  let totalWhipFt = 0;
  for (const r of rows) {
    if (r.whipFtEach === null) continue;
    const o = overrides[r.label];
    const each = typeof o === 'number' && Number.isFinite(o) && o >= 0 ? o : r.whipFtEach;
    totalDevices += r.placed;
    totalWhipFt += r.placed * each;
  }
  return { totalDevices, totalWhipFt };
}
