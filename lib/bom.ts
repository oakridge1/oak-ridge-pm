export type MarkupType = "bulk" | "light";

export type BomItem = {
  id: string;
  category: string;
  name: string;
  unit: string;
  mat: number;     // material cost per unit (GCE pricing where gc=true, else estimated)
  lhr: number;     // NECA 2015-16 labor hours per unit
  mk: MarkupType;  // markup type
  gc: boolean;     // GCE stocks it (actual price)
};

// ─── NECA 2015-16 labor rate constants ──────────────────────────────────────
// Kept flat for backward-compatibility with lib/estimating.ts
export const NECA = {
  // N5 Fixtures
  tb24: 0.75, tb22: 0.60, s24: 0.80, r24: 1.10, st48: 0.75, st96: 1.15,
  ch48: 0.85, hb: 1.75, wpFix: 1.25, dl: 1.25, ex: 1.00, em: 1.20,
  f36: 1.50, f48: 2.50,
  // N6 Devices
  r15: 0.25, r20: 0.30, gf15: 0.30, gf20: 0.35,
  sw15: 0.20, sw20: 0.25, sw3: 0.40, sw4: 0.45,
  dim: 0.40, cov1: 0.10, cov2: 0.12, wp: 0.20, occ: 0.50,
  // N8 Grounding
  rod: 1.60, b34: 0.20, b1g: 0.22, b114: 0.24, b112: 0.26, b2g: 0.28, cu4: 0.016,
  // N9 HVAC / Panels
  bb48: 0.90, bb96: 1.25, wh3k: 2.20, uh5: 3.00, tsLV: 0.50, tsLN: 0.60,
  p20: 0.25, p60: 0.33, p100: 0.45, p200: 0.68,
  // N10 Temp Power
  s1p200: 12.0, s3p200: 14.0, pan100: 4.70, ext20: 0.25, str100: 2.00, gen5: 2.00,
  // N11 Conduit (per foot — used for assembly calculations)
  p34: 0.035, p1: 0.0375, p112: 0.0425, p2: 0.045, p3: 0.050, p4: 0.055,
  e34: 0.22, e2ug: 0.50, eb2: 0.04, eb3: 0.0425,
  db128: 0.018, db63: 0.020, pu128: 0.040, pu63: 0.042,
  xs: 0.04, xc: 0.10, bf: 0.08,
  // Wire and liquid tight material costs (used as constants in estimating.ts)
  LT12: 1.1627, LT34: 2.3096, LT1: 4.087,
  WNOB: 0.08760, WNRD: 0.14437, WNGN: 0.22022, GNSC: 0.13790,
} as const;

export const DEFAULTS = {
  labor: 41.50,
  bulk: 0.085,
  light: 0.05,
  permit: 0.05,
  sub: 0.03,
  overhead: 0.10,
  profit: 0.12,
  nonProd: 0.0,
} as const;

/** Job-level rates — matches DEFAULTS, aliased as R for calc functions */
export const R = {
  labor: 41.50, bulk: 0.085, light: 0.05,
  permit: 0.05, sub: 0.03, overhead: 0.10, profit: 0.12,
} as const;

/** N6 — Device installation labor hours (NECA 2015-16) */
export const N6 = {
  r15: 0.25, r20: 0.30, gf15: 0.30, gf20: 0.35,
  sw15: 0.20, sw20: 0.25, sw3: 0.40, sw4: 0.45,
  dim: 0.40, dim1000: 0.50, dim010: 0.85,
  cov1: 0.10, cov2: 0.12, wp: 0.20, wp2g: 0.25,
  photocell: 0.65, occ_ceil: 0.50, occ_pir: 0.50,
} as const;

/** N5 — Fixture installation labor hours (NECA 2015-16) */
export const N5 = {
  tbar22_led: 0.60, tbar24_led: 0.75, tbar22_2l: 0.60, tbar24_2l: 0.70,
  tbar24_4l: 0.80, surf22_led: 0.70, surf24_led: 0.80, rec22_led: 1.00,
  rec24_led: 1.10, strip24_led: 0.60, strip48_led: 0.75, strip96_led: 1.15,
  wrap24_led: 0.60, wrap48_led: 0.65, vap24_led: 0.95, vap48_led: 1.20,
  chain24_led: 0.65, chain48_led: 0.85, chain96_led: 1.20, highbay24_led: 1.75,
  wallpack_led: 1.25, sconce_led: 1.50, downlight_led: 1.25,
  exit_surf: 1.00, exit_self: 0.70, exit_rec: 1.25,
  emerg_dual: 1.20, emerg_remote1: 0.60, emerg_remote2: 0.70,
  fan_36: 1.50, fan_48: 2.50, fan_55: 3.50, fan_60: 4.50,
  track4_surf: 1.25, track8_surf: 1.50, track_head: 0.60,
  posttop_led: 4.00, shoebox_led: 3.00, bollard42_led: 2.00,
} as const;

/** N8 — Grounding labor hours (NECA 2015-16) */
export const N8 = {
  grd_rod_clamp: 1.60, grd_pigtail: 0.06, grd_wire_conn: 0.08, grd_clip: 0.06,
  bush_34: 0.20, bush_1: 0.22, bush_114: 0.24, bush_112: 0.26, bush_2: 0.28,
  bond_jmp_34: 0.80, bond_jmp_1: 0.85, bond_jmp_112: 1.00, bond_jmp_2: 1.10,
  bare_cu_gnd_8: 12.0 / 1000, bare_cu_gnd_4: 16.0 / 1000, bare_cu_gnd_2: 20.0 / 1000,
} as const;

/** N9 — HVAC/Panel labor hours (NECA 2015-16) */
export const N9 = {
  bb24: 0.75, bb36: 0.80, bb48: 0.90, bb60: 1.00, bb72: 1.10, bb96: 1.25,
  wh240_2500: 2.00, wh240_3000: 2.20, wh240_4000: 2.75, wh240_5000: 3.25,
  wh120_1000: 1.30, wh120_1500: 1.50,
  uh_2kw: 2.00, uh_5kw: 3.00, uh_10kw: 4.00, uh_15kw: 5.00,
  ceil_htr_1000: 1.00, ceil_htr_1000fan: 1.20, ceil_htr_1500fan: 1.50,
  tstat_lv1: 0.50, tstat_lv2: 0.60, tstat_linev1: 0.60, tstat_linev2: 0.66,
  pwr_20a: 0.25, pwr_50a: 0.30, pwr_60a: 0.33, pwr_80a: 0.36,
  pwr_100a: 0.45, pwr_125a: 0.50, pwr_150a: 0.54, pwr_200a: 0.68, pwr_400a: 1.20,
} as const;

/** N11 — Underground/conduit labor hours (NECA 2015-16) */
export const N11 = {
  pvc40_34_ft: 3.50 / 100, pvc40_1_ft: 3.75 / 100, pvc40_112_ft: 4.25 / 100,
  pvc40_2_ft: 4.50 / 100, pvc40_3_ft: 5.00 / 100, pvc40_4_ft: 5.50 / 100,
  pvc40_elb_34: 0.22, pvc40_elb_1: 0.25, pvc40_elb_112: 0.40,
  pvc40_elb_2: 0.50, pvc40_elb_3: 0.70, pvc40_elb_4: 1.00,
  pvc40_exp_34: 0.60, pvc40_exp_1: 0.70, pvc40_exp_2: 1.00,
  pvc40_exp_3: 1.30, pvc40_exp_4: 1.75,
} as const;

/** N4_BKR — Breaker termination labor hours (NECA Sec 4) */
export const N4_BKR = {
  "1p15": 0.32, "1p20": 0.34, "1p30": 0.38, "1p60": 0.47, "1p100": 0.61,
  "2p20": 0.52, "2p30": 0.58, "2p50": 0.64, "2p100": 0.94, "2p200": 1.50,
  "3p20": 0.71, "3p30": 0.78, "3p100": 1.28, "3p200": 2.00, afci_adder: 0.15,
} as const;

/** N4_PANEL — Panel set labor hours (NECA Sec 4) */
export const N4_PANEL = {
  "100a_surf_30": 2.6, "100a_surf_42": 3.0, "200a_surf_30": 3.4, "200a_surf_42": 4.0,
  "100a_rec_30": 3.6, "100a_rec_42": 4.0, "200a_rec_30": 4.6, "200a_rec_42": 5.2,
} as const;

// Wire connector unit costs
export const WNOB = 87.60 / 1000;
export const WNRD = 144.37 / 1000;
export const WNGN = 220.22 / 1000;
export const GND_SCR = 137.90 / 1000;
// Liquid tight per-foot costs
export const LT_12_FT = 1.1627;
export const LT_34_FT = 2.3096;
export const LT_1_FT  = 4.087;

