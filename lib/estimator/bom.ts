// ── lib/estimator/bom.ts ──────────────────────────────────────────────────────
// Phase 2 — Bill of Materials
// Pure data layer. No UI, no API calls.

import { N5, N6, type MarkupType } from './constants';

// ── Local price constants ──────────────────────────────────────────────────
const LT12 = 1.45;
const LT34 = 2.18;
const LT1  = 3.55;
const WNOB = 0.087;
const WNRD = 0.144;
const WNGN = 0.220;
const GNSC = 0.138;

const N8  = { rod: 1.60, b34: 0.20, b1: 0.22, cu4: 0.013 };
const N9  = { bb48: 0.90, bb96: 1.25, wh3k: 2.20, uh5: 3.00, tsLV: 0.50, tsLN: 0.60, p20: 0.25, p60: 0.33, p100: 0.45 };
const N10 = { s1p200: 12.0, s3p200: 14.0, pan100: 4.70, ext20: 0.25, str100: 2.00, gen5: 2.00 };
const N11 = { p34: 0.040, p1: 0.0425, p2: 0.0450, p4: 0.0550, eb2: 0.040, eb3: 0.0425, e34: 0.22, e2: 0.50, db128: 0.018, db63: 0.020, pu128: 0.040, pu63: 0.042, xs: 0.50, xc: 0.80, bf: 0.30 };

// ─────────────────────────────────────
// BomItem interface
// ─────────────────────────────────────

export interface BomItem {
  id:   string;
  cat:  string;
  name: string;
  unit: 'EA' | 'FT';
  mat:  number;      // base material cost per unit (pre-markup)
  lhr:  number;      // labor hours per unit
  mk:   MarkupType;
  gc?:  boolean;     // true = general conditions item
}

// ─────────────────────────────────────
// BOM array
// ─────────────────────────────────────

