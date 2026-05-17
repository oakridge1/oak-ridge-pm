export type MarkupType = "bulk" | "light";

export type BomItem = {
  id: string;
  category: string;
  name: string;
  unit: string;
  mat: number;     // material cost per unit (GCE pricing)
  lhr: number;     // NECA 2015-16 labor hours per unit
  mk: MarkupType;  // markup type
  gc: boolean;     // GCE stocks it
};

// NECA 2015-16 labor rate constants
export const NECA = {
  // N6 Devices
  r15: 0.25, r20: 0.30, gf15: 0.30, gf20: 0.35,
  sw15: 0.20, sw20: 0.25, sw3: 0.40, sw4: 0.45,
  dim: 0.40, cov1: 0.10, cov2: 0.12, wp: 0.20, occ: 0.50,
  // N5 Fixtures
  tb22: 0.60, tb24: 0.75, s24: 0.80, r24: 1.10,
  st48: 0.75, st96: 1.15, ch48: 0.85, hb: 1.75,
  wpFix: 1.25, dl: 1.25, ex: 1.00, em: 1.20,
  f36: 1.50, f48: 2.50,
  // N8 Grounding
  rod: 1.60, b34: 0.20, b1: 0.22, b114: 0.24,
  b112: 0.26, b2: 0.28, cu4: 0.016,
  // N9 Panels small
  bb48: 0.90, bb96: 1.25, wh3k: 2.20, uh5: 3.00,
  tsLV: 0.50, tsLN: 0.60, p20: 0.25, p60: 0.33,
  p100: 0.45, p200: 0.68,
  // N10 Panels large
  s1p200: 12.0, s3p200: 14.0, pan100: 4.70,
  ext20: 0.25, str100: 2.00, gen5: 2.00,
  // N11 Conduit (per foot)
  p34: 0.035, p1: 0.0375, p112: 0.0425,
  p2: 0.045, p3: 0.050, p4: 0.055,
  e34: 0.22, e2: 0.50,
  eb2: 0.04, eb3: 0.0425,
  db128: 0.018, db63: 0.020,
  pu128: 0.040, pu63: 0.042,
  xs: 0.04, xc: 0.10, bf: 0.08,
  // Wire (per foot)
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
} as const;