export const BOM: BomItem[] = [
  // ── BOXES ────────────────────────────────────────────────────────────────────
  { id: "b1",  category: "Boxes", name: '4" Square Deep Box',          unit: "EA", mat: 2.5000,  lhr: 0.30, mk: "bulk", gc: true  },
  { id: "b2",  category: "Boxes", name: '4" Square Shallow Box',        unit: "EA", mat: 1.8110,  lhr: 0.30, mk: "bulk", gc: true  },
  { id: "b3",  category: "Boxes", name: "Old Work Box (plastic)",        unit: "EA", mat: 1.20,    lhr: 0.35, mk: "bulk", gc: false },
  { id: "b4",  category: "Boxes", name: "Weatherproof Box (metal)",      unit: "EA", mat: 4.50,    lhr: 0.35, mk: "bulk", gc: false },
  { id: "b5",  category: "Boxes", name: "Gangable Plastic Box",          unit: "EA", mat: 0.85,    lhr: 0.25, mk: "bulk", gc: false },
  { id: "b6",  category: "Boxes", name: "Metal Handy Box",               unit: "EA", mat: 1.95,    lhr: 0.25, mk: "bulk", gc: false },
  { id: "b7",  category: "Boxes", name: "Nail-On Box (plastic)",         unit: "EA", mat: 0.50,    lhr: 0.20, mk: "bulk", gc: false },
  { id: "b8",  category: "Boxes", name: '4" Octagon Box',               unit: "EA", mat: 1.6560,  lhr: 0.30, mk: "bulk", gc: true  },
  { id: "b9",  category: "Boxes", name: "1G Metal Old Work Box",         unit: "EA", mat: 4.3753,  lhr: 0.25, mk: "bulk", gc: true  },
  // Mud Rings
  { id: "mr1", category: "Mud Rings", name: 'SG 3/4" Mud Ring',         unit: "EA", mat: 1.2663,  lhr: 0.15, mk: "bulk", gc: true  },
  { id: "mr2", category: "Mud Rings", name: '2G 3/4" Mud Ring',         unit: "EA", mat: 2.2132,  lhr: 0.15, mk: "bulk", gc: true  },
  // Box Supports
  { id: "bs1", category: "Box Supports", name: "C23 Metal Stud Bracket", unit: "EA", mat: 2.7981,  lhr: 0.10, mk: "bulk", gc: true  },
  { id: "bs2", category: "Box Supports", name: "CJ6 Colorado Jim",       unit: "EA", mat: 0.6631,  lhr: 0.03, mk: "bulk", gc: true  },
  { id: "bs3", category: "Box Supports", name: "Madison Bar",            unit: "EA", mat: 0.6557,  lhr: 0.20, mk: "bulk", gc: true  },

  // ── EMT CONDUIT (per 10ft stick) ─────────────────────────────────────────
  { id: "e1",  category: "EMT Conduit", name: '1/2" EMT 10ft',  unit: "EA", mat: 4.555,  lhr: 0.230, mk: "bulk", gc: true  },
  { id: "e2",  category: "EMT Conduit", name: '3/4" EMT 10ft',  unit: "EA", mat: 8.029,  lhr: 0.280, mk: "bulk", gc: true  },
  { id: "e3",  category: "EMT Conduit", name: '1" EMT 10ft',    unit: "EA", mat: 8.40,   lhr: 0.330, mk: "bulk", gc: false },
  { id: "e4",  category: "EMT Conduit", name: '1-1/4" EMT 10ft',unit: "EA", mat: 11.20,  lhr: 0.380, mk: "bulk", gc: false },
  { id: "e5",  category: "EMT Conduit", name: '1-1/2" EMT 10ft',unit: "EA", mat: 13.50,  lhr: 0.430, mk: "bulk", gc: false },
  { id: "e6",  category: "EMT Conduit", name: '2" EMT 10ft',    unit: "EA", mat: 18.40,  lhr: 0.500, mk: "bulk", gc: false },
  { id: "e7",  category: "EMT Conduit", name: '3" EMT 10ft',    unit: "EA", mat: 38.00,  lhr: 0.650, mk: "bulk", gc: false },

  // ── EMT FITTINGS ─────────────────────────────────────────────────────────
  { id: "ef1",   category: "EMT Fittings", name: '1/2" Set Screw Connector',    unit: "EA", mat: 0.4047, lhr: 0.08, mk: "bulk", gc: true  },
  { id: "ef2",   category: "EMT Fittings", name: '3/4" Set Screw Connector',    unit: "EA", mat: 0.3232, lhr: 0.10, mk: "bulk", gc: true  },
  { id: "ef3",   category: "EMT Fittings", name: '1" Set Screw Connector',      unit: "EA", mat: 1.10,   lhr: 0.12, mk: "bulk", gc: false },
  { id: "ef4",   category: "EMT Fittings", name: '1/2" Set Screw Coupling',     unit: "EA", mat: 0.32,   lhr: 0.04, mk: "bulk", gc: false },
  { id: "ef5",   category: "EMT Fittings", name: '3/4" Set Screw Coupling',     unit: "EA", mat: 0.3463, lhr: 0.05, mk: "bulk", gc: true  },
  { id: "ef6",   category: "EMT Fittings", name: '1/2" Compression Connector',  unit: "EA", mat: 0.9702, lhr: 0.25, mk: "bulk", gc: true  },
  { id: "ef7",   category: "EMT Fittings", name: '3/4" Compression Connector',  unit: "EA", mat: 1.2239, lhr: 0.30, mk: "bulk", gc: true  },
  { id: "ef8",   category: "EMT Fittings", name: '1/2" Factory Elbow',          unit: "EA", mat: 2.10,   lhr: 0.20, mk: "bulk", gc: false },
  { id: "ef9",   category: "EMT Fittings", name: '3/4" Factory Elbow',          unit: "EA", mat: 2.85,   lhr: 0.22, mk: "bulk", gc: false },
  { id: "ef10b", category: "EMT Fittings", name: "1-1/4\" Set Screw Connector", unit: "EA", mat: 2.02,   lhr: 0.14, mk: "bulk", gc: true  },
  { id: "ef11",  category: "EMT Fittings", name: "1-1/2\" Set Screw Connector", unit: "EA", mat: 0.23,   lhr: 0.16, mk: "bulk", gc: true  },
  { id: "ef12",  category: "EMT Fittings", name: "2\" Set Screw Connector",     unit: "EA", mat: 3.20,   lhr: 0.18, mk: "bulk", gc: false },
  { id: "ef13",  category: "EMT Fittings", name: "1-1/4\" Set Screw Coupling",  unit: "EA", mat: 2.02,   lhr: 0.06, mk: "bulk", gc: true  },
  { id: "ef14",  category: "EMT Fittings", name: "1-1/2\" Set Screw Coupling",  unit: "EA", mat: 0.23,   lhr: 0.07, mk: "bulk", gc: true  },
  { id: "ef15",  category: "EMT Fittings", name: "2\" Set Screw Coupling",      unit: "EA", mat: 4.00,   lhr: 0.08, mk: "bulk", gc: true  },

  // ── MC FITTINGS ──────────────────────────────────────────────────────────
  { id: "mc1",  category: "MC Fittings", name: 'Duplex Snap-In 3/8" MC Connector', unit: "EA", mat: 3.4211, lhr: 0.12, mk: "bulk", gc: true  },
  { id: "mc2",  category: "MC Fittings", name: 'Single Snap-In 1/2" MC Connector', unit: "EA", mat: 1.4182, lhr: 0.12, mk: "bulk", gc: true  },
  { id: "mc4",  category: "MC Fittings", name: '3/8" MC Strap 1-Hole',             unit: "EA", mat: 0.2032, lhr: 0.03, mk: "bulk", gc: true  },
  { id: "mc5",  category: "MC Fittings", name: '3/4" 1-Hole EMT Strap',            unit: "EA", mat: 0.39,   lhr: 0.04, mk: "bulk", gc: true  },

  // ── CONDUIT BODIES ───────────────────────────────────────────────────────
  { id: "cb1", category: "Conduit Bodies", name: '1/2" LB Conduit Body (Al)',  unit: "EA", mat: 6.1809, lhr: 0.25, mk: "bulk", gc: true  },
  { id: "cb2", category: "Conduit Bodies", name: '1/2" PVC LB',               unit: "EA", mat: 3.6385, lhr: 0.25, mk: "bulk", gc: true  },
  { id: "cb3", category: "Conduit Bodies", name: '1" PVC LB',                 unit: "EA", mat: 5.1402, lhr: 0.28, mk: "bulk", gc: true  },

  // ── PVC CONDUIT SCHEDULE 40 (per foot) ───────────────────────────────────
  { id: "pvc1", category: "PVC Conduit", name: '1/2" PVC Sch40 per ft',   unit: "FT", mat: 0.3064, lhr: 0.020, mk: "bulk", gc: true  },
  { id: "pvc2", category: "PVC Conduit", name: '3/4" PVC Sch40 per ft',   unit: "FT", mat: 0.85,   lhr: 0.023, mk: "bulk", gc: true  },
  { id: "pvc3", category: "PVC Conduit", name: '1" PVC Sch40 per ft',     unit: "FT", mat: 0.5542, lhr: 0.026, mk: "bulk", gc: true  },
  { id: "pvc4", category: "PVC Conduit", name: '1-1/2" PVC Sch40 per ft', unit: "FT", mat: 0.8948, lhr: 0.033, mk: "bulk", gc: true  },
  { id: "pvc5", category: "PVC Conduit", name: '2" PVC Sch40 per ft',     unit: "FT", mat: 0.9299, lhr: 0.038, mk: "bulk", gc: true  },
  { id: "pvc6", category: "PVC Conduit", name: "3\" PVC Sch40 per ft",    unit: "FT", mat: 1.7299, lhr: 0.050, mk: "bulk", gc: true  },
  { id: "pvc7", category: "PVC Conduit", name: "4\" PVC Sch40 per ft",    unit: "FT", mat: 2.93,   lhr: 0.065, mk: "bulk", gc: true  },

  // ── PVC FITTINGS ─────────────────────────────────────────────────────────
  { id: "pvf1",  category: "PVC Fittings", name: '1/2" PVC Coupling',         unit: "EA", mat: 0.2011,  lhr: 0.04, mk: "bulk", gc: true  },
  { id: "pvf2",  category: "PVC Fittings", name: '3/4" PVC Coupling',         unit: "EA", mat: 0.2481,  lhr: 0.05, mk: "bulk", gc: true  },
  { id: "pvf3",  category: "PVC Fittings", name: '3/4" PVC 90 Elbow',         unit: "EA", mat: 1.2495,  lhr: 0.14, mk: "bulk", gc: true  },
  { id: "pvf4",  category: "PVC Fittings", name: '1" PVC Coupling',           unit: "EA", mat: 0.3821,  lhr: 0.05, mk: "bulk", gc: true  },
  { id: "pvf5",  category: "PVC Fittings", name: '1" PVC 90 Elbow',           unit: "EA", mat: 1.9486,  lhr: 0.14, mk: "bulk", gc: true  },
  { id: "pvf6",  category: "PVC Fittings", name: '2" PVC Coupling',           unit: "EA", mat: 0.9584,  lhr: 0.06, mk: "bulk", gc: true  },
  { id: "pvf7",  category: "PVC Fittings", name: '2" PVC 90 Elbow',           unit: "EA", mat: 3.3999,  lhr: 0.18, mk: "bulk", gc: true  },
  { id: "pvf8",  category: "PVC Fittings", name: '3" PVC Coupling',           unit: "EA", mat: 2.7916,  lhr: 0.08, mk: "bulk", gc: true  },
  { id: "pvf9",  category: "PVC Fittings", name: '3/4" PVC Expansion Joint',  unit: "EA", mat: 19.8438, lhr: 0.60, mk: "bulk", gc: true  },
  { id: "pvf10", category: "PVC Fittings", name: '2" PVC Expansion Joint',    unit: "EA", mat: 25.0845, lhr: 1.00, mk: "bulk", gc: true  },

  // ── PVC SCHEDULE 80 (per foot) ───────────────────────────────────────────
  { id: "p80_1",  category: "PVC Conduit Sch80", name: '1/2" Sch80 PVC per ft',   unit: "FT", mat: 0.52, lhr: 0.022, mk: "bulk", gc: false },
  { id: "p80_2",  category: "PVC Conduit Sch80", name: '3/4" Sch80 PVC per ft',   unit: "FT", mat: 0.68, lhr: 0.025, mk: "bulk", gc: false },
  { id: "p80_3",  category: "PVC Conduit Sch80", name: '1" Sch80 PVC per ft',     unit: "FT", mat: 0.92, lhr: 0.028, mk: "bulk", gc: false },
  { id: "p80_4",  category: "PVC Conduit Sch80", name: '1-1/4" Sch80 PVC per ft', unit: "FT", mat: 1.28, lhr: 0.033, mk: "bulk", gc: false },
  { id: "p80_5",  category: "PVC Conduit Sch80", name: '1-1/2" Sch80 PVC per ft', unit: "FT", mat: 1.52, lhr: 0.038, mk: "bulk", gc: false },
  { id: "p80_6",  category: "PVC Conduit Sch80", name: '2" Sch80 PVC per ft',     unit: "FT", mat: 1.98, lhr: 0.043, mk: "bulk", gc: false },
  { id: "p80_1c", category: "PVC Conduit Sch80", name: '1/2" Sch80 Coupling',     unit: "EA", mat: 0.35, lhr: 0.04,  mk: "bulk", gc: false },
  { id: "p80_2c", category: "PVC Conduit Sch80", name: '3/4" Sch80 Coupling',     unit: "EA", mat: 0.45, lhr: 0.05,  mk: "bulk", gc: false },
  { id: "p80_3c", category: "PVC Conduit Sch80", name: '1" Sch80 Coupling',       unit: "EA", mat: 0.62, lhr: 0.05,  mk: "bulk", gc: false },
  { id: "p80_1cn",category: "PVC Conduit Sch80", name: '1/2" Sch80 Connector',    unit: "EA", mat: 0.58, lhr: 0.10,  mk: "bulk", gc: false },
  { id: "p80_2cn",category: "PVC Conduit Sch80", name: '3/4" Sch80 Connector',    unit: "EA", mat: 0.78, lhr: 0.12,  mk: "bulk", gc: false },
  { id: "p80_3cn",category: "PVC Conduit Sch80", name: '1" Sch80 Connector',      unit: "EA", mat: 1.05, lhr: 0.14,  mk: "bulk", gc: false },

  // ── RIGID CONDUIT (per 10ft stick) ───────────────────────────────────────
  { id: "rg1",  category: "Rigid Conduit", name: '1/2" Rigid 10ft',   unit: "EA", mat: 37.50,   lhr: 0.350, mk: "bulk", gc: true  },
  { id: "rg2",  category: "Rigid Conduit", name: '3/4" Rigid 10ft',   unit: "EA", mat: 41.00,   lhr: 0.400, mk: "bulk", gc: true  },
  { id: "rg3",  category: "Rigid Conduit", name: '1" Rigid 10ft',     unit: "EA", mat: 65.417,  lhr: 0.450, mk: "bulk", gc: true  },
  { id: "rg4",  category: "Rigid Conduit", name: '1-1/4" Rigid 10ft', unit: "EA", mat: 96.28,   lhr: 0.500, mk: "bulk", gc: true  },
  { id: "rg5",  category: "Rigid Conduit", name: '1-1/2" Rigid 10ft', unit: "EA", mat: 99.23,   lhr: 0.550, mk: "bulk", gc: true  },
  { id: "rg6",  category: "Rigid Conduit", name: '2" Rigid 10ft',     unit: "EA", mat: 133.044, lhr: 0.620, mk: "bulk", gc: true  },
  { id: "rg7",  category: "Rigid Conduit", name: '3" Rigid 10ft',     unit: "EA", mat: 266.425, lhr: 0.750, mk: "bulk", gc: true  },
  { id: "rg8",  category: "Rigid Conduit", name: '4" Rigid 10ft',     unit: "EA", mat: 369.255, lhr: 0.900, mk: "bulk", gc: true  },
  // Rigid couplings
  { id: "rg1c", category: "Rigid Conduit", name: '1/2" Rigid Coupling',   unit: "EA", mat: 3.00,  lhr: 0.06, mk: "bulk", gc: true  },
  { id: "rg2c", category: "Rigid Conduit", name: '3/4" Rigid Coupling',   unit: "EA", mat: 3.60,  lhr: 0.07, mk: "bulk", gc: true  },
  { id: "rg3c", category: "Rigid Conduit", name: '1" Rigid Coupling',     unit: "EA", mat: 5.15,  lhr: 0.08, mk: "bulk", gc: true  },
  { id: "rg4c", category: "Rigid Conduit", name: '1-1/4" Rigid Coupling', unit: "EA", mat: 7.18,  lhr: 0.09, mk: "bulk", gc: true  },
  { id: "rg5c", category: "Rigid Conduit", name: '1-1/2" Rigid Coupling', unit: "EA", mat: 9.54,  lhr: 0.10, mk: "bulk", gc: true  },
  { id: "rg6c", category: "Rigid Conduit", name: '2" Rigid Coupling',     unit: "EA", mat: 11.90, lhr: 0.11, mk: "bulk", gc: true  },
  { id: "rg7c", category: "Rigid Conduit", name: '3" Rigid Coupling',     unit: "EA", mat: 38.48, lhr: 0.14, mk: "bulk", gc: true  },
  { id: "rg8c", category: "Rigid Conduit", name: '4" Rigid Coupling',     unit: "EA", mat: 51.55, lhr: 0.16, mk: "bulk", gc: true  },
  // Rigid connectors
  { id: "rg1e", category: "Rigid Conduit", name: '1/2" Rigid Connector',   unit: "EA", mat: 3.00,  lhr: 0.10, mk: "bulk", gc: true  },
  { id: "rg2e", category: "Rigid Conduit", name: '3/4" Rigid Connector',   unit: "EA", mat: 3.60,  lhr: 0.12, mk: "bulk", gc: true  },
  { id: "rg3e", category: "Rigid Conduit", name: '1" Rigid Connector',     unit: "EA", mat: 5.15,  lhr: 0.14, mk: "bulk", gc: true  },
  { id: "rg4e", category: "Rigid Conduit", name: '1-1/4" Rigid Connector', unit: "EA", mat: 7.18,  lhr: 0.16, mk: "bulk", gc: true  },
  { id: "rg5e", category: "Rigid Conduit", name: '1-1/2" Rigid Connector', unit: "EA", mat: 9.54,  lhr: 0.18, mk: "bulk", gc: true  },
  { id: "rg6e", category: "Rigid Conduit", name: '2" Rigid Connector',     unit: "EA", mat: 11.90, lhr: 0.20, mk: "bulk", gc: true  },
  { id: "rg7e", category: "Rigid Conduit", name: '3" Rigid Connector',     unit: "EA", mat: 38.48, lhr: 0.22, mk: "bulk", gc: true  },
  { id: "rg8e", category: "Rigid Conduit", name: '4" Rigid Connector',     unit: "EA", mat: 51.55, lhr: 0.25, mk: "bulk", gc: true  },
  // Locknuts
  { id: "ln_12",  category: "Rigid Conduit", name: '1/2" Locknut',   unit: "EA", mat: 0.35, lhr: 0.04, mk: "bulk", gc: false },
  { id: "ln_34",  category: "Rigid Conduit", name: '3/4" Locknut',   unit: "EA", mat: 0.45, lhr: 0.04, mk: "bulk", gc: false },
  { id: "ln_1",   category: "Rigid Conduit", name: '1" Locknut',     unit: "EA", mat: 0.65, lhr: 0.05, mk: "bulk", gc: false },
  { id: "ln_114", category: "Rigid Conduit", name: '1-1/4" Locknut', unit: "EA", mat: 0.85, lhr: 0.05, mk: "bulk", gc: false },
  { id: "ln_112", category: "Rigid Conduit", name: '1-1/2" Locknut', unit: "EA", mat: 1.10, lhr: 0.06, mk: "bulk", gc: false },
  { id: "ln_2",   category: "Rigid Conduit", name: '2" Locknut',     unit: "EA", mat: 1.65, lhr: 0.07, mk: "bulk", gc: false },
  { id: "ln_3",   category: "Rigid Conduit", name: '3" Locknut',     unit: "EA", mat: 3.20, lhr: 0.10, mk: "bulk", gc: false },
  { id: "ln_4",   category: "Rigid Conduit", name: '4" Locknut',     unit: "EA", mat: 5.50, lhr: 0.12, mk: "bulk", gc: false },

  // ── LIQUID TIGHT ─────────────────────────────────────────────────────────
  { id: "lt1",  category: "Liquid Tight", name: '1/2" Liquid Tight per ft',    unit: "FT", mat: NECA.LT12, lhr: 0.025, mk: "bulk", gc: true  },
  { id: "lt2",  category: "Liquid Tight", name: '3/4" Liquid Tight per ft',    unit: "FT", mat: NECA.LT34, lhr: 0.030, mk: "bulk", gc: true  },
  { id: "lt3",  category: "Liquid Tight", name: '1" Liquid Tight per ft',      unit: "FT", mat: NECA.LT1,  lhr: 0.035, mk: "bulk", gc: true  },
  { id: "ltf1", category: "Liquid Tight", name: '1/2" LT Straight Connector',  unit: "EA", mat: 2.4587,    lhr: 0.15,  mk: "bulk", gc: true  },
  { id: "ltf2", category: "Liquid Tight", name: '3/4" LT Straight Connector',  unit: "EA", mat: 4.6427,    lhr: 0.18,  mk: "bulk", gc: true  },
  { id: "ltf3", category: "Liquid Tight", name: '3/4" LT 90 Connector',        unit: "EA", mat: 6.2488,    lhr: 0.20,  mk: "bulk", gc: true  },
  { id: "ltf4", category: "Liquid Tight", name: '1" LT Straight Connector',    unit: "EA", mat: 7.5849,    lhr: 0.22,  mk: "bulk", gc: true  },

  // ── WIRE & CABLE ─────────────────────────────────────────────────────────
  // MC Cable (per foot)
  { id: "w1",  category: "Wire & Cable", name: "12/2 MC Glide per ft (coil)", unit: "FT", mat: 0.60,      lhr: 0.026, mk: "bulk", gc: true  },
  { id: "w2",  category: "Wire & Cable", name: "12/3 MC Glide per ft",        unit: "FT", mat: 1.17,      lhr: 0.028, mk: "bulk", gc: true  },
  { id: "w3",  category: "Wire & Cable", name: "10/2 MC Glide per ft",        unit: "FT", mat: 0.78,      lhr: 0.029, mk: "bulk", gc: false },
  { id: "w4",  category: "Wire & Cable", name: "10/3 MC Glide per ft",        unit: "FT", mat: 1.05,      lhr: 0.032, mk: "bulk", gc: false },
  // THHN Cu (per foot)
  { id: "w5",      category: "Wire & Cable", name: "#12 THHN Cu per ft",    unit: "FT", mat: 0.2316,     lhr: 0.006, mk: "bulk", gc: true  },
  { id: "w6",      category: "Wire & Cable", name: "#10 THHN Cu per ft",    unit: "FT", mat: 0.18,       lhr: 0.007, mk: "bulk", gc: false },
  { id: "w7",      category: "Wire & Cable", name: "#8 THHN Cu per ft",     unit: "FT", mat: 0.32,       lhr: 0.009, mk: "bulk", gc: false },
  { id: "w8",      category: "Wire & Cable", name: "#6 THHN Cu per ft",     unit: "FT", mat: 1.0117,     lhr: 0.011, mk: "bulk", gc: true  },
  { id: "w9",      category: "Wire & Cable", name: "#4 THHN Cu per ft",     unit: "FT", mat: 0.72,       lhr: 0.013, mk: "bulk", gc: false },
  { id: "w_14cu",  category: "Wire & Cable", name: "#14 THHN Cu per ft",    unit: "FT", mat: 0.140930,   lhr: 0.005, mk: "bulk", gc: true  },
  { id: "w_10cu",  category: "Wire & Cable", name: "#10 THHN Cu per ft",    unit: "FT", mat: 0.340640,   lhr: 0.008, mk: "bulk", gc: true  },
  { id: "w_8cu",   category: "Wire & Cable", name: "#8 THHN Cu per ft",     unit: "FT", mat: 0.657560,   lhr: 0.010, mk: "bulk", gc: true  },
  { id: "w_4cu",   category: "Wire & Cable", name: "#4 THHN Cu per ft",     unit: "FT", mat: 1.548190,   lhr: 0.013, mk: "bulk", gc: true  },
  { id: "w_3cu",   category: "Wire & Cable", name: "#3 THHN Cu per ft",     unit: "FT", mat: 1.952760,   lhr: 0.015, mk: "bulk", gc: true  },
  { id: "w_2cu",   category: "Wire & Cable", name: "#2 THHN Cu per ft",     unit: "FT", mat: 2.444250,   lhr: 0.017, mk: "bulk", gc: true  },
  { id: "w_1cu",   category: "Wire & Cable", name: "#1 THHN Cu per ft",     unit: "FT", mat: 2.801450,   lhr: 0.020, mk: "bulk", gc: true  },
  { id: "w_1_0cu", category: "Wire & Cable", name: "1/0 THHN Cu per ft",    unit: "FT", mat: 3.429930,   lhr: 0.023, mk: "bulk", gc: true  },
  { id: "w_2_0cu", category: "Wire & Cable", name: "2/0 THHN Cu per ft",    unit: "FT", mat: 4.224990,   lhr: 0.026, mk: "bulk", gc: true  },
  { id: "w_3_0cu", category: "Wire & Cable", name: "3/0 THHN Cu per ft",    unit: "FT", mat: 5.332090,   lhr: 0.030, mk: "bulk", gc: true  },
  { id: "w_4_0cu", category: "Wire & Cable", name: "4/0 THHN Cu per ft",    unit: "FT", mat: 6.655850,   lhr: 0.034, mk: "bulk", gc: true  },
  { id: "w_250cu", category: "Wire & Cable", name: "250kcmil THHN Cu per ft",unit: "FT", mat: 7.712470,   lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_350cu", category: "Wire & Cable", name: "350kcmil THHN Cu per ft",unit: "FT", mat: 10.016015,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_400cu", category: "Wire & Cable", name: "400kcmil THHN Cu per ft",unit: "FT", mat: 12.319560,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_500cu", category: "Wire & Cable", name: "500kcmil THHN Cu per ft",unit: "FT", mat: 15.566680,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_600cu", category: "Wire & Cable", name: "600kcmil THHN Cu per ft",unit: "FT", mat: 19.397560,  lhr: 0.040, mk: "bulk", gc: true  },
  // THHN Al (per foot, #2 and larger)
  { id: "w10al",   category: "Wire & Cable", name: "#2 XHHW Al per ft",      unit: "FT", mat: 0.49544,    lhr: 0.017, mk: "bulk", gc: true  },
  { id: "w_2al",   category: "Wire & Cable", name: "#2 THHN Al per ft",      unit: "FT", mat: 0.651120,   lhr: 0.017, mk: "bulk", gc: true  },
  { id: "w_1al",   category: "Wire & Cable", name: "#1 THHN Al per ft",      unit: "FT", mat: 0.897350,   lhr: 0.020, mk: "bulk", gc: true  },
  { id: "w_1_0al", category: "Wire & Cable", name: "1/0 THHN Al per ft",     unit: "FT", mat: 1.007820,   lhr: 0.023, mk: "bulk", gc: true  },
  { id: "w_2_0al", category: "Wire & Cable", name: "2/0 THHN Al per ft",     unit: "FT", mat: 1.191040,   lhr: 0.026, mk: "bulk", gc: true  },
  { id: "w_3_0al", category: "Wire & Cable", name: "3/0 THHN Al per ft",     unit: "FT", mat: 1.478740,   lhr: 0.030, mk: "bulk", gc: true  },
  { id: "w_4_0al", category: "Wire & Cable", name: "4/0 THHN Al per ft",     unit: "FT", mat: 1.643620,   lhr: 0.034, mk: "bulk", gc: true  },
  { id: "w_250al", category: "Wire & Cable", name: "250kcmil THHN Al per ft", unit: "FT", mat: 2.006430,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_300al", category: "Wire & Cable", name: "300kcmil THHN Al per ft", unit: "FT", mat: 2.772380,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_350al", category: "Wire & Cable", name: "350kcmil THHN Al per ft", unit: "FT", mat: 2.818160,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_400al", category: "Wire & Cable", name: "400kcmil THHN Al per ft", unit: "FT", mat: 3.294590,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_500al", category: "Wire & Cable", name: "500kcmil THHN Al per ft", unit: "FT", mat: 3.633540,  lhr: 0.040, mk: "bulk", gc: true  },
  { id: "w_600al", category: "Wire & Cable", name: "600kcmil THHN Al per ft", unit: "FT", mat: 4.360248,  lhr: 0.040, mk: "bulk", gc: true  },
  // Misc wire
  { id: "w11",  category: "Wire & Cable", name: "14/2 NM per ft",                 unit: "FT", mat: 0.284, lhr: 0.030, mk: "bulk", gc: true  },
  { id: "w14",  category: "Wire & Cable", name: "Cat6 Cable per ft",              unit: "FT", mat: 0.30,  lhr: 0.010, mk: "bulk", gc: false },
  { id: "w15",  category: "Wire & Cable", name: "Bare Cu #4 per ft",              unit: "FT", mat: 1.487, lhr: 0.013, mk: "bulk", gc: true  },
  { id: "w16",  category: "Wire & Cable", name: "Luminaire Cable 12/2+16/2 per ft",unit: "FT",mat: 1.90,  lhr: 0.026, mk: "bulk", gc: true  },
  // Romex / NM-B
  { id: "rm1",  category: "Wire & Cable", name: "14/2 Romex NM-B per ft", unit: "FT", mat: 0.28,  lhr: 0.018, mk: "bulk", gc: false },
  { id: "rm2",  category: "Wire & Cable", name: "12/2 Romex NM-B per ft", unit: "FT", mat: 0.38,  lhr: 0.020, mk: "bulk", gc: false },
  { id: "rm3",  category: "Wire & Cable", name: "12/3 Romex NM-B per ft", unit: "FT", mat: 0.58,  lhr: 0.023, mk: "bulk", gc: false },
  { id: "rm4",  category: "Wire & Cable", name: "Romex Staple (500pk=$22)",unit: "EA", mat: 0.044, lhr: 0.02,  mk: "bulk", gc: false },

  // ── WIRE CONNECTORS ──────────────────────────────────────────────────────
  { id: "wc1", category: "Wire Connectors", name: "Orange/Blue Wire Nut", unit: "EA", mat: NECA.WNOB, lhr: 0.04, mk: "bulk", gc: true  },
  { id: "wc2", category: "Wire Connectors", name: "Red Wire Nut",         unit: "EA", mat: NECA.WNRD, lhr: 0.06, mk: "bulk", gc: true  },
  { id: "wc3", category: "Wire Connectors", name: "Green Wire Nut",       unit: "EA", mat: NECA.WNGN, lhr: 0.06, mk: "bulk", gc: true  },

  // ── GROUNDING ────────────────────────────────────────────────────────────
  { id: "gr1", category: "Grounding", name: "Ground Screw #10-32",          unit: "EA", mat: NECA.GNSC, lhr: 0.04,         mk: "bulk", gc: true  },
  { id: "gr2", category: "Grounding", name: 'Ground Rod 5/8" x 8ft',        unit: "EA", mat: 19.99,     lhr: 0,            mk: "bulk", gc: true  },
  { id: "gr3", category: "Grounding", name: "Ground Rod Acorn Clamp",        unit: "EA", mat: 4.2182,    lhr: NECA.rod,     mk: "bulk", gc: true  },
  { id: "gr4", category: "Grounding", name: "Ground Pigtail for Box",        unit: "EA", mat: 0.45,      lhr: 0.06,         mk: "bulk", gc: false },
  { id: "gr5", category: "Grounding", name: '3/4" Conduit Grounding Bushing',unit: "EA", mat: 2.20,      lhr: NECA.b34,     mk: "bulk", gc: false },
  { id: "gr6", category: "Grounding", name: '1" Conduit Grounding Bushing',  unit: "EA", mat: 2.80,      lhr: NECA.b1g,     mk: "bulk", gc: false },
  { id: "gr7", category: "Grounding", name: "Bare Cu #4 Ground per ft",      unit: "FT", mat: 1.487,     lhr: NECA.cu4,     mk: "bulk", gc: true  },

  // ── STRUT & HANGERS ──────────────────────────────────────────────────────
  { id: "sh1",      category: "Strut & Hangers", name: "1-5/8 Strut 12ga per ft",   unit: "FT", mat: 1.9999, lhr: 0.025, mk: "bulk", gc: true  },
  { id: "sh2",      category: "Strut & Hangers", name: 'Caddy Beam Clamp 1/4" Rod', unit: "EA", mat: 2.0007, lhr: 0.10,  mk: "bulk", gc: true  },
  { id: "sh3",      category: "Strut & Hangers", name: "Jack Chain per ft",          unit: "FT", mat: 0.40,   lhr: 0.05,  mk: "bulk", gc: false },
  { id: "sc1",      category: "Strut & Hangers", name: '1/2" Click-It Strap',        unit: "EA", mat: 1.1056, lhr: 0.05,  mk: "bulk", gc: true  },
  { id: "sc2",      category: "Strut & Hangers", name: '1" Click-It Strap',          unit: "EA", mat: 1.6235, lhr: 0.05,  mk: "bulk", gc: true  },
  { id: "sc3",      category: "Strut & Hangers", name: '1-1/2" Click-It Strap',      unit: "EA", mat: 1.9306, lhr: 0.05,  mk: "bulk", gc: true  },
  // Threaded rod / rack hardware
  { id: "rack_rod",  category: "Strut & Hangers", name: "3/8 in Threaded Rod per ft",     unit: "FT", mat: 1.00,   lhr: 0.05, mk: "bulk", gc: true  },
  { id: "rack_bc",   category: "Strut & Hangers", name: "Beam Clamp 3/8 in Rod",           unit: "EA", mat: 0.8829, lhr: 0.10, mk: "bulk", gc: true  },
  { id: "rack_cap",  category: "Strut & Hangers", name: "Strut End Cap",                   unit: "EA", mat: 5.6505, lhr: 0.05, mk: "bulk", gc: true  },
  { id: "rack_di",   category: "Strut & Hangers", name: "3/8 in Drop-In Anchor",           unit: "EA", mat: 2.50,   lhr: 0.10, mk: "bulk", gc: false },
  { id: "rack_fw",   category: "Strut & Hangers", name: '3/8 in x 1-1/4 in Fender Washer',unit: "EA", mat: 0.29,   lhr: 0.02, mk: "bulk", gc: false },
  { id: "rack_lw",   category: "Strut & Hangers", name: "3/8 in Lock Washer",              unit: "EA", mat: 0.27,   lhr: 0.02, mk: "bulk", gc: false },
  { id: "rack_bolt", category: "Strut & Hangers", name: "3/8 in Hex Bolt",                 unit: "EA", mat: 1.05,   lhr: 0.03, mk: "bulk", gc: false },
  { id: "rack_cn",   category: "Strut & Hangers", name: "3/8 in Coupling Nut",             unit: "EA", mat: 0.65,   lhr: 0.04, mk: "bulk", gc: false },

  // ── CONDUIT SUPPORTS (1-hole straps) ────────────────────────────────────
  { id: "sp_emt12",  category: "Supports", name: '1/2" EMT 1-Hole Strap',    unit: "EA", mat: 0.22,  lhr: 0.04, mk: "bulk", gc: false },
  { id: "sp_emt34",  category: "Supports", name: '3/4" EMT 1-Hole Strap',    unit: "EA", mat: 0.28,  lhr: 0.04, mk: "bulk", gc: false },
  { id: "sp_emt1",   category: "Supports", name: '1" EMT 1-Hole Strap',      unit: "EA", mat: 0.38,  lhr: 0.05, mk: "bulk", gc: false },
  { id: "sp_emt114", category: "Supports", name: "1-1/4\" EMT 1-Hole Strap", unit: "EA", mat: 1.25,  lhr: 0.05, mk: "bulk", gc: true  },
  { id: "sp_emt112", category: "Supports", name: "1-1/2\" EMT 1-Hole Strap", unit: "EA", mat: 0.202, lhr: 0.05, mk: "bulk", gc: true  },
  { id: "sp_emt2",   category: "Supports", name: "2\" EMT 1-Hole Strap",     unit: "EA", mat: 0.28,  lhr: 0.06, mk: "bulk", gc: false },
  // Conduit hangers
  { id: "sp_hng12",  category: "Supports", name: "1/2\" Conduit Hanger",    unit: "EA", mat: 0.35, lhr: 0.04, mk: "bulk", gc: false },
  { id: "sp_hng34",  category: "Supports", name: "3/4\" Conduit Hanger",    unit: "EA", mat: 0.42, lhr: 0.04, mk: "bulk", gc: false },
  { id: "sp_hng1",   category: "Supports", name: "1\" Conduit Hanger",      unit: "EA", mat: 0.55, lhr: 0.05, mk: "bulk", gc: false },
  { id: "sp_hng114", category: "Supports", name: "1-1/4\" Conduit Hanger",  unit: "EA", mat: 0.68, lhr: 0.05, mk: "bulk", gc: false },
  { id: "sp_hng112", category: "Supports", name: "1-1/2\" Conduit Hanger",  unit: "EA", mat: 0.82, lhr: 0.05, mk: "bulk", gc: false },
  { id: "sp_hng2",   category: "Supports", name: "2\" Conduit Hanger",      unit: "EA", mat: 1.05, lhr: 0.06, mk: "bulk", gc: false },
  // Strut clips
  { id: "sp_cli34",  category: "Supports", name: "3/4\" Strut Clip",  unit: "EA", mat: 1.42, lhr: 0.05, mk: "bulk", gc: false },
  { id: "sp_cli114", category: "Supports", name: "1-1/4\" Strut Clip",unit: "EA", mat: 1.78, lhr: 0.05, mk: "bulk", gc: false },
  { id: "sp_cli2",   category: "Supports", name: "2\" Strut Clip",    unit: "EA", mat: 2.15, lhr: 0.05, mk: "bulk", gc: false },

  // ── PANELS & GEAR ────────────────────────────────────────────────────────
  { id: "pg1",  category: "Panels & Gear", name: "30/60 100A Load Center",         unit: "EA", mat: 144.29,  lhr: 3.0,  mk: "light", gc: true  },
  { id: "pg2",  category: "Panels & Gear", name: "40/80 200A Load Center",         unit: "EA", mat: 213.82,  lhr: 4.0,  mk: "light", gc: true  },
  { id: "pg3",  category: "Panels & Gear", name: "1P 15A Breaker (HOM)",           unit: "EA", mat: 7.33,    lhr: 0.32, mk: "light", gc: true  },
  { id: "pg4",  category: "Panels & Gear", name: "1P 20A Breaker (HOM)",           unit: "EA", mat: 5.99,    lhr: 0.34, mk: "light", gc: true  },
  { id: "pg5",  category: "Panels & Gear", name: "1P 20A AFCI/GFCI Breaker",       unit: "EA", mat: 61.23,   lhr: 0.49, mk: "light", gc: true  },
  { id: "pg5b", category: "Panels & Gear", name: "1P 15A AFCI Plug-On Neutral",    unit: "EA", mat: 63.56,   lhr: 0.49, mk: "light", gc: true  },
  { id: "pg6",  category: "Panels & Gear", name: "1P 20A GFCI Breaker (QO)",       unit: "EA", mat: 59.02,   lhr: 0.49, mk: "light", gc: true  },
  { id: "pg7",  category: "Panels & Gear", name: "1P 30A Breaker (HOM)",           unit: "EA", mat: 7.48,    lhr: 0.38, mk: "light", gc: true  },
  { id: "pg8",  category: "Panels & Gear", name: "1P 60A Breaker",                 unit: "EA", mat: 16.00,   lhr: 0.47, mk: "light", gc: false },
  { id: "pg9",  category: "Panels & Gear", name: "2P 20A Breaker (HOM)",           unit: "EA", mat: 13.59,   lhr: 0.52, mk: "light", gc: true  },
  { id: "pg10", category: "Panels & Gear", name: "2P 30A Breaker (HOM)",           unit: "EA", mat: 17.30,   lhr: 0.58, mk: "light", gc: true  },
  { id: "pg11", category: "Panels & Gear", name: "2P 50A Breaker (HOM)",           unit: "EA", mat: 17.30,   lhr: 0.64, mk: "light", gc: true  },
  { id: "pg12", category: "Panels & Gear", name: "2P 50A GFCI Breaker",            unit: "EA", mat: 135.89,  lhr: 0.64, mk: "light", gc: true  },
  { id: "pg13", category: "Panels & Gear", name: "3P 20A Breaker",                 unit: "EA", mat: 28.00,   lhr: 0.71, mk: "light", gc: false },
  { id: "pg14", category: "Panels & Gear", name: "3P 30A Breaker",                 unit: "EA", mat: 32.00,   lhr: 0.78, mk: "light", gc: false },
  { id: "pg15", category: "Panels & Gear", name: "3P 100A Breaker",                unit: "EA", mat: 85.00,   lhr: 1.28, mk: "light", gc: false },
  { id: "pg16", category: "Panels & Gear", name: "Fused Disco 3P 30A",             unit: "EA", mat: 285.13,  lhr: 2.20, mk: "light", gc: true  },
  { id: "pg17", category: "Panels & Gear", name: "200A Meter Main (Milbank)",       unit: "EA", mat: 399.99,  lhr: 3.25, mk: "light", gc: true  },
  { id: "pg18", category: "Panels & Gear", name: "Tandem 2x20A Breaker",           unit: "EA", mat: 16.80,   lhr: 0.52, mk: "light", gc: true  },
  { id: "pg19", category: "Panels & Gear", name: "Whole Home Surge Protection 50kA",unit: "EA",mat: 101.89,  lhr: 0.75, mk: "light", gc: true  },

  // ── DEVICES ──────────────────────────────────────────────────────────────
  { id: "d1",  category: "Devices", name: "20A Spec Grade Duplex Recept",  unit: "EA", mat: 2.04,   lhr: NECA.r20,  mk: "bulk", gc: true  },
  { id: "d2",  category: "Devices", name: "15A TR Duplex Receptacle",      unit: "EA", mat: 1.75,   lhr: NECA.r15,  mk: "bulk", gc: true  },
  { id: "d3",  category: "Devices", name: "20A GFCI Receptacle",           unit: "EA", mat: 16.50,  lhr: NECA.gf20, mk: "bulk", gc: false },
  { id: "d4",  category: "Devices", name: "15A TR GFCI Receptacle",        unit: "EA", mat: 18.57,  lhr: NECA.gf15, mk: "bulk", gc: true  },
  { id: "d4b", category: "Devices", name: "15A TR/WR GFCI Receptacle",     unit: "EA", mat: 22.15,  lhr: NECA.gf15, mk: "bulk", gc: true  },
  { id: "d5",  category: "Devices", name: "Single Pole Switch (spec)",      unit: "EA", mat: 6.97,   lhr: NECA.sw20, mk: "bulk", gc: true  },
  { id: "d6",  category: "Devices", name: "Single Pole Switch (trade)",     unit: "EA", mat: 0.9832, lhr: NECA.sw15, mk: "bulk", gc: true  },
  { id: "d7",  category: "Devices", name: "3-Way Switch",                   unit: "EA", mat: 1.8751, lhr: NECA.sw3,  mk: "bulk", gc: true  },
  { id: "d8",  category: "Devices", name: "4-Way Switch",                   unit: "EA", mat: 9.00,   lhr: NECA.sw4,  mk: "bulk", gc: false },
  { id: "d9",  category: "Devices", name: "Dimmer AYCL-153P",              unit: "EA", mat: 24.15,  lhr: NECA.dim,  mk: "bulk", gc: true  },
  { id: "d14", category: "Devices", name: "Lutron 0-10V Dimmer (DVSTV)",   unit: "EA", mat: 83.88,  lhr: 0.85,      mk: "bulk", gc: true  },
  { id: "d15", category: "Devices", name: "Occupancy Sensor Ceiling",       unit: "EA", mat: 42.00,  lhr: NECA.occ,  mk: "bulk", gc: false },
  { id: "d18", category: "Devices", name: "30A Dryer Receptacle 14-30R",   unit: "EA", mat: 8.57,   lhr: 0.40,      mk: "bulk", gc: true  },
  { id: "d19", category: "Devices", name: "50A WR EV Charger Outlet",       unit: "EA", mat: 55.89,  lhr: 0.50,      mk: "bulk", gc: true  },
  // Device plates
  { id: "dp1", category: "Devices", name: "1G Receptacle Plate",            unit: "EA", mat: 0.5412, lhr: NECA.cov1, mk: "bulk", gc: true  },
  { id: "dp2", category: "Devices", name: "1G Switch Plate",                unit: "EA", mat: 0.693,  lhr: NECA.cov1, mk: "bulk", gc: true  },
  { id: "dp3", category: "Devices", name: "2G Duplex Plate",                unit: "EA", mat: 1.174,  lhr: NECA.cov2, mk: "bulk", gc: true  },
  { id: "dp4", category: "Devices", name: "Blank Plate",                    unit: "EA", mat: 0.50,   lhr: NECA.cov1, mk: "bulk", gc: false },
  { id: "dp5", category: "Devices", name: "Low Profile WP In-Use Cover",    unit: "EA", mat: 17.16,  lhr: NECA.wp,   mk: "bulk", gc: true  },
  { id: "dp7", category: "Devices", name: "Cat6 Keystone Connector",        unit: "EA", mat: 7.62,   lhr: 0.30,      mk: "bulk", gc: true  },
  { id: "dp8", category: "Devices", name: "2-Port Keystone Plate",          unit: "EA", mat: 1.99,   lhr: 0.15,      mk: "bulk", gc: true  },
  { id: "dp9", category: "Devices", name: "1-Port Keystone Plate",          unit: "EA", mat: 1.25,   lhr: 0.10,      mk: "bulk", gc: false },
  { id: "dp10",category: "Devices", name: "4-Port Keystone Plate (2-gang)", unit: "EA", mat: 2.75,   lhr: 0.15,      mk: "bulk", gc: false },

  // ── LIGHTING ─────────────────────────────────────────────────────────────
  { id: "lc1",  category: "Lighting", name: "2x4 LED Lay-In T-Bar",         unit: "EA", mat: 48.00,  lhr: NECA.tb24,  mk: "light", gc: false },
  { id: "lc2",  category: "Lighting", name: "2x2 LED Lay-In T-Bar",         unit: "EA", mat: 38.00,  lhr: NECA.tb22,  mk: "light", gc: false },
  { id: "lc3",  category: "Lighting", name: "2x4 LED Surface Mount",        unit: "EA", mat: 55.00,  lhr: NECA.s24,   mk: "light", gc: false },
  { id: "lc4",  category: "Lighting", name: "2x4 LED Recessed Gyp Bd",      unit: "EA", mat: 85.00,  lhr: NECA.r24,   mk: "light", gc: false },
  { id: "lc5",  category: "Lighting", name: "4ft LED Strip Surface",        unit: "EA", mat: 64.11,  lhr: NECA.st48,  mk: "light", gc: true  },
  { id: "lc6",  category: "Lighting", name: "8ft LED Strip Surface",        unit: "EA", mat: 72.00,  lhr: NECA.st96,  mk: "light", gc: false },
  { id: "lc7",  category: "Lighting", name: '48" Chain Hung Industrial LED', unit: "EA", mat: 95.00,  lhr: NECA.ch48,  mk: "light", gc: false },
  { id: "lc8",  category: "Lighting", name: "High Bay LED 2x4",             unit: "EA", mat: 185.00, lhr: NECA.hb,    mk: "light", gc: false },
  { id: "lc9",  category: "Lighting", name: '4" LED Recessed Wafer',        unit: "EA", mat: 18.37,  lhr: NECA.dl,    mk: "light", gc: true  },
  { id: "lc10", category: "Lighting", name: "LED Wall Pack (RAB Brisk)",     unit: "EA", mat: 66.75,  lhr: NECA.wpFix, mk: "light", gc: true  },
  { id: "lc11", category: "Lighting", name: "Exit Sign Surface Mount",       unit: "EA", mat: 38.00,  lhr: NECA.ex,    mk: "light", gc: false },
  { id: "lc12", category: "Lighting", name: "Exit/EBU Combo (CCR)",         unit: "EA", mat: 79.92,  lhr: 1.00,       mk: "light", gc: true  },
  { id: "lc13", category: "Lighting", name: "Emergency Dual Head",          unit: "EA", mat: 55.00,  lhr: NECA.em,    mk: "light", gc: false },
  { id: "lc14", category: "Lighting", name: 'Ceiling Fan up to 36"',        unit: "EA", mat: 95.00,  lhr: NECA.f36,   mk: "light", gc: false },
  { id: "lc15", category: "Lighting", name: 'Ceiling Fan 37"-48"',          unit: "EA", mat: 145.00, lhr: NECA.f48,   mk: "light", gc: false },
  { id: "lc16", category: "Lighting", name: 'Wafer Rough-In Frame Kit 4"',  unit: "EA", mat: 5.29,   lhr: 0.25,       mk: "light", gc: true  },
  { id: "lc17", category: "Lighting", name: "Tek Screw to T-Bar",           unit: "EA", mat: 0.25,   lhr: 0.10,       mk: "bulk",  gc: false },

  // ── HEATING & HVAC ───────────────────────────────────────────────────────
  { id: "h1", category: "Heating & HVAC", name: 'Electric Baseboard 48"',      unit: "EA", mat: 72.00,  lhr: NECA.bb48, mk: "bulk", gc: false },
  { id: "h2", category: "Heating & HVAC", name: 'Electric Baseboard 96"',      unit: "EA", mat: 132.00, lhr: NECA.bb96, mk: "bulk", gc: false },
  { id: "h3", category: "Heating & HVAC", name: "Wall Heater 240V 3000W",      unit: "EA", mat: 145.00, lhr: NECA.wh3k, mk: "bulk", gc: false },
  { id: "h4", category: "Heating & HVAC", name: "Unit Heater w/ Blower 5KW",   unit: "EA", mat: 385.00, lhr: NECA.uh5,  mk: "bulk", gc: false },
  { id: "h5", category: "Heating & HVAC", name: "Low Voltage Thermostat",       unit: "EA", mat: 45.00,  lhr: NECA.tsLV, mk: "bulk", gc: false },
  { id: "h6", category: "Heating & HVAC", name: "Line Voltage Thermostat",      unit: "EA", mat: 55.00,  lhr: NECA.tsLN, mk: "bulk", gc: false },
  { id: "h7", category: "Heating & HVAC", name: "Power Connection 20A (per end)",unit: "EA",mat: 0,      lhr: NECA.p20,  mk: "bulk", gc: false },
  { id: "h8", category: "Heating & HVAC", name: "Power Connection 60A (per end)",unit: "EA",mat: 0,      lhr: NECA.p60,  mk: "bulk", gc: false },
  { id: "h9", category: "Heating & HVAC", name: "Power Connection 100A (per end)",unit:"EA",mat: 0,      lhr: NECA.p100, mk: "bulk", gc: false },

  // ── TEMP POWER ───────────────────────────────────────────────────────────
  { id: "t1", category: "Temp Power", name: "Temp Svc Pole 1P 200A",      unit: "EA", mat: 650.00, lhr: NECA.s1p200, mk: "bulk", gc: false },
  { id: "t2", category: "Temp Power", name: "Temp Svc Pole 3P 200A",      unit: "EA", mat: 850.00, lhr: NECA.s3p200, mk: "bulk", gc: false },
  { id: "t3", category: "Temp Power", name: "Portable Lighting Panel 100A",unit: "EA", mat: 485.00, lhr: NECA.pan100, mk: "bulk", gc: false },
  { id: "t4", category: "Temp Power", name: "Extension Cord 100ft 20A",   unit: "EA", mat: 28.00,  lhr: NECA.ext20,  mk: "bulk", gc: false },
  { id: "t5", category: "Temp Power", name: "Prefab Light String 100ft",  unit: "EA", mat: 75.00,  lhr: NECA.str100, mk: "bulk", gc: false },
  { id: "t6", category: "Temp Power", name: "Portable Generator 5KW",     unit: "EA", mat: 950.00, lhr: NECA.gen5,   mk: "bulk", gc: false },

  // ── MISC HARDWARE ────────────────────────────────────────────────────────
  { id: "pvc_glue", category: "Misc Hardware", name: "PVC Cement 32oz Can",        unit: "EA", mat: 28.00, lhr: 0.05, mk: "bulk", gc: true  },
  { id: "m1",       category: "Misc Hardware", name: "Fire Stop Sealant 10oz",     unit: "EA", mat: 17.97, lhr: 0,    mk: "bulk", gc: true  },
  { id: "m2",       category: "Misc Hardware", name: 'NM Staple 1/2"',             unit: "EA", mat: 0.0521,lhr: 0.02, mk: "bulk", gc: true  },
  { id: "m3",       category: "Misc Hardware", name: "Duct Seal 1lb",              unit: "EA", mat: 4.9994,lhr: 0.05, mk: "bulk", gc: true  },
  { id: "m4",       category: "Misc Hardware", name: "Black Electrical Tape",      unit: "EA", mat: 1.46,  lhr: 0,    mk: "bulk", gc: true  },
  { id: "m5",       category: "Misc Hardware", name: 'Drywall Screw 6x1-5/8"',    unit: "EA", mat: 0.0667,lhr: 0.01, mk: "bulk", gc: true  },

  // ── UNDERGROUND ──────────────────────────────────────────────────────────
  { id: "ug1",  category: "Underground", name: '3/4" Sch40 PVC in Trench per ft',  unit: "FT", mat: 0.3884, lhr: NECA.p34,  mk: "bulk", gc: true  },
  { id: "ug2",  category: "Underground", name: '1" Sch40 PVC in Trench per ft',    unit: "FT", mat: 0.5542, lhr: NECA.p1,   mk: "bulk", gc: true  },
  { id: "ug3",  category: "Underground", name: '2" Sch40 PVC in Trench per ft',    unit: "FT", mat: 0.9299, lhr: NECA.p2,   mk: "bulk", gc: true  },
  { id: "ug4",  category: "Underground", name: '4" Sch40 PVC in Trench per ft',    unit: "FT", mat: 2.20,   lhr: NECA.p4,   mk: "bulk", gc: false },
  { id: "ug5",  category: "Underground", name: '2" PVC EB/DB in Trench per ft',    unit: "FT", mat: 0.65,   lhr: NECA.eb2,  mk: "bulk", gc: false },
  { id: "ug6",  category: "Underground", name: '3" PVC EB/DB in Trench per ft',    unit: "FT", mat: 1.10,   lhr: NECA.eb3,  mk: "bulk", gc: false },
  { id: "ug7",  category: "Underground", name: '3/4" PVC 90 Elbow (buried)',       unit: "EA", mat: 1.2495, lhr: NECA.e34,  mk: "bulk", gc: true  },
  { id: "ug8",  category: "Underground", name: '2" PVC 90 Elbow (buried)',         unit: "EA", mat: 3.3999, lhr: NECA.e2ug, mk: "bulk", gc: true  },
  { id: "ug9",  category: "Underground", name: "600V DB Cu 1/C #12-#8 per ft",    unit: "FT", mat: 0.32,   lhr: NECA.db128,mk: "bulk", gc: false },
  { id: "ug10", category: "Underground", name: "600V DB Cu 1/C #6-#3 per ft",     unit: "FT", mat: 0.55,   lhr: NECA.db63, mk: "bulk", gc: false },
  { id: "ug11", category: "Underground", name: "600V Cu pulled-in 1/C #12-#8 per ft",unit:"FT",mat: 0.12,  lhr: NECA.pu128,mk: "bulk", gc: false },
  { id: "ug12", category: "Underground", name: "600V Cu pulled-in 1/C #6-#3 per ft", unit:"FT",mat: 0.18,  lhr: NECA.pu63, mk: "bulk", gc: false },
  { id: "ug13", category: "Underground", name: "Hand Excavation Sandy per ft",     unit: "FT", mat: 0,      lhr: NECA.xs,   mk: "bulk", gc: false },
  { id: "ug14", category: "Underground", name: "Hand Excavation Clay per ft",      unit: "FT", mat: 0,      lhr: NECA.xc,   mk: "bulk", gc: false },
  { id: "ug15", category: "Underground", name: "Backfill & Compaction per ft",     unit: "FT", mat: 0,      lhr: NECA.bf,   mk: "bulk", gc: false },

  // ── LOW VOLTAGE ──────────────────────────────────────────────────────────
  { id: "lv1",  category: "Low Voltage", name: "TSGB16 Strut Bracket",               unit: "EA",  mat: 4.50,   lhr: 0.10, mk: "bulk", gc: false },
  { id: "lv2",  category: "Low Voltage", name: "J-Hook Small (4in)",                 unit: "EA",  mat: 4.00,   lhr: 0.05, mk: "bulk", gc: false },
  { id: "lv3",  category: "Low Voltage", name: "J-Hook Large (7in)",                 unit: "EA",  mat: 7.00,   lhr: 0.05, mk: "bulk", gc: false },
  { id: "lv4",  category: "Low Voltage", name: "Zip Tie",                            unit: "EA",  mat: 0.05,   lhr: 0.02, mk: "bulk", gc: false },
  { id: "pp1",  category: "Low Voltage", name: "Patch Panel Small (12-24 port)",     unit: "EA",  mat: 125.00, lhr: 0.50, mk: "bulk", gc: false },
  { id: "pp2",  category: "Low Voltage", name: "Patch Panel Medium (48 port)",       unit: "EA",  mat: 250.00, lhr: 0.75, mk: "bulk", gc: false },
  { id: "pp3",  category: "Low Voltage", name: "Patch Panel Large (96 port)",        unit: "EA",  mat: 450.00, lhr: 1.00, mk: "bulk", gc: false },
  { id: "lvc1", category: "Low Voltage", name: "LV Cable per ft (Cat6/Coax/2-wire)", unit: "FT",  mat: 0.375,  lhr: 0.010,mk: "bulk", gc: false },
  { id: "lvc2", category: "Low Voltage", name: "LV Mud Ring / Bracket",              unit: "EA",  mat: 1.50,   lhr: 0.10, mk: "bulk", gc: false },
  { id: "lvc3", category: "Low Voltage", name: "LV Staple",                          unit: "EA",  mat: 0.044,  lhr: 0.02, mk: "bulk", gc: false },

  // ── FIRE ALARM CABLE ─────────────────────────────────────────────────────
  { id: "fa1", category: "Fire Alarm", name: "FPLR 16/2 SLC NM (wood) per ft",  unit: "FT", mat: 0.30, lhr: 0.008, mk: "bulk", gc: false },
  { id: "fa2", category: "Fire Alarm", name: "14/2 FPLR NAC NM (wood) per ft",  unit: "FT", mat: 0.48, lhr: 0.010, mk: "bulk", gc: false },
  { id: "fa3", category: "Fire Alarm", name: "16/2 SLC MC (metal) per ft",       unit: "FT", mat: 1.25, lhr: 0.026, mk: "bulk", gc: false },
  { id: "fa4", category: "Fire Alarm", name: "14/2 NAC MC (metal) per ft",       unit: "FT", mat: 1.10, lhr: 0.026, mk: "bulk", gc: false },
  { id: "fa5", category: "Fire Alarm", name: "14/4 Annunciator NM per ft",       unit: "FT", mat: 0.96, lhr: 0.010, mk: "bulk", gc: false },
  { id: "fa6", category: "Fire Alarm", name: "14/4 Annunciator MC per ft",       unit: "FT", mat: 2.20, lhr: 0.026, mk: "bulk", gc: false },
  // Fire Alarm Devices (Fire Lite)
  { id: "fad1",  category: "Fire Alarm", name: "FL Pull Station",                  unit: "EA", mat: 55.00,   lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad2",  category: "Fire Alarm", name: "FL Smoke Detector",                unit: "EA", mat: 100.00,  lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad3",  category: "Fire Alarm", name: "FL Heat Detector",                 unit: "EA", mat: 100.00,  lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad4",  category: "Fire Alarm", name: "FL Smoke/CO Combo",                unit: "EA", mat: 175.00,  lhr: 0.45, mk: "bulk", gc: false },
  { id: "fad5",  category: "Fire Alarm", name: "FL Horn/Strobe",                   unit: "EA", mat: 100.00,  lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad6",  category: "Fire Alarm", name: "FL Strobe",                        unit: "EA", mat: 100.00,  lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad7",  category: "Fire Alarm", name: "FL LF Sounder",                    unit: "EA", mat: 100.00,  lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad8",  category: "Fire Alarm", name: "FL Beacon",                        unit: "EA", mat: 75.00,   lhr: 0.35, mk: "bulk", gc: false },
  { id: "fad9",  category: "Fire Alarm", name: "FL Control/Monitor Module",        unit: "EA", mat: 160.00,  lhr: 0.45, mk: "bulk", gc: false },
  { id: "fad10", category: "Fire Alarm", name: "FL Duct Smoke Detector",           unit: "EA", mat: 250.00,  lhr: 0.65, mk: "bulk", gc: false },
  { id: "fad11", category: "Fire Alarm", name: "FL Annunciator",                   unit: "EA", mat: 225.00,  lhr: 1.00, mk: "bulk", gc: false },
  { id: "fad12", category: "Fire Alarm", name: "FL Control Panel Small (4 ch)",    unit: "EA", mat: 650.00,  lhr: 3.00, mk: "bulk", gc: false },
  { id: "fad13", category: "Fire Alarm", name: "FL Control Panel Medium (6 ch)",   unit: "EA", mat: 650.00,  lhr: 4.50, mk: "bulk", gc: false },
  { id: "fad14", category: "Fire Alarm", name: "FL Control Panel Large (10 ch)",   unit: "EA", mat: 1300.00, lhr: 7.50, mk: "bulk", gc: false },
  { id: "fad15", category: "Fire Alarm", name: "FL Radio Box",                     unit: "EA", mat: 500.00,  lhr: 1.00, mk: "bulk", gc: false },
];

export const BOM_CATEGORIES = [...new Set(BOM.map(i => i.category))];

export function getBomItem(id: string): BomItem | undefined {
  return BOM.find(i => i.id === id);
}
