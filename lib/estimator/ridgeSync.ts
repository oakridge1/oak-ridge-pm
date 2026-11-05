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

/** The saved-assembly lists the estimate keeps, in the same order the Ridge List unions them. */
export const RIDGE_ASM_KEYS = [
  'savedRuns', 'savedRacks', 'savedMCHR', 'savedThreeWay',
  'savedData', 'savedFA', 'savedCans', 'savedGear',
  'savedCustomDev', 'savedTM', 'savedLV', 'savedCustomAsm',
  'savedHAR', 'savedFloorBox', 'asms', 'savedPanels',
] as const;

export type AsmLists = Record<string, SavedAssembly[]>;

/** Returns only the lists that changed (to merge back into the estimate state). */
export interface RidgeChange {
  changed: AsmLists;
  count: number; // how many copies were actually removed / marked
}

/** The assembly the Ridge List copies from: first unflagged one with this label (list order). */
export function findSourceAssembly(lists: AsmLists, label: string): SavedAssembly | undefined {
  for (const key of RIDGE_ASM_KEYS) {
    const hit = (lists[key] ?? []).find((a) => !a.fromPdf && a.label === label);
    if (hit) return hit;
  }
  return undefined;
}

/** A new PDF-placed copy of `source`, flagged fromPdf. Mirrors what the live add produces. */
export function makePdfCopy(source: SavedAssembly): SavedAssembly {
  return {
    label: source.label,
    mat: source.mat,
    lab: source.lab,
    lines: source.lines,
    bidPackage: source.bidPackage,
    area: source.area,
    costCode: source.costCode,
    fromPdf: true,
    pdfLabel: source.label,
  };
}

/**
 * Remove up to `count` copies flagged fromPdf with this pdfLabel, newest first.
 * Never touches an assembly that is not flagged fromPdf.
 */
export function removePdfCopies(lists: AsmLists, label: string, count: number): RidgeChange {
  let left = Math.max(0, Math.floor(count));
  const changed: AsmLists = {};
  let removed = 0;
  for (const key of [...RIDGE_ASM_KEYS].reverse()) {
    const arr = lists[key] ?? [];
    if (left === 0) break;
    const drop = new Set<number>();
    for (let i = arr.length - 1; i >= 0 && left > 0; i--) {
      const a = arr[i];
      if (a.fromPdf && (a.pdfLabel ?? a.label) === label) { drop.add(i); left--; removed++; }
    }
    if (drop.size) changed[key] = arr.filter((_, i) => !drop.has(i));
  }
  return { changed, count: removed };
}

/** How many hand-added (unflagged) same-label items could be marked as matched: all but the original. */
export function matchableCount(lists: AsmLists, label: string): number {
  let n = 0;
  for (const key of RIDGE_ASM_KEYS) n += (lists[key] ?? []).filter((a) => !a.fromPdf && a.label === label).length;
  return Math.max(0, n - 1);
}

/**
 * Flag up to `count` hand-added same-label items as fromPdf/pdfLabel so they count as matched.
 * The first unflagged item with the label (the original the Ridge List copies from) is never flagged.
 * Nothing else about the items changes.
 */
export function markPdfCopies(lists: AsmLists, label: string, count: number): RidgeChange {
  let left = Math.max(0, Math.floor(count));
  const changed: AsmLists = {};
  let marked = 0;
  let skippedSource = false;
  for (const key of RIDGE_ASM_KEYS) {
    const arr = lists[key] ?? [];
    let touched = false;
    const next = arr.map((a) => {
      if (a.fromPdf || a.label !== label) return a;
      if (!skippedSource) { skippedSource = true; return a; }
      if (left === 0) return a;
      left--; marked++; touched = true;
      return { ...a, fromPdf: true, pdfLabel: label };
    });
    if (touched) changed[key] = next;
  }
  return { changed, count: marked };
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
