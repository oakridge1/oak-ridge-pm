// Shared constants for the Takeoff tab and Counter tool.
// The item list itself (key, name, category, unit, aliases) lives in
// public/takeoff-items.json. Add or rename items THERE; the exports below are
// derived from it, so every importer keeps getting the same names and shapes.

import items from '../../public/takeoff-items.json';

/** Where an item's "→ Build" button sends it (optional "build" field in the JSON). */
export interface BuildTarget {
  tab:     string;   // estimator tab to open: 'assemblies' | 'fixtures'
  builder: 'fa' | 'lv' | 'data' | 'fixture' | 'threeway';
  target?: string;   // fa: FA device id | lv: LV device type | fixture: Fixture Builder assembly id
  ports?:  number;   // data: port count to pre-fill
}

interface TakeoffItemDef {
  key:      string;
  name:     string;
  category: string;
  unit:     string;     // 'ea' | 'ft'
  aliases:  string[];   // old / alternate spellings (PDF tool library, PDF run tool)
  build?:   BuildTarget;
}

const TAKEOFF_ITEMS = items as TakeoffItemDef[];

/** Display name for each item id. */
export const ITEM_LABELS: Record<string, string> = Object.fromEntries(
  TAKEOFF_ITEMS.map(i => [i.key, i.name]),
);

/** Items measured in linear feet rather than unit count. */
export const FOOTAGE_ITEMS = new Set<string>(
  TAKEOFF_ITEMS.filter(i => i.unit === 'ft').map(i => i.key),
);

/** Human-readable label for each category key. */
export const CATEGORY_LABELS: Record<string, string> = {
  devices:  'Devices',
  fixtures: 'Fixtures',
  data_lv:  'Data / LV',
  fa:       'Fire Alarm',
  gear:     'Gear',
  rough:    'Boxes & Rough',
  conduit:  'Conduit',
  mc:       'MC Cable',
  racks:    'Racks',
};

/** Maps every item id to its category key. */
export const ITEM_CATEGORY: Record<string, string> = Object.fromEntries(
  TAKEOFF_ITEMS.map(i => [i.key, i.category]),
);

/**
 * Display order for the 9 known categories.
 * TakeoffTab appends 'other' locally to catch unrecognised imported ids.
 * CounterTool uses this list directly for its tab bar.
 */
export const CAT_ORDER: string[] = [
  'devices', 'fixtures', 'data_lv', 'fa',
  'gear', 'rough', 'conduit', 'mc', 'racks',
];

/** Item id -> Build target, for the items that have a "→ Build" button. */
export const ITEM_BUILD: Record<string, BuildTarget> = Object.fromEntries(
  TAKEOFF_ITEMS.filter(i => i.build).map(i => [i.key, i.build as BuildTarget]),
);

/** Alternate spelling -> real item id (e.g. cond_emt_12 -> emt_12). */
export const ITEM_ALIASES: Record<string, string> = Object.fromEntries(
  TAKEOFF_ITEMS.flatMap(i => i.aliases.map(a => [a, i.key] as [string, string])),
);

/**
 * Translate alias keys in imported takeoff counts to their real item ids.
 * If an alias and its real key both appear, the quantities are added.
 * Keys that are neither (unknown) pass through untouched.
 */
export function normalizeTakeoffCounts(
  counts: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) {
    const real = ITEM_ALIASES[k] ?? k;
    if (real in out && typeof out[real] === 'number' && typeof v === 'number') {
      out[real] += v;
    } else {
      out[real] = v;
    }
  }
  return out;
}