export const BOM: BomItem[] = [
  // ── DEVICES ──────────────────────────────────────────────────────
  { id: "r15", category: "Devices", name: "Duplex Receptacle 15A", unit: "EA", mat: 1.85, lhr: NECA.r15, mk: "bulk", gc: true },
  { id: "r20", category: "Devices", name: "Duplex Receptacle 20A", unit: "EA", mat: 3.10, lhr: NECA.r20, mk: "bulk", gc: true },
  { id: "gfci15", category: "Devices", name: "GFCI Receptacle 15A", unit: "EA", mat: 11.50, lhr: NECA.gf15, mk: "bulk", gc: true },
  { id: "gfci20", category: "Devices", name: "GFCI Receptacle 20A", unit: "EA", mat: 13.75, lhr: NECA.gf20, mk: "bulk", gc: true },
  { id: "sw15", category: "Devices", name: "Single Pole Switch 15A", unit: "EA", mat: 1.65, lhr: NECA.sw15, mk: "bulk", gc: true },
  { id: "sw20", category: "Devices", name: "Single Pole Switch 20A", unit: "EA", mat: 3.20, lhr: NECA.sw20, mk: "bulk", gc: true },
  { id: "sw3w", category: "Devices", name: "3-Way Switch", unit: "EA", mat: 4.50, lhr: NECA.sw3, mk: "bulk", gc: true },
  { id: "sw4w", category: "Devices", name: "4-Way Switch", unit: "EA", mat: 9.75, lhr: NECA.sw4, mk: "bulk", gc: true },
  { id: "dim", category: "Devices", name: "Dimmer Switch", unit: "EA", mat: 18.50, lhr: NECA.dim, mk: "bulk", gc: true },
  { id: "wpdev", category: "Devices", name: "WP In-Use Cover", unit: "EA", mat: 4.25, lhr: NECA.wp, mk: "bulk", gc: true },
  { id: "occ", category: "Devices", name: "Occupancy Sensor", unit: "EA", mat: 28.00, lhr: NECA.occ, mk: "bulk", gc: false },
  { id: "cov1", category: "Devices", name: "Single Gang Cover Plate", unit: "EA", mat: 0.65, lhr: NECA.cov1, mk: "bulk", gc: true },
  { id: "cov2", category: "Devices", name: "Double Gang Cover Plate", unit: "EA", mat: 0.95, lhr: NECA.cov2, mk: "bulk", gc: true },
  // ── FIXTURES ──────────────────────────────────────────────────────
  { id: "tb22", category: "Fixtures", name: "2x2 LED Troffer", unit: "EA", mat: 68.00, lhr: NECA.tb22, mk: "light", gc: false },
  { id: "tb24", category: "Fixtures", name: "2x4 LED Troffer", unit: "EA", mat: 82.00, lhr: NECA.tb24, mk: "light", gc: false },
  { id: "s24", category: "Fixtures", name: "LED Strip Light 4ft", unit: "EA", mat: 45.00, lhr: NECA.s24, mk: "light", gc: false },
  { id: "r24", category: "Fixtures", name: "LED Round High Bay", unit: "EA", mat: 125.00, lhr: NECA.r24, mk: "light", gc: false },
  { id: "st48", category: "Fixtures", name: "LED Storeroom 4ft", unit: "EA", mat: 55.00, lhr: NECA.st48, mk: "light", gc: false },
  { id: "st96", category: "Fixtures", name: "LED Storeroom 8ft", unit: "EA", mat: 88.00, lhr: NECA.st96, mk: "light", gc: false },
  { id: "ch48", category: "Fixtures", name: "LED Chain Mount 4ft", unit: "EA", mat: 72.00, lhr: NECA.ch48, mk: "light", gc: false },
  { id: "hb", category: "Fixtures", name: "LED High Bay", unit: "EA", mat: 185.00, lhr: NECA.hb, mk: "light", gc: false },
  { id: "wpfix", category: "Fixtures", name: "WP Fixture", unit: "EA", mat: 95.00, lhr: NECA.wpFix, mk: "light", gc: false },
  { id: "dl", category: "Fixtures", name: "LED Downlight 6\"", unit: "EA", mat: 38.00, lhr: NECA.dl, mk: "light", gc: false },
  { id: "ex", category: "Fixtures", name: "Exit Sign", unit: "EA", mat: 42.00, lhr: NECA.ex, mk: "light", gc: false },
  { id: "em", category: "Fixtures", name: "Emergency Light", unit: "EA", mat: 55.00, lhr: NECA.em, mk: "light", gc: false },
  // ── GROUNDING ────────────────────────────────────────────────────
  { id: "grd", category: "Grounding", name: "Ground Rod 5/8\"x8ft", unit: "EA", mat: 14.50, lhr: NECA.rod, mk: "bulk", gc: true },
  { id: "gb34", category: "Grounding", name: "Ground Bar 3/4\"", unit: "EA", mat: 12.00, lhr: NECA.b34, mk: "bulk", gc: true },
  { id: "gb1", category: "Grounding", name: "Ground Bar 1\"", unit: "EA", mat: 18.00, lhr: NECA.b1, mk: "bulk", gc: true },
  { id: "gcu", category: "Grounding", name: "Ground Wire #4 Cu", unit: "FT", mat: 0.65, lhr: NECA.cu4, mk: "bulk", gc: true },
  // ── PANELS & BREAKERS ────────────────────────────────────────────
  { id: "bb48", category: "Panels", name: "Load Center 48-ckt", unit: "EA", mat: 185.00, lhr: NECA.bb48, mk: "bulk", gc: false },
  { id: "bb96", category: "Panels", name: "Load Center 96-ckt", unit: "EA", mat: 320.00, lhr: NECA.bb96, mk: "bulk", gc: false },
  { id: "p20", category: "Panels", name: "Breaker 1P 20A", unit: "EA", mat: 8.50, lhr: NECA.p20, mk: "bulk", gc: true },
  { id: "p30", category: "Panels", name: "Breaker 1P 30A", unit: "EA", mat: 10.25, lhr: NECA.p20, mk: "bulk", gc: true },
  { id: "p60", category: "Panels", name: "Breaker 2P 60A", unit: "EA", mat: 18.50, lhr: NECA.p60, mk: "bulk", gc: true },
  { id: "p100", category: "Panels", name: "Breaker 2P 100A", unit: "EA", mat: 42.00, lhr: NECA.p100, mk: "bulk", gc: true },
  { id: "p200", category: "Panels", name: "Breaker 2P 200A", unit: "EA", mat: 88.00, lhr: NECA.p200, mk: "bulk", gc: true },
  { id: "afci20", category: "Panels", name: "AFCI Breaker 1P 20A", unit: "EA", mat: 38.00, lhr: NECA.p20, mk: "bulk", gc: true },
  { id: "gfcibrk", category: "Panels", name: "GFCI Breaker 1P 20A", unit: "EA", mat: 32.00, lhr: NECA.p20, mk: "bulk", gc: true },
  // ── BOXES ────────────────────────────────────────────────────────
  { id: "sg", category: "Boxes", name: "Single Gang Box", unit: "EA", mat: 0.95, lhr: 0.15, mk: "bulk", gc: true },
  { id: "dg", category: "Boxes", name: "Double Gang Box", unit: "EA", mat: 1.45, lhr: 0.18, mk: "bulk", gc: true },
  { id: "4sq", category: "Boxes", name: "4\" Square Box", unit: "EA", mat: 1.85, lhr: 0.20, mk: "bulk", gc: true },
  { id: "4oct", category: "Boxes", name: "4\" Octagon Box", unit: "EA", mat: 1.65, lhr: 0.18, mk: "bulk", gc: true },
  { id: "jbox", category: "Boxes", name: "Junction Box 6x6x4", unit: "EA", mat: 12.50, lhr: 0.35, mk: "bulk", gc: false },
  // ── EMT CONDUIT (per foot) ───────────────────────────────────────
  { id: "emt34", category: "Conduit", name: "3/4\" EMT", unit: "FT", mat: 0.42, lhr: NECA.p34, mk: "bulk", gc: true },
  { id: "emt1", category: "Conduit", name: "1\" EMT", unit: "FT", mat: 0.68, lhr: NECA.p1, mk: "bulk", gc: true },
  { id: "emt112", category: "Conduit", name: "1-1/2\" EMT", unit: "FT", mat: 1.12, lhr: NECA.p112, mk: "bulk", gc: true },
  { id: "emt2", category: "Conduit", name: "2\" EMT", unit: "FT", mat: 1.65, lhr: NECA.p2, mk: "bulk", gc: true },
  { id: "emt3", category: "Conduit", name: "3\" EMT", unit: "FT", mat: 3.20, lhr: NECA.p3, mk: "bulk", gc: false },
  { id: "emt4", category: "Conduit", name: "4\" EMT", unit: "FT", mat: 4.85, lhr: NECA.p4, mk: "bulk", gc: false },
  // ── EMT FITTINGS ─────────────────────────────────────────────────
  { id: "conn34", category: "Fittings", name: "3/4\" EMT Connector SS", unit: "EA", mat: 0.55, lhr: 0.05, mk: "bulk", gc: true },
  { id: "conn1", category: "Fittings", name: "1\" EMT Connector SS", unit: "EA", mat: 0.85, lhr: 0.06, mk: "bulk", gc: true },
  { id: "conn2", category: "Fittings", name: "2\" EMT Connector SS", unit: "EA", mat: 2.20, lhr: 0.08, mk: "bulk", gc: true },
  { id: "coup34", category: "Fittings", name: "3/4\" EMT Coupling", unit: "EA", mat: 0.42, lhr: 0.04, mk: "bulk", gc: true },
  { id: "coup1", category: "Fittings", name: "1\" EMT Coupling", unit: "EA", mat: 0.68, lhr: 0.05, mk: "bulk", gc: true },
  { id: "coup2", category: "Fittings", name: "2\" EMT Coupling", unit: "EA", mat: 1.85, lhr: 0.06, mk: "bulk", gc: true },
  // ── WIRE (per foot) ──────────────────────────────────────────────
  { id: "w12blk", category: "Wire", name: "#12 THHN Black", unit: "FT", mat: 0.065, lhr: NECA.LT12 / 1000, mk: "bulk", gc: true },
  { id: "w12wht", category: "Wire", name: "#12 THHN White", unit: "FT", mat: 0.065, lhr: NECA.LT12 / 1000, mk: "bulk", gc: true },
  { id: "w12grn", category: "Wire", name: "#12 THHN Green", unit: "FT", mat: 0.065, lhr: NECA.LT12 / 1000, mk: "bulk", gc: true },
  { id: "w10blk", category: "Wire", name: "#10 THHN Black", unit: "FT", mat: 0.098, lhr: NECA.LT34 / 1000, mk: "bulk", gc: true },
  { id: "w10wht", category: "Wire", name: "#10 THHN White", unit: "FT", mat: 0.098, lhr: NECA.LT34 / 1000, mk: "bulk", gc: true },
  { id: "w8blk", category: "Wire", name: "#8 THHN Black", unit: "FT", mat: 0.165, lhr: NECA.LT1 / 1000, mk: "bulk", gc: true },
  { id: "w6blk", category: "Wire", name: "#6 THHN Black", unit: "FT", mat: 0.245, lhr: NECA.LT1 / 1000, mk: "bulk", gc: true },
  { id: "mc122", category: "Wire", name: "12/2 MC Cable", unit: "FT", mat: 0.88, lhr: NECA.WNOB, mk: "bulk", gc: true },
  { id: "mc123", category: "Wire", name: "12/3 MC Cable", unit: "FT", mat: 1.12, lhr: NECA.WNRD, mk: "bulk", gc: true },
  { id: "mc102", category: "Wire", name: "10/2 MC Cable", unit: "FT", mat: 1.45, lhr: NECA.WNRD, mk: "bulk", gc: true },
  { id: "rom122", category: "Wire", name: "12/2 Romex NM-B", unit: "FT", mat: 0.52, lhr: NECA.WNOB, mk: "bulk", gc: true },
  { id: "rom142", category: "Wire", name: "14/2 Romex NM-B", unit: "FT", mat: 0.38, lhr: NECA.WNOB, mk: "bulk", gc: true },
  // ── WIRE CONNECTORS ──────────────────────────────────────────────
  { id: "wnut", category: "Wire Connectors", name: "Wire Nuts (bag)", unit: "BAG", mat: 3.50, lhr: 0.0, mk: "bulk", gc: true },
  { id: "mcconn34", category: "Wire Connectors", name: "3/4\" MC Connector", unit: "EA", mat: 1.15, lhr: 0.07, mk: "bulk", gc: true },
  { id: "mcconn12", category: "Wire Connectors", name: "1/2\" MC Connector", unit: "EA", mat: 0.85, lhr: 0.06, mk: "bulk", gc: true },
];

export const BOM_CATEGORIES = [...new Set(BOM.map(i => i.category))].sort();

export function getBomItem(id: string): BomItem | undefined {
  return BOM.find(i => i.id === id);
}