export const BOM: BomItem[] = [
  // ── BOXES ────────────────────────────────────────────────────────────────
  { id:'b1',   cat:'Boxes',            name:'4" Square Deep Box',                unit:'EA', mat:2.50,      lhr:0.30,                mk:'bulk', gc:true  },
  { id:'b2',   cat:'Boxes',            name:'4" Square Shallow Box',             unit:'EA', mat:1.85,      lhr:0.25,                mk:'bulk'           },
  { id:'b3',   cat:'Boxes',            name:'Old Work Box (plastic)',            unit:'EA', mat:1.20,      lhr:0.35,                mk:'bulk'           },
  { id:'b4',   cat:'Boxes',            name:'Weatherproof Box (metal)',          unit:'EA', mat:4.50,      lhr:0.35,                mk:'bulk'           },
  { id:'b5',   cat:'Boxes',            name:'Gangable Plastic Box',             unit:'EA', mat:0.85,      lhr:0.25,                mk:'bulk'           },
  { id:'b6',   cat:'Boxes',            name:'Metal Handy Box',                  unit:'EA', mat:1.95,      lhr:0.25,                mk:'bulk'           },
  { id:'b7',   cat:'Boxes',            name:'Nail-On Box (plastic)',            unit:'EA', mat:0.50,      lhr:0.20,                mk:'bulk'           },
  { id:'b2g',  cat:'Boxes',            name:'2-Gang Metal Box',                 unit:'EA', mat:3.50,      lhr:0.35,                mk:'bulk'           },
  { id:'b3g',  cat:'Boxes',            name:'3-Gang Metal Box',                 unit:'EA', mat:5.20,      lhr:0.45,                mk:'bulk'           },
  { id:'bjbox',cat:'Boxes',            name:'4" Square Deep w/Cover (J-Box)',   unit:'EA', mat:8.50,      lhr:0.40,                mk:'bulk'           },

  // ── MUD RINGS & BOX SUPPORTS ─────────────────────────────────────────────
  { id:'mr1',  cat:'Mud Rings',        name:'SG 3/4" Mud Ring',                 unit:'EA', mat:1.2663,    lhr:0.15,                mk:'bulk', gc:true  },
  { id:'mr2',  cat:'Mud Rings',        name:'2G 3/4" Mud Ring',                 unit:'EA', mat:2.2132,    lhr:0.15,                mk:'bulk', gc:true  },
  { id:'bs1',  cat:'Box Supports',     name:'C23 Metal Stud Bracket',           unit:'EA', mat:2.7981,    lhr:0.10,                mk:'bulk', gc:true  },
  { id:'bs2',  cat:'Box Supports',     name:'CJ6 Colorado Jim',                 unit:'EA', mat:0.6631,    lhr:0.03,                mk:'bulk', gc:true  },
  { id:'bs3',  cat:'Box Supports',     name:'Madison Bar',                      unit:'EA', mat:0.6557,    lhr:0.20,                mk:'bulk', gc:true  },

  // ── EMT CONDUIT ───────────────────────────────────────────────────────────
  { id:'e1',   cat:'EMT Conduit',      name:'1/2" EMT 10ft',                    unit:'EA', mat:4.555,     lhr:0.230,               mk:'bulk', gc:true  },
  { id:'e2',   cat:'EMT Conduit',      name:'3/4" EMT 10ft',                    unit:'EA', mat:8.029,     lhr:0.280,               mk:'bulk', gc:true  },
  { id:'e3',   cat:'EMT Conduit',      name:'1" EMT 10ft',                      unit:'EA', mat:8.40,      lhr:0.330,               mk:'bulk'           },
  { id:'e4',   cat:'EMT Conduit',      name:'1-1/4" EMT 10ft',                  unit:'EA', mat:11.20,     lhr:0.380,               mk:'bulk'           },
  { id:'e5',   cat:'EMT Conduit',      name:'1-1/2" EMT 10ft',                  unit:'EA', mat:13.50,     lhr:0.430,               mk:'bulk'           },
  { id:'e6',   cat:'EMT Conduit',      name:'2" EMT 10ft',                      unit:'EA', mat:18.40,     lhr:0.500,               mk:'bulk'           },
  { id:'e7',   cat:'EMT Conduit',      name:'3" EMT 10ft',                      unit:'EA', mat:38.00,     lhr:0.650,               mk:'bulk'           },
  { id:'e8',   cat:'EMT Conduit',      name:'2-1/2" EMT 10ft',                  unit:'EA', mat:28.00,     lhr:0.580,               mk:'bulk'           },
  { id:'e9',   cat:'EMT Conduit',      name:'3-1/2" EMT 10ft',                  unit:'EA', mat:48.00,     lhr:0.720,               mk:'bulk'           },
  { id:'e10',  cat:'EMT Conduit',      name:'4" EMT 10ft',                      unit:'EA', mat:58.00,     lhr:0.800,               mk:'bulk'           },

  // ── EMT FITTINGS ──────────────────────────────────────────────────────────
  { id:'ef1',  cat:'EMT Fittings',     name:'1/2" Set Screw Connector',         unit:'EA', mat:0.4047,    lhr:0.08,                mk:'bulk', gc:true  },
  { id:'ef2',  cat:'EMT Fittings',     name:'3/4" Set Screw Connector',         unit:'EA', mat:0.3232,    lhr:0.10,                mk:'bulk', gc:true  },
  { id:'ef3',  cat:'EMT Fittings',     name:'1" Set Screw Connector',           unit:'EA', mat:1.10,      lhr:0.12,                mk:'bulk'           },
  { id:'ef4',  cat:'EMT Fittings',     name:'1/2" Set Screw Coupling',          unit:'EA', mat:0.32,      lhr:0.04,                mk:'bulk'           },
  { id:'ef5',  cat:'EMT Fittings',     name:'3/4" Set Screw Coupling',          unit:'EA', mat:0.3463,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'ef6',  cat:'EMT Fittings',     name:'1/2" Compression Connector',       unit:'EA', mat:0.9702,    lhr:0.25,                mk:'bulk', gc:true  },
  { id:'ef7',  cat:'EMT Fittings',     name:'3/4" Compression Connector',       unit:'EA', mat:1.2239,    lhr:0.30,                mk:'bulk', gc:true  },
  { id:'ef8',  cat:'EMT Fittings',     name:'1/2" Factory Elbow',               unit:'EA', mat:2.10,      lhr:0.20,                mk:'bulk'           },
  { id:'ef9',  cat:'EMT Fittings',     name:'3/4" Factory Elbow',               unit:'EA', mat:2.85,      lhr:0.22,                mk:'bulk'           },
  { id:'ef10b',cat:'EMT Fittings',     name:'1-1/4" Set Screw Connector',       unit:'EA', mat:2.02,      lhr:0.14,                mk:'bulk', gc:true  },
  { id:'ef11', cat:'EMT Fittings',     name:'1-1/2" Set Screw Connector',       unit:'EA', mat:0.23,      lhr:0.16,                mk:'bulk', gc:true  },
  { id:'ef12', cat:'EMT Fittings',     name:'2" Set Screw Connector',           unit:'EA', mat:3.20,      lhr:0.18,                mk:'bulk'           },
  { id:'ef13', cat:'EMT Fittings',     name:'1-1/4" Set Screw Coupling',        unit:'EA', mat:2.02,      lhr:0.06,                mk:'bulk', gc:true  },
  { id:'ef14', cat:'EMT Fittings',     name:'1-1/2" Set Screw Coupling',        unit:'EA', mat:0.23,      lhr:0.07,                mk:'bulk', gc:true  },
  { id:'ef15', cat:'EMT Fittings',     name:'2" Set Screw Coupling',            unit:'EA', mat:4.00,      lhr:0.08,                mk:'bulk', gc:true  },

  // ── MC FITTINGS ───────────────────────────────────────────────────────────
  { id:'mc1',  cat:'MC Fittings',      name:'Duplex Snap-In 3/8" MC Connector', unit:'EA', mat:3.4211,    lhr:0.12,                mk:'bulk', gc:true  },
  { id:'mc2',  cat:'MC Fittings',      name:'Single Snap-In 1/2" MC Connector', unit:'EA', mat:1.4182,    lhr:0.12,                mk:'bulk', gc:true  },
  { id:'mc4',  cat:'MC Fittings',      name:'3/8" MC Strap 1-Hole',             unit:'EA', mat:0.2032,    lhr:0.03,                mk:'bulk', gc:true  },
  { id:'mc5',  cat:'MC Fittings',      name:'3/4" 1-Hole EMT Strap',            unit:'EA', mat:0.39,      lhr:0.04,                mk:'bulk', gc:true  },

  // ── CONDUIT BODIES ────────────────────────────────────────────────────────
  { id:'cb1',  cat:'Conduit Bodies',   name:'1/2" LB Conduit Body (Al)',        unit:'EA', mat:6.1809,    lhr:0.25,                mk:'bulk', gc:true  },
  { id:'cb2',  cat:'Conduit Bodies',   name:'1/2" PVC LB',                      unit:'EA', mat:3.6385,    lhr:0.25,                mk:'bulk', gc:true  },
  { id:'cb3',  cat:'Conduit Bodies',   name:'1" PVC LB',                        unit:'EA', mat:5.1402,    lhr:0.28,                mk:'bulk', gc:true  },

  // ── PVC CONDUIT ───────────────────────────────────────────────────────────
  { id:'pvc1', cat:'PVC Conduit',      name:'1/2" PVC Sch40 per ft',            unit:'FT', mat:0.3064,    lhr:0.020,               mk:'bulk', gc:true  },
  { id:'pvc2', cat:'PVC Conduit',      name:'3/4" PVC Sch40 per ft',            unit:'FT', mat:0.85,      lhr:0.023,               mk:'bulk', gc:true  },
  { id:'pvc3', cat:'PVC Conduit',      name:'1" PVC Sch40 per ft',              unit:'FT', mat:0.5542,    lhr:0.026,               mk:'bulk', gc:true  },
  { id:'pvc4', cat:'PVC Conduit',      name:'1-1/2" PVC Sch40 per ft',          unit:'FT', mat:0.8948,    lhr:0.033,               mk:'bulk', gc:true  },
  { id:'pvc5', cat:'PVC Conduit',      name:'2" PVC Sch40 per ft',              unit:'FT', mat:0.9299,    lhr:0.038,               mk:'bulk', gc:true  },
  { id:'pvc6', cat:'PVC Conduit',      name:'3" PVC Sch40 per ft',              unit:'FT', mat:1.7299,    lhr:0.050,               mk:'bulk', gc:true  },
  { id:'pvc7', cat:'PVC Conduit',      name:'4" PVC Sch40 per ft',              unit:'FT', mat:2.93,      lhr:0.065,               mk:'bulk', gc:true  },

  // ── PVC FITTINGS ──────────────────────────────────────────────────────────
  { id:'pvf1', cat:'PVC Fittings',     name:'1/2" PVC Coupling',                unit:'EA', mat:0.2011,    lhr:0.04,                mk:'bulk', gc:true  },
  { id:'pvf2', cat:'PVC Fittings',     name:'3/4" PVC Coupling',                unit:'EA', mat:0.2481,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'pvf3', cat:'PVC Fittings',     name:'3/4" PVC 90 Elbow',                unit:'EA', mat:1.2495,    lhr:0.14,                mk:'bulk', gc:true  },
  { id:'pvf4', cat:'PVC Fittings',     name:'1" PVC Coupling',                  unit:'EA', mat:0.3821,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'pvf5', cat:'PVC Fittings',     name:'1" PVC 90 Elbow',                  unit:'EA', mat:1.9486,    lhr:0.14,                mk:'bulk', gc:true  },
  { id:'pvf6', cat:'PVC Fittings',     name:'2" PVC Coupling',                  unit:'EA', mat:0.9584,    lhr:0.06,                mk:'bulk', gc:true  },
  { id:'pvf7', cat:'PVC Fittings',     name:'2" PVC 90 Elbow',                  unit:'EA', mat:3.3999,    lhr:0.18,                mk:'bulk', gc:true  },
  { id:'pvf8', cat:'PVC Fittings',     name:'3" PVC Coupling',                  unit:'EA', mat:2.7916,    lhr:0.08,                mk:'bulk', gc:true  },
  { id:'pvf9', cat:'PVC Fittings',     name:'3/4" PVC Expansion Joint',         unit:'EA', mat:19.8438,   lhr:0.60,                mk:'bulk', gc:true  },
  { id:'pvf10',cat:'PVC Fittings',     name:'2" PVC Expansion Joint',           unit:'EA', mat:25.0845,   lhr:1.00,                mk:'bulk', gc:true  },

  // ── SCH80 PVC ─────────────────────────────────────────────────────────────
  { id:'p80_1',  cat:'PVC Conduit Sch80', name:'1/2" Sch80 PVC per ft',         unit:'FT', mat:0.52,  lhr:0.022, mk:'bulk' },
  { id:'p80_2',  cat:'PVC Conduit Sch80', name:'3/4" Sch80 PVC per ft',         unit:'FT', mat:0.68,  lhr:0.025, mk:'bulk' },
  { id:'p80_3',  cat:'PVC Conduit Sch80', name:'1" Sch80 PVC per ft',           unit:'FT', mat:0.92,  lhr:0.028, mk:'bulk' },
  { id:'p80_4',  cat:'PVC Conduit Sch80', name:'1-1/4" Sch80 PVC per ft',       unit:'FT', mat:1.28,  lhr:0.033, mk:'bulk' },
  { id:'p80_5',  cat:'PVC Conduit Sch80', name:'1-1/2" Sch80 PVC per ft',       unit:'FT', mat:1.52,  lhr:0.038, mk:'bulk' },
  { id:'p80_6',  cat:'PVC Conduit Sch80', name:'2" Sch80 PVC per ft',           unit:'FT', mat:1.98,  lhr:0.043, mk:'bulk' },
  { id:'p80_1c', cat:'PVC Conduit Sch80', name:'1/2" Sch80 Coupling',           unit:'EA', mat:0.35,  lhr:0.04,  mk:'bulk' },
  { id:'p80_2c', cat:'PVC Conduit Sch80', name:'3/4" Sch80 Coupling',           unit:'EA', mat:0.45,  lhr:0.05,  mk:'bulk' },
  { id:'p80_3c', cat:'PVC Conduit Sch80', name:'1" Sch80 Coupling',             unit:'EA', mat:0.62,  lhr:0.05,  mk:'bulk' },
  { id:'p80_4c', cat:'PVC Conduit Sch80', name:'1-1/4" Sch80 Coupling',         unit:'EA', mat:0.85,  lhr:0.06,  mk:'bulk' },
  { id:'p80_5c', cat:'PVC Conduit Sch80', name:'1-1/2" Sch80 Coupling',         unit:'EA', mat:1.02,  lhr:0.07,  mk:'bulk' },
  { id:'p80_6c', cat:'PVC Conduit Sch80', name:'2" Sch80 Coupling',             unit:'EA', mat:1.38,  lhr:0.08,  mk:'bulk' },
  { id:'p80_1cn',cat:'PVC Conduit Sch80', name:'1/2" Sch80 Connector',          unit:'EA', mat:0.58,  lhr:0.10,  mk:'bulk' },
  { id:'p80_2cn',cat:'PVC Conduit Sch80', name:'3/4" Sch80 Connector',          unit:'EA', mat:0.78,  lhr:0.12,  mk:'bulk' },
  { id:'p80_3cn',cat:'PVC Conduit Sch80', name:'1" Sch80 Connector',            unit:'EA', mat:1.05,  lhr:0.14,  mk:'bulk' },

  // ── LIQUID TIGHT ──────────────────────────────────────────────────────────
  { id:'lt1',  cat:'Liquid Tight',     name:'1/2" Liquid Tight per ft',         unit:'FT', mat:LT12,      lhr:0.025,               mk:'bulk', gc:true  },
  { id:'lt2',  cat:'Liquid Tight',     name:'3/4" Liquid Tight per ft',         unit:'FT', mat:LT34,      lhr:0.030,               mk:'bulk', gc:true  },
  { id:'lt3',  cat:'Liquid Tight',     name:'1" Liquid Tight per ft',           unit:'FT', mat:LT1,       lhr:0.035,               mk:'bulk'           },
  { id:'ltf1', cat:'Liquid Tight',     name:'1/2" LT Straight Connector',       unit:'EA', mat:2.4587,    lhr:0.15,                mk:'bulk', gc:true  },
  { id:'ltf2', cat:'Liquid Tight',     name:'3/4" LT Straight Connector',       unit:'EA', mat:4.6427,    lhr:0.18,                mk:'bulk', gc:true  },
  { id:'ltf3', cat:'Liquid Tight',     name:'3/4" LT 90 Connector',             unit:'EA', mat:6.2488,    lhr:0.20,                mk:'bulk', gc:true  },
  { id:'ltf4', cat:'Liquid Tight',     name:'1" LT Straight Connector',         unit:'EA', mat:7.5849,    lhr:0.22,                mk:'bulk', gc:true  },

  // ── FLEX CONDUIT ──────────────────────────────────────────────────────────
  { id:'flex12',cat:'Flex Conduit',    name:'1/2" Flex Conduit per ft',         unit:'FT', mat:0.65,      lhr:0.028,               mk:'bulk'           },
  { id:'flex34',cat:'Flex Conduit',    name:'3/4" Flex Conduit per ft',         unit:'FT', mat:0.90,      lhr:0.033,               mk:'bulk'           },
  { id:'flex1', cat:'Flex Conduit',    name:'1" Flex Conduit per ft',           unit:'FT', mat:1.40,      lhr:0.038,               mk:'bulk'           },
  { id:'flx1',  cat:'Flex Conduit',    name:'1/2" Flex Connector',              unit:'EA', mat:1.20,      lhr:0.10,                mk:'bulk'           },
  { id:'flx2',  cat:'Flex Conduit',    name:'3/4" Flex Connector',              unit:'EA', mat:1.80,      lhr:0.12,                mk:'bulk'           },
  { id:'flx3',  cat:'Flex Conduit',    name:'1" Flex Connector',                unit:'EA', mat:2.50,      lhr:0.14,                mk:'bulk'           },

  // ── RIGID CONDUIT ─────────────────────────────────────────────────────────
  { id:'rg1',   cat:'Rigid Conduit',   name:'1/2" Rigid 10ft',                  unit:'EA', mat:37.50,     lhr:0.350,               mk:'bulk', gc:true  },
  { id:'rg2',   cat:'Rigid Conduit',   name:'3/4" Rigid 10ft',                  unit:'EA', mat:41.00,     lhr:0.400,               mk:'bulk', gc:true  },
  { id:'rg3',   cat:'Rigid Conduit',   name:'1" Rigid 10ft',                    unit:'EA', mat:65.42,     lhr:0.450,               mk:'bulk', gc:true  },
  { id:'rg4',   cat:'Rigid Conduit',   name:'1-1/4" Rigid 10ft',                unit:'EA', mat:96.28,     lhr:0.500,               mk:'bulk', gc:true  },
  { id:'rg5',   cat:'Rigid Conduit',   name:'1-1/2" Rigid 10ft',                unit:'EA', mat:99.23,     lhr:0.550,               mk:'bulk', gc:true  },
  { id:'rg6',   cat:'Rigid Conduit',   name:'2" Rigid 10ft',                    unit:'EA', mat:133.04,    lhr:0.620,               mk:'bulk', gc:true  },
  { id:'rg7',   cat:'Rigid Conduit',   name:'3" Rigid 10ft',                    unit:'EA', mat:266.43,    lhr:0.750,               mk:'bulk', gc:true  },
  { id:'rg8',   cat:'Rigid Conduit',   name:'4" Rigid 10ft',                    unit:'EA', mat:369.26,    lhr:0.900,               mk:'bulk', gc:true  },
  { id:'ln_12', cat:'Rigid Conduit',   name:'1/2" Locknut',                     unit:'EA', mat:0.35,      lhr:0.04,                mk:'bulk'           },
  { id:'ln_34', cat:'Rigid Conduit',   name:'3/4" Locknut',                     unit:'EA', mat:0.45,      lhr:0.04,                mk:'bulk'           },
  { id:'ln_1',  cat:'Rigid Conduit',   name:'1" Locknut',                       unit:'EA', mat:0.65,      lhr:0.05,                mk:'bulk'           },
  { id:'ln_114',cat:'Rigid Conduit',   name:'1-1/4" Locknut',                   unit:'EA', mat:0.85,      lhr:0.05,                mk:'bulk'           },
  { id:'ln_112',cat:'Rigid Conduit',   name:'1-1/2" Locknut',                   unit:'EA', mat:1.10,      lhr:0.06,                mk:'bulk'           },
  { id:'ln_2',  cat:'Rigid Conduit',   name:'2" Locknut',                       unit:'EA', mat:1.65,      lhr:0.07,                mk:'bulk'           },
  { id:'ln_3',  cat:'Rigid Conduit',   name:'3" Locknut',                       unit:'EA', mat:3.20,      lhr:0.10,                mk:'bulk'           },
  { id:'ln_4',  cat:'Rigid Conduit',   name:'4" Locknut',                       unit:'EA', mat:5.50,      lhr:0.12,                mk:'bulk'           },

  // ── WIRE & CABLE — MC GLIDE ───────────────────────────────────────────────
  { id:'w1',    cat:'Wire & Cable',    name:'12/2 MC Glide per ft (coil)',      unit:'FT', mat:0.60,      lhr:0.026,               mk:'bulk', gc:true  },
  { id:'w2',    cat:'Wire & Cable',    name:'12/3 MC Glide per ft',             unit:'FT', mat:1.17,      lhr:0.028,               mk:'bulk', gc:true  },
  { id:'w3',    cat:'Wire & Cable',    name:'10/2 MC Glide per ft',             unit:'FT', mat:0.78,      lhr:0.029,               mk:'bulk'           },
  { id:'w4',    cat:'Wire & Cable',    name:'10/3 MC Glide per ft',             unit:'FT', mat:1.05,      lhr:0.032,               mk:'bulk'           },
  { id:'w4b',   cat:'Wire & Cable',    name:'8/3 MC Cable per ft',              unit:'FT', mat:1.90,      lhr:0.040,               mk:'bulk'           },
  { id:'w4c',   cat:'Wire & Cable',    name:'6/3 MC Cable per ft',              unit:'FT', mat:2.80,      lhr:0.048,               mk:'bulk'           },
  { id:'w4d',   cat:'Wire & Cable',    name:'4/3 MC Cable per ft',              unit:'FT', mat:4.20,      lhr:0.056,               mk:'bulk'           },
  { id:'w4e',   cat:'Wire & Cable',    name:'2/3 MC Cable per ft',              unit:'FT', mat:6.50,      lhr:0.065,               mk:'bulk'           },
  { id:'w4f',   cat:'Wire & Cable',    name:'1/0 MC Cable per ft',              unit:'FT', mat:9.50,      lhr:0.078,               mk:'bulk'           },

  // ── WIRE & CABLE — THHN Cu ────────────────────────────────────────────────
  { id:'w_14cu',  cat:'Wire & Cable',  name:'#14 THHN Cu per ft',               unit:'FT', mat:0.14093,   lhr:0.005,               mk:'bulk', gc:true  },
  { id:'w5',      cat:'Wire & Cable',  name:'#12 THHN Cu per ft',               unit:'FT', mat:0.23163,   lhr:0.006,               mk:'bulk', gc:true  },
  { id:'w_10cu',  cat:'Wire & Cable',  name:'#10 THHN Cu per ft',               unit:'FT', mat:0.34064,   lhr:0.008,               mk:'bulk', gc:true  },
  { id:'w_8cu',   cat:'Wire & Cable',  name:'#8 THHN Cu per ft',                unit:'FT', mat:0.65756,   lhr:0.010,               mk:'bulk', gc:true  },
  { id:'w8',      cat:'Wire & Cable',  name:'#6 THHN Cu per ft',                unit:'FT', mat:1.01171,   lhr:0.011,               mk:'bulk', gc:true  },
  { id:'w_4cu',   cat:'Wire & Cable',  name:'#4 THHN Cu per ft',                unit:'FT', mat:1.54819,   lhr:0.013,               mk:'bulk', gc:true  },
  { id:'w_3cu',   cat:'Wire & Cable',  name:'#3 THHN Cu per ft',                unit:'FT', mat:1.95276,   lhr:0.015,               mk:'bulk', gc:true  },
  { id:'w_2cu',   cat:'Wire & Cable',  name:'#2 THHN Cu per ft',                unit:'FT', mat:2.44425,   lhr:0.017,               mk:'bulk', gc:true  },
  { id:'w_1cu',   cat:'Wire & Cable',  name:'#1 THHN Cu per ft',                unit:'FT', mat:2.80145,   lhr:0.020,               mk:'bulk', gc:true  },
  { id:'w_1_0cu', cat:'Wire & Cable',  name:'1/0 THHN Cu per ft',               unit:'FT', mat:3.42993,   lhr:0.023,               mk:'bulk', gc:true  },
  { id:'w_2_0cu', cat:'Wire & Cable',  name:'2/0 THHN Cu per ft',               unit:'FT', mat:4.22499,   lhr:0.026,               mk:'bulk', gc:true  },
  { id:'w_3_0cu', cat:'Wire & Cable',  name:'3/0 THHN Cu per ft',               unit:'FT', mat:5.33209,   lhr:0.030,               mk:'bulk', gc:true  },
  { id:'w_4_0cu', cat:'Wire & Cable',  name:'4/0 THHN Cu per ft',               unit:'FT', mat:6.65585,   lhr:0.034,               mk:'bulk', gc:true  },
  { id:'w_250cu', cat:'Wire & Cable',  name:'250kcmil THHN Cu per ft',          unit:'FT', mat:7.71247,   lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_350cu', cat:'Wire & Cable',  name:'350kcmil THHN Cu per ft',          unit:'FT', mat:10.01602,  lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_400cu', cat:'Wire & Cable',  name:'400kcmil THHN Cu per ft',          unit:'FT', mat:12.31956,  lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_500cu', cat:'Wire & Cable',  name:'500kcmil THHN Cu per ft',          unit:'FT', mat:15.56668,  lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_600cu', cat:'Wire & Cable',  name:'600kcmil THHN Cu per ft',          unit:'FT', mat:19.39756,  lhr:0.040,               mk:'bulk', gc:true  },

  // ── WIRE & CABLE — THHN Al ────────────────────────────────────────────────
  { id:'w10',     cat:'Wire & Cable',  name:'#2 XHHW Al per ft',                unit:'FT', mat:0.49544,   lhr:0.017,               mk:'bulk', gc:true  },
  { id:'w_2al',   cat:'Wire & Cable',  name:'#2 THHN Al per ft',                unit:'FT', mat:0.65112,   lhr:0.017,               mk:'bulk', gc:true  },
  { id:'w_1al',   cat:'Wire & Cable',  name:'#1 THHN Al per ft',                unit:'FT', mat:0.89735,   lhr:0.020,               mk:'bulk', gc:true  },
  { id:'w_1_0al', cat:'Wire & Cable',  name:'1/0 THHN Al per ft',               unit:'FT', mat:1.00782,   lhr:0.023,               mk:'bulk', gc:true  },
  { id:'w_2_0al', cat:'Wire & Cable',  name:'2/0 THHN Al per ft',               unit:'FT', mat:1.19104,   lhr:0.026,               mk:'bulk', gc:true  },
  { id:'w_3_0al', cat:'Wire & Cable',  name:'3/0 THHN Al per ft',               unit:'FT', mat:1.47874,   lhr:0.030,               mk:'bulk', gc:true  },
  { id:'w_4_0al', cat:'Wire & Cable',  name:'4/0 THHN Al per ft',               unit:'FT', mat:1.64362,   lhr:0.034,               mk:'bulk', gc:true  },
  { id:'w_250al', cat:'Wire & Cable',  name:'250kcmil THHN Al per ft',          unit:'FT', mat:2.00643,   lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_300al', cat:'Wire & Cable',  name:'300kcmil THHN Al per ft',          unit:'FT', mat:2.77238,   lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_350al', cat:'Wire & Cable',  name:'350kcmil THHN Al per ft',          unit:'FT', mat:2.81816,   lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_400al', cat:'Wire & Cable',  name:'400kcmil THHN Al per ft',          unit:'FT', mat:3.29459,   lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_500al', cat:'Wire & Cable',  name:'500kcmil THHN Al per ft',          unit:'FT', mat:3.63354,   lhr:0.040,               mk:'bulk', gc:true  },
  { id:'w_600al', cat:'Wire & Cable',  name:'600kcmil THHN Al per ft',          unit:'FT', mat:4.36025,   lhr:0.040,               mk:'bulk', gc:true  },

  // ── WIRE & CABLE — NM-B ROMEX ─────────────────────────────────────────────
  { id:'rm1',  cat:'Wire & Cable',     name:'14/2 Romex NM-B per ft',           unit:'FT', mat:0.28,      lhr:0.018,               mk:'bulk'           },
  { id:'rm2',  cat:'Wire & Cable',     name:'12/2 Romex NM-B per ft',           unit:'FT', mat:0.38,      lhr:0.020,               mk:'bulk'           },
  { id:'rm3',  cat:'Wire & Cable',     name:'12/3 Romex NM-B per ft',           unit:'FT', mat:0.58,      lhr:0.023,               mk:'bulk'           },
  { id:'rm5',  cat:'Wire & Cable',     name:'14/3 Romex NM-B per ft',           unit:'FT', mat:0.38,      lhr:0.018,               mk:'bulk'           },
  { id:'rm6',  cat:'Wire & Cable',     name:'10/2 Romex NM-B per ft',           unit:'FT', mat:0.65,      lhr:0.022,               mk:'bulk'           },
  { id:'rm7',  cat:'Wire & Cable',     name:'10/3 Romex NM-B per ft',           unit:'FT', mat:0.90,      lhr:0.026,               mk:'bulk'           },
  { id:'rm4',  cat:'Wire & Cable',     name:'Romex Staple (500pk=$22)',          unit:'EA', mat:0.044,     lhr:0.02,                mk:'bulk'           },

  // ── WIRE & CABLE — SPECIALTY ──────────────────────────────────────────────
  { id:'w11',  cat:'Wire & Cable',     name:'14/2 NM per ft',                   unit:'FT', mat:0.284,     lhr:0.030,               mk:'bulk', gc:true  },
  { id:'w14',  cat:'Wire & Cable',     name:'Cat6 Cable per ft',                unit:'FT', mat:0.30,      lhr:0.010,               mk:'bulk'           },
  { id:'w15',  cat:'Wire & Cable',     name:'Bare Cu #4 per ft',                unit:'FT', mat:1.487,     lhr:0.013,               mk:'bulk', gc:true  },
  { id:'w16',  cat:'Wire & Cable',     name:'Luminaire Cable 12/2+16/2 per ft', unit:'FT', mat:1.90,      lhr:0.026,               mk:'bulk', gc:true  },

  // ── WIRE CONNECTORS & GROUNDING ───────────────────────────────────────────
  { id:'wc1',  cat:'Wire Connectors',  name:'Orange/Blue Wire Nut',             unit:'EA', mat:WNOB,      lhr:0.04,                mk:'bulk', gc:true  },
  { id:'wc2',  cat:'Wire Connectors',  name:'Red Wire Nut',                     unit:'EA', mat:WNRD,      lhr:0.06,                mk:'bulk', gc:true  },
  { id:'wc3',  cat:'Wire Connectors',  name:'Green Wire Nut',                   unit:'EA', mat:WNGN,      lhr:0.06,                mk:'bulk', gc:true  },
  { id:'gr1',  cat:'Grounding',        name:'Ground Screw #10-32',              unit:'EA', mat:GNSC,      lhr:0.04,                mk:'bulk', gc:true  },
  { id:'gr2',  cat:'Grounding',        name:'Ground Rod 5/8" x 8ft',            unit:'EA', mat:19.99,     lhr:0,                   mk:'bulk', gc:true  },
  { id:'gr3',  cat:'Grounding',        name:'Ground Rod Acorn Clamp',           unit:'EA', mat:4.2182,    lhr:N8.rod,              mk:'bulk', gc:true  },
  { id:'gr4',  cat:'Grounding',        name:'Ground Pigtail for Box',           unit:'EA', mat:0.45,      lhr:0.06,                mk:'bulk'           },
  { id:'gr5',  cat:'Grounding',        name:'3/4" Conduit Grounding Bushing',   unit:'EA', mat:2.20,      lhr:N8.b34,              mk:'bulk'           },
  { id:'gr6',  cat:'Grounding',        name:'1" Conduit Grounding Bushing',     unit:'EA', mat:2.80,      lhr:N8.b1,               mk:'bulk'           },
  { id:'gr7',  cat:'Grounding',        name:'Bare Cu #4 Ground per ft',         unit:'FT', mat:1.487,     lhr:N8.cu4,              mk:'bulk', gc:true  },

  // ── STRUT, HANGERS & RACK HARDWARE ───────────────────────────────────────
  { id:'sh1',      cat:'Strut & Hangers', name:'1-5/8 Strut 12ga per ft',       unit:'FT', mat:1.9999,    lhr:0.025,               mk:'bulk', gc:true  },
  { id:'sh2',      cat:'Strut & Hangers', name:'Caddy Beam Clamp 1/4" Rod',     unit:'EA', mat:2.0007,    lhr:0.10,                mk:'bulk', gc:true  },
  { id:'sh3',      cat:'Strut & Hangers', name:'Jack Chain per ft',             unit:'FT', mat:0.40,      lhr:0.05,                mk:'bulk'           },
  { id:'sc1',      cat:'Strut & Hangers', name:'1/2" Click-It Strap',           unit:'EA', mat:1.1056,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'sc2',      cat:'Strut & Hangers', name:'1" Click-It Strap',             unit:'EA', mat:1.6235,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'sc3',      cat:'Strut & Hangers', name:'1-1/2" Click-It Strap',         unit:'EA', mat:1.9306,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'rack_rod', cat:'Strut & Hangers', name:'3/8" Threaded Rod per ft',      unit:'FT', mat:1.00,      lhr:0.05,                mk:'bulk', gc:true  },
  { id:'rack_bc',  cat:'Strut & Hangers', name:'Beam Clamp 3/8" Rod',           unit:'EA', mat:0.8829,    lhr:0.10,                mk:'bulk', gc:true  },
  { id:'rack_cap', cat:'Strut & Hangers', name:'Strut End Cap',                 unit:'EA', mat:5.6505,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'rack_di',  cat:'Strut & Hangers', name:'3/8" Drop-In Anchor',           unit:'EA', mat:2.50,      lhr:0.10,                mk:'bulk'           },
  { id:'rack_fw',  cat:'Strut & Hangers', name:'3/8" x 1-1/4" Fender Washer',  unit:'EA', mat:0.29,      lhr:0.02,                mk:'bulk'           },
  { id:'rack_lw',  cat:'Strut & Hangers', name:'3/8" Lock Washer',              unit:'EA', mat:0.27,      lhr:0.02,                mk:'bulk'           },
  { id:'rack_bolt',cat:'Strut & Hangers', name:'3/8" Hex Bolt',                 unit:'EA', mat:1.05,      lhr:0.03,                mk:'bulk'           },
  { id:'rack_cn',  cat:'Strut & Hangers', name:'3/8" Coupling Nut',             unit:'EA', mat:0.65,      lhr:0.04,                mk:'bulk'           },
  { id:'bridle',   cat:'Strut & Hangers', name:'Bridle Ring 3/8"',              unit:'EA', mat:0.85,      lhr:0.05,                mk:'bulk'           },
  { id:'ch12',     cat:'Strut & Hangers', name:'1/2" Conduit Hanger/Clamp',     unit:'EA', mat:0.45,      lhr:0.04,                mk:'bulk'           },
  { id:'ch34',     cat:'Strut & Hangers', name:'3/4" Conduit Hanger/Clamp',     unit:'EA', mat:0.55,      lhr:0.04,                mk:'bulk'           },
  { id:'ch1',      cat:'Strut & Hangers', name:'1" Conduit Hanger/Clamp',       unit:'EA', mat:0.75,      lhr:0.05,                mk:'bulk'           },
  { id:'ch112',    cat:'Strut & Hangers', name:'1-1/2" Conduit Hanger/Clamp',   unit:'EA', mat:1.10,      lhr:0.05,                mk:'bulk'           },
  { id:'ch2',      cat:'Strut & Hangers', name:'2" Conduit Hanger/Clamp',       unit:'EA', mat:1.50,      lhr:0.06,                mk:'bulk'           },

  // ── CONDUIT SUPPORTS — STRAPS ─────────────────────────────────────────────
  { id:'sp_emt12',  cat:'Supports', name:'1/2" EMT 1-Hole Strap',               unit:'EA', mat:0.22,      lhr:0.04,                mk:'bulk'           },
  { id:'sp_emt34',  cat:'Supports', name:'3/4" EMT 1-Hole Strap',               unit:'EA', mat:0.28,      lhr:0.04,                mk:'bulk'           },
  { id:'sp_emt1',   cat:'Supports', name:'1" EMT 1-Hole Strap',                 unit:'EA', mat:0.38,      lhr:0.05,                mk:'bulk'           },
  { id:'sp_emt114', cat:'Supports', name:'1-1/4" EMT 1-Hole Strap',             unit:'EA', mat:1.25,      lhr:0.05,                mk:'bulk', gc:true  },
  { id:'sp_emt112', cat:'Supports', name:'1-1/2" EMT 1-Hole Strap',             unit:'EA', mat:0.2020,    lhr:0.05,                mk:'bulk', gc:true  },
  { id:'sp_emt2',   cat:'Supports', name:'2" EMT 1-Hole Strap',                 unit:'EA', mat:0.28,      lhr:0.06,                mk:'bulk'           },
  { id:'sp_hng12',  cat:'Supports', name:'1/2" Conduit Hanger (snap)',           unit:'EA', mat:0.35,      lhr:0.04,                mk:'bulk'           },
  { id:'sp_hng34',  cat:'Supports', name:'3/4" Conduit Hanger (snap)',           unit:'EA', mat:0.42,      lhr:0.04,                mk:'bulk'           },
  { id:'sp_hng1',   cat:'Supports', name:'1" Conduit Hanger (snap)',             unit:'EA', mat:0.55,      lhr:0.05,                mk:'bulk'           },
  { id:'sp_hng114', cat:'Supports', name:'1-1/4" Conduit Hanger (snap)',         unit:'EA', mat:0.68,      lhr:0.05,                mk:'bulk'           },
  { id:'sp_hng112', cat:'Supports', name:'1-1/2" Conduit Hanger (snap)',         unit:'EA', mat:0.82,      lhr:0.05,                mk:'bulk'           },
  { id:'sp_hng2',   cat:'Supports', name:'2" Conduit Hanger (snap)',             unit:'EA', mat:1.05,      lhr:0.06,                mk:'bulk'           },
  { id:'sp_cli34',  cat:'Supports', name:'3/4" Strut Clip',                     unit:'EA', mat:1.42,      lhr:0.05,                mk:'bulk'           },
  { id:'sp_cli114', cat:'Supports', name:'1-1/4" Strut Clip',                   unit:'EA', mat:1.78,      lhr:0.05,                mk:'bulk'           },
  { id:'sp_cli2',   cat:'Supports', name:'2" Strut Clip',                       unit:'EA', mat:2.15,      lhr:0.05,                mk:'bulk'           },

  // ── CABLE TRAY & WIREWAY ─────────────────────────────────────────────────
  { id:'ct12',      cat:'Cable Tray', name:'12" Cable Tray per ft',             unit:'FT', mat:8.50,      lhr:0.10,                mk:'bulk'           },
  { id:'ct18',      cat:'Cable Tray', name:'18" Cable Tray per ft',             unit:'FT', mat:11.00,     lhr:0.12,                mk:'bulk'           },
  { id:'ct24',      cat:'Cable Tray', name:'24" Cable Tray per ft',             unit:'FT', mat:14.00,     lhr:0.14,                mk:'bulk'           },
  { id:'ct_hanger', cat:'Cable Tray', name:'Cable Tray Hanger',                 unit:'EA', mat:4.50,      lhr:0.15,                mk:'bulk'           },
  { id:'ww1',       cat:'Misc',       name:'4" Wireway/Gutter per ft',          unit:'FT', mat:12.00,     lhr:0.15,                mk:'bulk'           },
  { id:'ww2',       cat:'Misc',       name:'6" Wireway/Gutter per ft',          unit:'FT', mat:18.00,     lhr:0.18,                mk:'bulk'           },

  // ── PANELS & GEAR ─────────────────────────────────────────────────────────
  { id:'pg1',  cat:'Panels & Gear',   name:'30/60 100A Load Center',            unit:'EA', mat:144.29,    lhr:3.0,                 mk:'light', gc:true },
  { id:'pg2',  cat:'Panels & Gear',   name:'40/80 200A Load Center',            unit:'EA', mat:213.82,    lhr:4.0,                 mk:'light', gc:true },
  { id:'pg3',  cat:'Panels & Gear',   name:'1P 15A Breaker (HOM)',              unit:'EA', mat:7.33,      lhr:0.32,                mk:'light', gc:true },
  { id:'pg4',  cat:'Panels & Gear',   name:'1P 20A Breaker (HOM)',              unit:'EA', mat:5.99,      lhr:0.34,                mk:'light', gc:true },
  { id:'pg5',  cat:'Panels & Gear',   name:'1P 20A AFCI/GFCI Breaker',          unit:'EA', mat:61.23,     lhr:0.49,                mk:'light', gc:true },
  { id:'pg5b', cat:'Panels & Gear',   name:'1P 15A AFCI Plug-On Neutral',       unit:'EA', mat:63.56,     lhr:0.49,                mk:'light', gc:true },
  { id:'pg6',  cat:'Panels & Gear',   name:'1P 20A GFCI Breaker (QO)',          unit:'EA', mat:59.02,     lhr:0.49,                mk:'light', gc:true },
  { id:'pg7',  cat:'Panels & Gear',   name:'1P 30A Breaker (HOM)',              unit:'EA', mat:7.48,      lhr:0.38,                mk:'light', gc:true },
  { id:'pg8',  cat:'Panels & Gear',   name:'1P 60A Breaker',                    unit:'EA', mat:16.00,     lhr:0.47,                mk:'light'          },
  { id:'pg9',  cat:'Panels & Gear',   name:'2P 20A Breaker (HOM)',              unit:'EA', mat:13.59,     lhr:0.52,                mk:'light', gc:true },
  { id:'pg10', cat:'Panels & Gear',   name:'2P 30A Breaker (HOM)',              unit:'EA', mat:17.30,     lhr:0.58,                mk:'light', gc:true },
  { id:'pg11', cat:'Panels & Gear',   name:'2P 50A Breaker (HOM)',              unit:'EA', mat:17.30,     lhr:0.64,                mk:'light', gc:true },
  { id:'pg12', cat:'Panels & Gear',   name:'2P 50A GFCI Breaker',              unit:'EA', mat:135.89,    lhr:0.64,                mk:'light', gc:true },
  { id:'pg13', cat:'Panels & Gear',   name:'3P 20A Breaker',                    unit:'EA', mat:28.00,     lhr:0.71,                mk:'light'          },
  { id:'pg14', cat:'Panels & Gear',   name:'3P 30A Breaker',                    unit:'EA', mat:32.00,     lhr:0.78,                mk:'light'          },
  { id:'pg15', cat:'Panels & Gear',   name:'3P 100A Breaker',                   unit:'EA', mat:85.00,     lhr:1.28,                mk:'light'          },
  { id:'pg16', cat:'Panels & Gear',   name:'Fused Disco 3P 30A',               unit:'EA', mat:285.13,    lhr:2.20,                mk:'light', gc:true },
  { id:'pg17', cat:'Panels & Gear',   name:'200A Meter Main (Milbank)',         unit:'EA', mat:399.99,    lhr:3.25,                mk:'light', gc:true },
  { id:'pg18', cat:'Panels & Gear',   name:'Tandem 2x20A Breaker',             unit:'EA', mat:16.80,     lhr:0.52,                mk:'light', gc:true },
  { id:'pg19', cat:'Panels & Gear',   name:'Whole Home Surge Protection 50kA', unit:'EA', mat:101.89,    lhr:0.75,                mk:'light', gc:true },

  // ── DEVICES ───────────────────────────────────────────────────────────────
  { id:'d1',   cat:'Devices', name:'20A Spec Grade Duplex Recept',  unit:'EA', mat:2.04,   lhr:N6.r20,      mk:'bulk', gc:true },
  { id:'d2',   cat:'Devices', name:'15A TR Duplex Receptacle',      unit:'EA', mat:1.75,   lhr:N6.r15,      mk:'bulk', gc:true },
  { id:'d3',   cat:'Devices', name:'20A GFCI Receptacle',           unit:'EA', mat:16.50,  lhr:N6.gf20,     mk:'bulk'         },
  { id:'d4',   cat:'Devices', name:'15A TR GFCI Receptacle',        unit:'EA', mat:18.57,  lhr:N6.gf15,     mk:'bulk', gc:true },
  { id:'d4b',  cat:'Devices', name:'15A TR/WR GFCI Receptacle',     unit:'EA', mat:22.15,  lhr:N6.gf15,     mk:'bulk', gc:true },
  { id:'d5',   cat:'Devices', name:'Single Pole Switch (spec)',      unit:'EA', mat:6.97,   lhr:N6.sw20,     mk:'bulk', gc:true },
  { id:'d6',   cat:'Devices', name:'Single Pole Switch (trade)',     unit:'EA', mat:0.9832, lhr:N6.sw15,     mk:'bulk', gc:true },
  { id:'d7',   cat:'Devices', name:'3-Way Switch',                   unit:'EA', mat:1.8751, lhr:N6.sw3,      mk:'bulk', gc:true },
  { id:'d8',   cat:'Devices', name:'4-Way Switch',                   unit:'EA', mat:9.00,   lhr:N6.sw4,      mk:'bulk'         },
  { id:'d9',   cat:'Devices', name:'Dimmer AYCL-153P',               unit:'EA', mat:24.15,  lhr:N6.dim,      mk:'bulk', gc:true },
  { id:'d14',  cat:'Devices', name:'Lutron 0-10V Dimmer (DVSTV)',    unit:'EA', mat:83.88,  lhr:N6.dim010,   mk:'bulk', gc:true },
  { id:'d15',  cat:'Devices', name:'Occupancy Sensor Ceiling',       unit:'EA', mat:42.00,  lhr:N6.occ_ceil, mk:'bulk'         },
  { id:'d16',  cat:'Devices', name:'USB Receptacle Combo 20A',       unit:'EA', mat:14.50,  lhr:0.90,        mk:'bulk'         },
  { id:'d18',  cat:'Devices', name:'30A Dryer Receptacle 14-30R',    unit:'EA', mat:8.57,   lhr:1.10,        mk:'bulk', gc:true },
  { id:'d19',  cat:'Devices', name:'50A WR EV Charger Outlet',       unit:'EA', mat:55.89,  lhr:1.25,        mk:'bulk', gc:true },
  { id:'d20',  cat:'Devices', name:'Twist-Lock Receptacle',          unit:'EA', mat:18.00,  lhr:1.25,        mk:'bulk'         },
  { id:'d21',  cat:'Devices', name:'240V Receptacle',                unit:'EA', mat:9.00,   lhr:1.10,        mk:'bulk'         },
  { id:'dp1',  cat:'Devices', name:'1G Receptacle Plate',            unit:'EA', mat:0.5412, lhr:N6.cov1,     mk:'bulk', gc:true },
  { id:'dp2',  cat:'Devices', name:'1G Switch Plate',                unit:'EA', mat:0.693,  lhr:N6.cov1,     mk:'bulk', gc:true },
  { id:'dp3',  cat:'Devices', name:'2G Duplex Plate',                unit:'EA', mat:1.174,  lhr:N6.cov2,     mk:'bulk', gc:true },
  { id:'dp5',  cat:'Devices', name:'Low Profile WP In-Use Cover',    unit:'EA', mat:17.16,  lhr:N6.wp,       mk:'bulk', gc:true },
  { id:'dp7',  cat:'Devices', name:'Cat6 Keystone Connector',        unit:'EA', mat:7.62,   lhr:0.30,        mk:'bulk', gc:true },
  { id:'dp8',  cat:'Devices', name:'2-Port Keystone Plate',          unit:'EA', mat:1.99,   lhr:0.15,        mk:'bulk', gc:true },
  { id:'dp9',  cat:'Devices', name:'1-Port Keystone Plate',          unit:'EA', mat:1.25,   lhr:0.10,        mk:'bulk'         },
  { id:'dp10', cat:'Devices', name:'4-Port Keystone Plate (2-gang)', unit:'EA', mat:2.75,   lhr:0.15,        mk:'bulk'         },

  // ── LIGHTING ──────────────────────────────────────────────────────────────
  // lhr:0 on all lc* items — install labor comes solely from the explicit
  // fixLabCost line in FixtureBuilderTab (asm.iHr × qty × diff × R.labor).
  // Setting BOM lhr>0 here would double-count fixture install labor.
  { id:'lc1',  cat:'Lighting', name:'2x4 LED Lay-In T-Bar',          unit:'EA', mat:48.00,  lhr:0, mk:'light'          },
  { id:'lc2',  cat:'Lighting', name:'2x2 LED Lay-In T-Bar',          unit:'EA', mat:38.00,  lhr:0, mk:'light'          },
  { id:'lc5',  cat:'Lighting', name:'4ft LED Strip Surface',          unit:'EA', mat:64.11,  lhr:0, mk:'light', gc:true },
  { id:'lc6',  cat:'Lighting', name:'8ft LED Strip Surface',          unit:'EA', mat:72.00,  lhr:0, mk:'light'          },
  { id:'lc7',  cat:'Lighting', name:'48" Chain Hung Industrial LED',  unit:'EA', mat:95.00,  lhr:0, mk:'light'          },
  { id:'lc8',  cat:'Lighting', name:'High Bay LED Round (UFO)',       unit:'EA', mat:185.00, lhr:0, mk:'light'          },
  { id:'lc9',  cat:'Lighting', name:'4" LED Recessed Wafer',          unit:'EA', mat:18.37,  lhr:0, mk:'light', gc:true },
  { id:'lc10', cat:'Lighting', name:'LED Wall Pack (RAB Brisk)',      unit:'EA', mat:66.75,  lhr:0, mk:'light', gc:true },
  { id:'lc11', cat:'Lighting', name:'Exit Sign Surface Mount',        unit:'EA', mat:38.00,  lhr:0, mk:'light'          },
  { id:'lc12', cat:'Lighting', name:'Exit/EBU Combo (CCR)',           unit:'EA', mat:79.92,  lhr:0, mk:'light', gc:true },
  { id:'lc13', cat:'Lighting', name:'Emergency Dual Head',            unit:'EA', mat:55.00,  lhr:0, mk:'light'          },
  { id:'lc14', cat:'Lighting', name:'Ceiling Fan up to 36"',          unit:'EA', mat:95.00,  lhr:0, mk:'light'          },
  { id:'lc15', cat:'Lighting', name:'Ceiling Fan 37"-48"',            unit:'EA', mat:145.00, lhr:0, mk:'light'          },
  { id:'lc16', cat:'Lighting', name:'Wafer Rough-In Frame Kit 4"',   unit:'EA', mat:5.29,   lhr:0, mk:'light', gc:true },
  { id:'lc17', cat:'Lighting', name:'Tek Screw to T-Bar',            unit:'EA', mat:0.25,   lhr:0, mk:'bulk'           },

  // ── HEATING & HVAC ────────────────────────────────────────────────────────
  { id:'h1',  cat:'Heating & HVAC', name:'Electric Baseboard 48"',             unit:'EA', mat:72.00,  lhr:N9.bb48,  mk:'bulk' },
  { id:'h2',  cat:'Heating & HVAC', name:'Electric Baseboard 96"',             unit:'EA', mat:132.00, lhr:N9.bb96,  mk:'bulk' },
  { id:'h3',  cat:'Heating & HVAC', name:'Wall Heater 240V 3000W',             unit:'EA', mat:145.00, lhr:N9.wh3k,  mk:'bulk' },
  { id:'h4',  cat:'Heating & HVAC', name:'Unit Heater w/ Blower 5KW',          unit:'EA', mat:385.00, lhr:N9.uh5,   mk:'bulk' },
  { id:'h5',  cat:'Heating & HVAC', name:'Low Voltage Thermostat',             unit:'EA', mat:45.00,  lhr:N9.tsLV,  mk:'bulk' },
  { id:'h6',  cat:'Heating & HVAC', name:'Line Voltage Thermostat',            unit:'EA', mat:55.00,  lhr:N9.tsLN,  mk:'bulk' },
  { id:'h7',  cat:'Heating & HVAC', name:'Power Connection 20A (per end)',     unit:'EA', mat:0,      lhr:N9.p20,   mk:'bulk' },
  { id:'h8',  cat:'Heating & HVAC', name:'Power Connection 60A (per end)',     unit:'EA', mat:0,      lhr:N9.p60,   mk:'bulk' },
  { id:'h9',  cat:'Heating & HVAC', name:'Power Connection 100A (per end)',    unit:'EA', mat:0,      lhr:N9.p100,  mk:'bulk' },

  // ── TEMP POWER ────────────────────────────────────────────────────────────
  { id:'t1',  cat:'Temp Power', name:'Temp Svc Pole 1P 200A',                  unit:'EA', mat:650.00,  lhr:N10.s1p200, mk:'bulk' },
  { id:'t2',  cat:'Temp Power', name:'Temp Svc Pole 3P 200A',                  unit:'EA', mat:850.00,  lhr:N10.s3p200, mk:'bulk' },
  { id:'t3',  cat:'Temp Power', name:'Portable Lighting Panel 100A',           unit:'EA', mat:485.00,  lhr:N10.pan100, mk:'bulk' },
  { id:'t4',  cat:'Temp Power', name:'Extension Cord 100ft 20A',               unit:'EA', mat:28.00,   lhr:N10.ext20,  mk:'bulk' },
  { id:'t5',  cat:'Temp Power', name:'Prefab Light String 100ft',              unit:'EA', mat:75.00,   lhr:N10.str100, mk:'bulk' },
  { id:'t6',  cat:'Temp Power', name:'Portable Generator 5KW',                 unit:'EA', mat:950.00,  lhr:N10.gen5,   mk:'bulk' },

  // ── UNDERGROUND ───────────────────────────────────────────────────────────
  { id:'ug1',  cat:'Underground', name:'3/4" Sch40 PVC in Trench per ft',      unit:'FT', mat:0.3884,  lhr:N11.p34,   mk:'bulk', gc:true },
  { id:'ug2',  cat:'Underground', name:'1" Sch40 PVC in Trench per ft',        unit:'FT', mat:0.5542,  lhr:N11.p1,    mk:'bulk', gc:true },
  { id:'ug3',  cat:'Underground', name:'2" Sch40 PVC in Trench per ft',        unit:'FT', mat:0.9299,  lhr:N11.p2,    mk:'bulk', gc:true },
  { id:'ug4',  cat:'Underground', name:'4" Sch40 PVC in Trench per ft',        unit:'FT', mat:2.20,    lhr:N11.p4,    mk:'bulk'          },
  { id:'ug5',  cat:'Underground', name:'2" PVC EB/DB in Trench per ft',        unit:'FT', mat:0.65,    lhr:N11.eb2,   mk:'bulk'          },
  { id:'ug6',  cat:'Underground', name:'3" PVC EB/DB in Trench per ft',        unit:'FT', mat:1.10,    lhr:N11.eb3,   mk:'bulk'          },
  { id:'ug7',  cat:'Underground', name:'3/4" PVC 90 Elbow (buried)',           unit:'EA', mat:1.2495,  lhr:N11.e34,   mk:'bulk', gc:true },
  { id:'ug8',  cat:'Underground', name:'2" PVC 90 Elbow (buried)',             unit:'EA', mat:3.3999,  lhr:N11.e2,    mk:'bulk', gc:true },
  { id:'ug9',  cat:'Underground', name:'600V DB Cu 1/C #12-#8 per ft',        unit:'FT', mat:0.32,    lhr:N11.db128, mk:'bulk'          },
  { id:'ug10', cat:'Underground', name:'600V DB Cu 1/C #6-#3 per ft',         unit:'FT', mat:0.55,    lhr:N11.db63,  mk:'bulk'          },
  { id:'ug11', cat:'Underground', name:'600V Cu pulled-in 1/C #12-#8',        unit:'FT', mat:0.12,    lhr:N11.pu128, mk:'bulk'          },
  { id:'ug12', cat:'Underground', name:'600V Cu pulled-in 1/C #6-#3',         unit:'FT', mat:0.18,    lhr:N11.pu63,  mk:'bulk'          },
  { id:'ug13', cat:'Underground', name:'Hand Excavation Sandy per ft',         unit:'FT', mat:0,       lhr:N11.xs,    mk:'bulk'          },
  { id:'ug14', cat:'Underground', name:'Hand Excavation Clay per ft',          unit:'FT', mat:0,       lhr:N11.xc,    mk:'bulk'          },
  { id:'ug15', cat:'Underground', name:'Backfill & Compaction per ft',         unit:'FT', mat:0,       lhr:N11.bf,    mk:'bulk'          },

  // ── MISC HARDWARE ─────────────────────────────────────────────────────────
  { id:'pvc_glue', cat:'Misc Hardware', name:'PVC Cement 32oz Can',            unit:'EA', mat:28.00,   lhr:0.05, mk:'bulk', gc:true },
  { id:'m1',       cat:'Misc Hardware', name:'Fire Stop Sealant 10oz',         unit:'EA', mat:17.97,   lhr:0,    mk:'bulk', gc:true },
  { id:'m2',       cat:'Misc Hardware', name:'NM Staple 1/2"',                 unit:'EA', mat:0.05206, lhr:0.02, mk:'bulk', gc:true },
  { id:'m3',       cat:'Misc Hardware', name:'Duct Seal 1lb',                  unit:'EA', mat:4.9994,  lhr:0.05, mk:'bulk', gc:true },
  { id:'m4',       cat:'Misc Hardware', name:'Black Electrical Tape',          unit:'EA', mat:1.46,    lhr:0,    mk:'bulk', gc:true },
  { id:'m5',       cat:'Misc Hardware', name:'Drywall Screw 6x1-5/8"',        unit:'EA', mat:0.0667,  lhr:0.01, mk:'bulk', gc:true },

  // ── FIRE ALARM CABLE ─────────────────────────────────────────────────────
  { id:'fa1',  cat:'Fire Alarm', name:'FPLR 16/2 SLC NM (wood) per ft',       unit:'FT', mat:0.30,    lhr:0.008, mk:'bulk' },
  { id:'fa2',  cat:'Fire Alarm', name:'14/2 FPLR NAC NM (wood) per ft',       unit:'FT', mat:0.48,    lhr:0.010, mk:'bulk' },
  { id:'fa3',  cat:'Fire Alarm', name:'16/2 SLC MC (metal) per ft',            unit:'FT', mat:1.25,    lhr:0.026, mk:'bulk' },
  { id:'fa4',  cat:'Fire Alarm', name:'14/2 NAC MC (metal) per ft',            unit:'FT', mat:1.10,    lhr:0.026, mk:'bulk' },
  { id:'fa5',  cat:'Fire Alarm', name:'14/4 Annunciator NM per ft',            unit:'FT', mat:0.96,    lhr:0.010, mk:'bulk' },
  { id:'fa6',  cat:'Fire Alarm', name:'14/4 Annunciator MC per ft',            unit:'FT', mat:2.20,    lhr:0.026, mk:'bulk' },

  // ── FIRE ALARM DEVICES ────────────────────────────────────────────────────
  { id:'fad1',  cat:'Fire Alarm', name:'FL Pull Station',                      unit:'EA', mat:55.00,   lhr:0.35, mk:'light' },
  { id:'fad2',  cat:'Fire Alarm', name:'FL Smoke Detector',                    unit:'EA', mat:100.00,  lhr:0.35, mk:'light' },
  { id:'fad3',  cat:'Fire Alarm', name:'FL Heat Detector',                     unit:'EA', mat:100.00,  lhr:0.35, mk:'light' },
  { id:'fad4',  cat:'Fire Alarm', name:'FL Smoke/CO Combo',                    unit:'EA', mat:175.00,  lhr:0.45, mk:'light' },
  { id:'fad5',  cat:'Fire Alarm', name:'FL Horn/Strobe',                       unit:'EA', mat:100.00,  lhr:0.35, mk:'light' },
  { id:'fad6',  cat:'Fire Alarm', name:'FL Strobe',                            unit:'EA', mat:100.00,  lhr:0.35, mk:'light' },
  { id:'fad7',  cat:'Fire Alarm', name:'FL LF Sounder',                        unit:'EA', mat:100.00,  lhr:0.35, mk:'light' },
  { id:'fad8',  cat:'Fire Alarm', name:'FL Beacon',                            unit:'EA', mat:75.00,   lhr:0.35, mk:'light' },
  { id:'fad9',  cat:'Fire Alarm', name:'FL Control/Monitor Module',            unit:'EA', mat:160.00,  lhr:0.45, mk:'light' },
  { id:'fad10', cat:'Fire Alarm', name:'FL Duct Smoke Detector',               unit:'EA', mat:250.00,  lhr:0.65, mk:'light' },
  { id:'fad11', cat:'Fire Alarm', name:'FL Annunciator',                       unit:'EA', mat:225.00,  lhr:1.00, mk:'light' },
  { id:'fad12', cat:'Fire Alarm', name:'FL Control Panel Small (4 ch)',        unit:'EA', mat:650.00,  lhr:3.00, mk:'light' },
  { id:'fad13', cat:'Fire Alarm', name:'FL Control Panel Medium (6 ch)',       unit:'EA', mat:650.00,  lhr:4.50, mk:'light' },
  { id:'fad14', cat:'Fire Alarm', name:'FL Control Panel Large (10 ch)',       unit:'EA', mat:1300.00, lhr:7.50, mk:'light' },
  { id:'fad15', cat:'Fire Alarm', name:'FL Radio Box',                         unit:'EA', mat:500.00,  lhr:1.00, mk:'light' },
  { id:'fad16', cat:'Fire Alarm', name:'FL Monitor Module',                    unit:'EA', mat:95.00,   lhr:0.45, mk:'bulk' },
  { id:'fad17', cat:'Fire Alarm', name:'Beam Detector (per quote)',            unit:'EA', mat:0.01,    lhr:0.75, mk:'bulk' },
  { id:'fad18', cat:'Fire Alarm', name:'FA Relay (door holder/elev)',          unit:'EA', mat:45.00,   lhr:0.45, mk:'bulk' },

  // ── LOW VOLTAGE ───────────────────────────────────────────────────────────
  { id:'lv1',  cat:'Low Voltage', name:'TSGB16 Strut Bracket',                 unit:'EA', mat:4.50,    lhr:0.10,  mk:'bulk' },
  { id:'lv2',  cat:'Low Voltage', name:'J-Hook Small (4")',                    unit:'EA', mat:4.00,    lhr:0.05,  mk:'bulk' },
  { id:'lv3',  cat:'Low Voltage', name:'J-Hook Large (7")',                    unit:'EA', mat:7.00,    lhr:0.05,  mk:'bulk' },
  { id:'lv4',  cat:'Low Voltage', name:'Zip Tie',                              unit:'EA', mat:0.05,    lhr:0.02,  mk:'bulk' },
  { id:'lvc1', cat:'Low Voltage', name:'LV Cable per ft (Cat6/Coax/2-wire)',   unit:'FT', mat:0.375,   lhr:0.010, mk:'bulk' },
  { id:'lvc2', cat:'Low Voltage', name:'LV Mud Ring / Bracket',               unit:'EA', mat:1.50,    lhr:0.10,  mk:'bulk' },
  { id:'lvc3', cat:'Low Voltage', name:'LV Staple',                           unit:'EA', mat:0.044,   lhr:0.02,  mk:'bulk' },
  { id:'pp1',  cat:'Low Voltage', name:'Patch Panel Small (12-24 port)',       unit:'EA', mat:125.00,  lhr:0.50,  mk:'bulk' },
  { id:'pp2',  cat:'Low Voltage', name:'Patch Panel Medium (48 port)',         unit:'EA', mat:250.00,  lhr:0.75,  mk:'bulk' },
  { id:'pp3',  cat:'Low Voltage', name:'Patch Panel Large (96 port)',          unit:'EA', mat:450.00,  lhr:1.00,  mk:'bulk' },
];

