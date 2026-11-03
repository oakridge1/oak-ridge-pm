import type { SavedAssembly } from './constants';

export type RidgeSyncAction = 'add' | 'remove' | 'equal';

export interface RidgeSyncRow {
  label: string;
  pdfCount: number;
  /** Copies flagged fromPdf with this pdfLabel. Unflagged assemblies are never counted. */
  estimateCount: number;
  action: RidgeSyncAction;
  /** Absolute number of copies to add or remove (0 when equal). */
  diff: number;
  /** True if an unflagged assembly with this label exists to copy from. */
  hasSourceAssembly: boolean;
}

/**
 * Compare the PDF tool's placement counts (per label) to the estimate.
 * Pure: reads only its arguments, changes nothing.
 * Rows cover every tallied label plus every label that has fromPdf copies in the estimate
 * (so copies whose PDF placements were all removed show up as "remove").
 */
export function compareRidgeTally(
  tally: Record<string, number>,
  assemblies: SavedAssembly[],
): RidgeSyncRow[] {
  const flagged = new Map<string, number>();
  const sources = new Set<string>();
  for (const a of assemblies) {
    if (a.fromPdf) {
      const key = a.pdfLabel ?? a.label;
      flagged.set(key, (flagged.get(key) ?? 0) + 1);
    } else {
      sources.add(a.label);
    }
  }

  const labels = new Set<string>([...Object.keys(tally), ...flagged.keys()]);
  const rows: RidgeSyncRow[] = [];
  for (const label of labels) {
    const raw = tally[label];
    const pdfCount = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    const estimateCount = flagged.get(label) ?? 0;
    const delta = pdfCount - estimateCount;
    rows.push({
      label,
      pdfCount,
      estimateCount,
      action: delta > 0 ? 'add' : delta < 0 ? 'remove' : 'equal',
      diff: Math.abs(delta),
      hasSourceAssembly: sources.has(label),
    });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}
