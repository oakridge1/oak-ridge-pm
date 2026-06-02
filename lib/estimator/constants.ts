// ── lib/estimator/constants.ts ────────────────────────────────────────────────
// Pure data layer — no UI, no API calls. All subsequent phases depend on this.

// ─────────────────────────────────────
// 1. DEFAULTS and R object
// ─────────────────────────────────────

export const DEFAULTS = {
  labor:    41.50,
  bulk:     0.085,
  light:    0.05,
  permit:   0.05,
  sub:      0.03,
  overhead: 0.10,
  profit:   0.12,
  nonProd:  0.0,
};

export type RateConfig = typeof DEFAULTS;

// R is the live rate object — gets overridden by user settings at runtime
// Always import R through getRates() to get the current values
let _R: RateConfig = { ...DEFAULTS };
export const getRates = () => _R;
export const setRates = (overrides: Partial<RateConfig>) => {
  _R = { ...DEFAULTS, ...overrides };
};

// ─────────────────────────────────────
// 2. NECA labor constants
// ─────────────────────────────────────

// N6 — Devices (hours per unit)
export const N6 = {
  r15: 0.25, r20: 0.30, gf15: 0.30, gf20: 0.35,
  sw15: 0.20, sw20: 0.25, sw3: 0.40, sw4: 0.45,
  dim: 0.40, dim1000: 0.50, dim010: 0.85,
  cov1: 0.10, cov2: 0.12, wp: 0.20, wp2g: 0.25,
  photocell: 0.65, occ_ceil: 0.50, occ_pir: 0.50,
};

// N5 — Fixtures (hours per unit)
export const N5 = {
  tbar22_led: 0.60, tbar24_led: 0.75,
  strip48_led: 0.75, strip96_led: 1.15,
  vap48_led: 0.95, vap96_led: 1.20,
  rec_new: 1.25, rec_rem: 1.25, rec_retro: 0.75,
  wallpack_led: 1.25, sconce_led: 1.50,
  sconce_outdoor: 1.50, canopy_led: 0.95,
  highbay_ufo: 1.75, highbay_lin: 1.75,
  lowbay_led: 1.25, pendant_led: 1.50,
  track_4ft: 1.25, track_8ft: 1.50, track_12ft: 1.75,
  track_head: 0.60, chain48_led: 0.85, chain96_led: 1.20,
  exit_surf: 1.00, exit_self: 0.70, exit_wired: 1.00,
  emerg_dual: 1.20,
  fan36: 1.50, fan48: 2.50, fan55: 3.50, fan60: 4.50,
  fan_light_kit: 0.25,
};

// N4_BKR — Breakers (hours per unit)
export const N4_BKR: Record<string, number> = {
  '1p15': 0.32, '1p20': 0.34, '1p30': 0.38,
  '1p60': 0.47, '1p100': 0.61,
  '2p20': 0.52, '2p30': 0.58, '2p50': 0.64,
  '2p100': 0.94, '2p200': 1.50,
  '3p20': 0.71, '3p30': 0.78,
  '3p100': 1.28, '3p200': 2.00,
  afci_adder: 0.15,
};

// WIRE_PULL_LHR — Wire pull labor hours per linear foot
export const WIRE_PULL_LHR: Record<string, number> = {
  '#14': 0.010, '#12': 0.012, '#10': 0.015,
  '#8':  0.020, '#6':  0.024, '#4':  0.030,
  '#2':  0.036, '#1':  0.042,
  '1/0': 0.050, '2/0': 0.056, '3/0': 0.063, '4/0': 0.070,
  '250kcmil': 0.082, '350kcmil': 0.095, '500kcmil': 0.110,
};

// NEC_GND_SIZE — NEC Table 250.122 minimum ground wire size by OCPD rating
export const NEC_GND_SIZE: Record<string, string> = {
  '15A':   '#14', '20A':   '#12', '30A':   '#10',
  '40A':   '#10', '60A':   '#10', '100A':  '#8',
  '200A':  '#6',  '300A':  '#4',  '400A':  '#3',
  '500A':  '#2',  '600A':  '#1',  '800A':  '1/0',
  '1000A': '2/0', '1200A': '3/0', '1600A': '4/0',
  '2000A': '250kcmil',
};

// ─────────────────────────────────────
// 3. Markup helper
// ─────────────────────────────────────

// Apply markup to a base material cost
// mk: 'bulk' = 8.5%, 'light' = 5%, 'none' = 0%
export type MarkupType = 'bulk' | 'light' | 'none';
export const applyMarkup = (baseCost: number, mk: MarkupType): number => {
  const R = getRates();
  if (mk === 'bulk')  return baseCost * (1 + R.bulk);
  if (mk === 'light') return baseCost * (1 + R.light);
  return baseCost;
};

// ─────────────────────────────────────
// 4. Assembly line item type
// ─────────────────────────────────────

export interface AssemblyLine {
  name: string;
  qty:  number;
  unit: string;
  mat:  number;   // total material cost (already marked up)
  lab:  number;   // total labor cost in dollars (hours × R.labor)
}

export interface SavedAssembly {
  label:    string;
  mat:      number;
  lab:      number;
  lines:    AssemblyLine[];
  params?:  Record<string, unknown>;  // original builder params for edit/rebuild
  _edited?: boolean;                  // true if lines were manually modified
}

// ─────────────────────────────────────
// 5. Difficulty multipliers
// ─────────────────────────────────────

export const DIFFICULTY = {
  normal:      1.00,
  difficult:   1.25,
  vDifficult:  1.55,
} as const;

export type DifficultyKey = keyof typeof DIFFICULTY;