// ─────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────

const BOM_MAP = new Map<string, BomItem>(BOM.map(b => [b.id, b]));

// ── DB cache — populated by initBomCache() on app mount ──────────────────────
// Falls back to static BOM_MAP when cache is not yet populated.
let _bomCache: Map<string, BomItem> | null = null;

export async function initBomCache(): Promise<void> {
  try {
    const res = await fetch('/api/bom');
    if (!res.ok) return;
    const items = (await res.json()) as BomItem[];
    _bomCache = new Map(items.map(item => [item.id, item]));
  } catch {
    // network unavailable — keep using static BOM_MAP
  }
}

export function invalidateBomCache(): void {
  _bomCache = null;
}

export function getBomItem(id: string): BomItem {
  const item = (_bomCache ?? BOM_MAP).get(id);
  if (!item) throw new Error(`BOM item not found: "${id}"`);
  return item;
}

// ─────────────────────────────────────
// WIRE_MAP — wire material × size → BOM id
// Keys: '<material>_<size>'
// ─────────────────────────────────────

export const WIRE_MAP: Record<string, string> = {
  // THHN Cu
  thhn_14:  'w_14cu',
  thhn_12:  'w5',
  thhn_10:  'w_10cu',
  thhn_8:   'w_8cu',
  thhn_6:   'w8',
  thhn_4:   'w_4cu',
  thhn_3:   'w_3cu',
  thhn_2:   'w_2cu',
  thhn_1:   'w_1cu',
  'thhn_1/0': 'w_1_0cu',
  'thhn_2/0': 'w_2_0cu',
  'thhn_3/0': 'w_3_0cu',
  'thhn_4/0': 'w_4_0cu',
  thhn_250: 'w_250cu',
  thhn_350: 'w_350cu',
  thhn_400: 'w_400cu',
  thhn_500: 'w_500cu',
  thhn_600: 'w_600cu',
  // THHN Al
  al_2:     'w_2al',
  al_1:     'w_1al',
  'al_1/0': 'w_1_0al',
  'al_2/0': 'w_2_0al',
  'al_3/0': 'w_3_0al',
  'al_4/0': 'w_4_0al',
  al_250:   'w_250al',
  al_300:   'w_300al',
  al_350:   'w_350al',
  al_400:   'w_400al',
  al_500:   'w_500al',
  al_600:   'w_600al',
  // XHHW Al
  xhhw_2:   'w10',
  // MC Cable
  'mc_12/2': 'w1',
  'mc_12/3': 'w2',
  'mc_10/2': 'w3',
  'mc_10/3': 'w4',
  'mc_8/3':  'w4b',
  'mc_6/3':  'w4c',
  'mc_4/3':  'w4d',
  'mc_2/3':  'w4e',
  'mc_1/0':  'w4f',
  // NM-B Romex
  'nm_14/2': 'rm1',
  'nm_12/2': 'rm2',
  'nm_12/3': 'rm3',
  'nm_14/3': 'rm5',
  'nm_10/2': 'rm6',
  'nm_10/3': 'rm7',
};

