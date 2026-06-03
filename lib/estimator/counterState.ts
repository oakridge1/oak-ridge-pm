export interface CounterArea {
  name:   string;
  counts: Record<string, number>;
}

export interface CounterState {
  jobName:        string;
  currentAreaIdx: number;
  areas:          CounterArea[];
}

export function createCounterState(): CounterState {
  return {
    jobName:        '',
    currentAreaIdx: 0,
    areas: [{ name: '1st Floor', counts: {} }],
  };
}

/** Compute flat totals across all areas. */
export function computeTotals(areas: CounterArea[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const area of areas) {
    for (const [k, v] of Object.entries(area.counts)) {
      totals[k] = (totals[k] ?? 0) + v;
    }
  }
  return totals;
}