// ─────────────────────────────────────
// COND_MAP — conduit type × size → entry
// Keys: '<type>_<size>'  (size: 12=1/2", 34=3/4", 1=1", 114=1-1/4", 112=1-1/2", 2=2", etc.)
// ftId: conduit body BOM id (EA = per 10-ft stick; FT = per foot)
// lhrFt: installation labor hours per foot (NECA-based)
// ─────────────────────────────────────

export type ConduitConnType = 'coupling' | 'connector' | 'elbow';

export interface ConduitMapEntry {
  ftId:   string;
  connId: Record<ConduitConnType, string>;
  lhrFt:  number;
}

export const COND_MAP: Record<string, ConduitMapEntry> = {
  // ── EMT (10-ft sticks, unit EA) ──────────────────────────────────────────
  emt_12:  { ftId:'e1',  connId:{ coupling:'ef4',  connector:'ef1',   elbow:'ef8'   }, lhrFt:N11.eb2       },
  emt_34:  { ftId:'e2',  connId:{ coupling:'ef5',  connector:'ef2',   elbow:'ef9'   }, lhrFt:N11.eb3       },
  emt_1:   { ftId:'e3',  connId:{ coupling:'ef4',  connector:'ef3',   elbow:'ef8'   }, lhrFt:0.050         },
  emt_114: { ftId:'e4',  connId:{ coupling:'ef13', connector:'ef10b', elbow:'ef10b' }, lhrFt:0.058         },
  emt_112: { ftId:'e5',  connId:{ coupling:'ef14', connector:'ef11',  elbow:'ef11'  }, lhrFt:0.065         },
  emt_2:   { ftId:'e6',  connId:{ coupling:'ef15', connector:'ef12',  elbow:'ef12'  }, lhrFt:0.075         },
  emt_212: { ftId:'e8',  connId:{ coupling:'ef15', connector:'ef12',  elbow:'ef12'  }, lhrFt:0.085         },
  emt_3:   { ftId:'e7',  connId:{ coupling:'ef15', connector:'ef12',  elbow:'ef12'  }, lhrFt:0.098         },
  emt_312: { ftId:'e9',  connId:{ coupling:'ef15', connector:'ef12',  elbow:'ef12'  }, lhrFt:0.110         },
  emt_4:   { ftId:'e10', connId:{ coupling:'ef15', connector:'ef12',  elbow:'ef12'  }, lhrFt:0.125         },

  // ── PVC Sch40 (per-foot, unit FT) ────────────────────────────────────────
  pvc_12:  { ftId:'pvc1', connId:{ coupling:'pvf1', connector:'pvf1', elbow:'pvf3'  }, lhrFt:N11.p34       },
  pvc_34:  { ftId:'pvc2', connId:{ coupling:'pvf2', connector:'pvf2', elbow:'pvf3'  }, lhrFt:0.042         },
  pvc_1:   { ftId:'pvc3', connId:{ coupling:'pvf4', connector:'pvf4', elbow:'pvf5'  }, lhrFt:N11.p1        },
  pvc_112: { ftId:'pvc4', connId:{ coupling:'pvf4', connector:'pvf4', elbow:'pvf5'  }, lhrFt:0.044         },
  pvc_2:   { ftId:'pvc5', connId:{ coupling:'pvf6', connector:'pvf6', elbow:'pvf7'  }, lhrFt:N11.p2        },
  pvc_3:   { ftId:'pvc6', connId:{ coupling:'pvf8', connector:'pvf8', elbow:'pvf8'  }, lhrFt:0.052         },
  pvc_4:   { ftId:'pvc7', connId:{ coupling:'pvf8', connector:'pvf8', elbow:'pvf8'  }, lhrFt:N11.p4        },

  // ── Rigid (10-ft sticks, unit EA) ────────────────────────────────────────
  rigid_12:  { ftId:'rg1', connId:{ coupling:'ln_12',  connector:'ln_12',  elbow:'ln_12'  }, lhrFt:0.050 },
  rigid_34:  { ftId:'rg2', connId:{ coupling:'ln_34',  connector:'ln_34',  elbow:'ln_34'  }, lhrFt:0.055 },
  rigid_1:   { ftId:'rg3', connId:{ coupling:'ln_1',   connector:'ln_1',   elbow:'ln_1'   }, lhrFt:0.065 },
  rigid_114: { ftId:'rg4', connId:{ coupling:'ln_114', connector:'ln_114', elbow:'ln_114' }, lhrFt:0.075 },
  rigid_112: { ftId:'rg5', connId:{ coupling:'ln_112', connector:'ln_112', elbow:'ln_112' }, lhrFt:0.085 },
  rigid_2:   { ftId:'rg6', connId:{ coupling:'ln_2',   connector:'ln_2',   elbow:'ln_2'   }, lhrFt:0.100 },
  rigid_3:   { ftId:'rg7', connId:{ coupling:'ln_3',   connector:'ln_3',   elbow:'ln_3'   }, lhrFt:0.120 },
  rigid_4:   { ftId:'rg8', connId:{ coupling:'ln_4',   connector:'ln_4',   elbow:'ln_4'   }, lhrFt:0.140 },

  // ── Liquid Tight (per-foot, unit FT) ─────────────────────────────────────
  lt_12: { ftId:'lt1', connId:{ coupling:'ltf1', connector:'ltf1', elbow:'ltf1' }, lhrFt:0.025 },
  lt_34: { ftId:'lt2', connId:{ coupling:'ltf2', connector:'ltf2', elbow:'ltf3' }, lhrFt:0.030 },
  lt_1:  { ftId:'lt3', connId:{ coupling:'ltf4', connector:'ltf4', elbow:'ltf4' }, lhrFt:0.035 },

  // ── Flex (per-foot, unit FT) ──────────────────────────────────────────────
  flex_12: { ftId:'flex12', connId:{ coupling:'flx1', connector:'flx1', elbow:'flx1' }, lhrFt:0.028 },
  flex_34: { ftId:'flex34', connId:{ coupling:'flx2', connector:'flx2', elbow:'flx2' }, lhrFt:0.033 },
  flex_1:  { ftId:'flex1',  connId:{ coupling:'flx3', connector:'flx3', elbow:'flx3' }, lhrFt:0.038 },
};

// ─────────────────────────────────────
// SUPP_MAP — support type × size → BOM id
// Keys: '<supportType>_<size>'
// ─────────────────────────────────────

export const SUPP_MAP: Record<string, string> = {
  // 1-hole straps
  strap_12:  'sp_emt12',
  strap_34:  'sp_emt34',
  strap_1:   'sp_emt1',
  strap_114: 'sp_emt114',
  strap_112: 'sp_emt112',
  strap_2:   'sp_emt2',
  // snap hangers
  hanger_12:  'sp_hng12',
  hanger_34:  'sp_hng34',
  hanger_1:   'sp_hng1',
  hanger_114: 'sp_hng114',
  hanger_112: 'sp_hng112',
  hanger_2:   'sp_hng2',
  // strut clips
  clip_34:  'sp_cli34',
  clip_114: 'sp_cli114',
  clip_2:   'sp_cli2',
  // click-it straps (for MC / NM)
  clickit_12: 'sc1',
  clickit_1:  'sc2',
  clickit_112:'sc3',
};
