import { DEFAULTS, type RateConfig } from './constants';
import type { SavedAssembly } from './constants';
import type {
  ConduitRunParams, RackParams, MCHomeRunParams,
  ThreeWayParams, DataParams, FireAlarmParams,
  GearParams, FloorBoxParams, HighAmpReceptParams,
} from './calc';

// Suppress unused-import lint for param types kept as future mapping references.
type _CalcParamRefs = FireAlarmParams | GearParams | FloorBoxParams | HighAmpReceptParams;

// ─────────────────────────────────────
// Builder state types
// ─────────────────────────────────────

// ConduitRunParams already includes qty; re-declared here for explicitness.
export interface ConduitRunState extends ConduitRunParams {
  qty: number;
}

export interface RackState extends RackParams {}

export interface MCHomeRunState extends MCHomeRunParams {}

export interface ThreeWayState extends ThreeWayParams {}

export interface DataState extends DataParams {}

// These four state shapes are richer than the corresponding calc params.
// The mapping layer translates state → params before calling calc functions.

export interface FireAlarmState {
  frameType:   'wood' | 'metal' | 'pipe';
  circuitType: 'slc' | 'nac' | 'ann';
  deviceId:    string;
  pricing:     string;
  whipFt:      number;
  homeRun:     boolean;
  qty:         number;
  diff:        number;
}

export interface GearState {
  gearType:    string;
  gearSubtype: string;
  mountMat:    number;
  kva:         string;
  desc:        string;
  qty:         number;
  diff:        number;
  nema3r:      boolean;
  fuseInstall: boolean;
}

export interface FloorBoxState {
  substrate: 'wood' | 'concrete_new' | 'concrete_core';
  gangs:     number;
  mountMat:  number;
  qty:       number;
  diff:      number;
}

export interface HighAmpReceptState {
  receptType: string;
  cableId:    string;
  boxId:      string;
  whipFt:     number;
  qty:        number;
  diff:       number;
}

export interface PullCanState {
  canSize:     'small' | 'medium' | 'large' | 'xl';
  mountMethod: 'wall' | 'ceiling';
  mountMat:    number;
  qty:         number;
  diff:        number;
}

export interface LVState {
  deviceType: 'camera' | 'reader' | 'intercom' | 'av' | 'speaker' | 'doorbell';
  location:   'indoor' | 'outdoor';
  feet:       number;
  makeup:     number;
  qty:        number;
  diff:       number;
}

export interface TMState {
  desc:   string;
  mat:    number;
  lab:    number;
  markup: 'bulk' | 'light' | 'none';
}

export interface CustomAsmState {
  label: string;
  lines: Array<{ name: string; qty: number; unit: string; mat: number; lab: number }>;
}

export interface CustomDevState {
  devBomId:  string;
  cableType: 'mc' | 'romex';
  cableId:   string;
  boxId:     string;
  whipFt:    number;
  qty:       number;
  diff:      number;
}

// ─────────────────────────────────────
// Job info (for Convert to PM)
// ─────────────────────────────────────

export interface JobInfo {
  address:           string;
  city:              string;
  state:             string;
  zip:               string;
  gcCompany:         string;
  gcContactName:     string;
  gcPhone:           string;
  gcEmail:           string;
  ownerName:         string;
  ownerPhone:        string;
  ownerEmail:        string;
  scopeOfWork:       string;
  contractStartDate: string;
  completionDate:    string;
  permitNumber:      string;
  inspectionContact: string;
  inspectionPhone:   string;
  contractValue:     number;
}

export const DEFAULT_JOB_INFO: JobInfo = {
  address: '', city: '', state: '', zip: '',
  gcCompany: '', gcContactName: '', gcPhone: '', gcEmail: '',
  ownerName: '', ownerPhone: '', ownerEmail: '',
  scopeOfWork: '', contractStartDate: '', completionDate: '',
  permitNumber: '', inspectionContact: '', inspectionPhone: '',
  contractValue: 0,
};

// ─────────────────────────────────────
// Permit & sub line items
// ─────────────────────────────────────

export interface PermitLine {
  id:   string;
  desc: string;
  cost: number;
}

export interface SubLine {
  id:   string;
  desc: string;
  cost: number;
}

// ─────────────────────────────────────
// Takeoff line (Takeoff tab)
// ─────────────────────────────────────

export interface TakeoffLine {
  id:       string;
  category: string;
  name:     string;
  qty:      number;
  note:     string;
}

// ─────────────────────────────────────
// Main state type
// ─────────────────────────────────────

export interface EstimatorState {
  // ── Meta ──────────────────────────────────────────────────────
  jobId:     string;
  jobName:   string;
  jobNumber: string;
  tab:       string;
  jobInfo:   JobInfo;

  // ── Settings (live rate overrides) ────────────────────────────
  settings: RateConfig;

  // ── Takeoff tab ───────────────────────────────────────────────
  takeoff: TakeoffLine[];

  // ── Saved assembly arrays (one per builder) ───────────────────
  savedRuns:      SavedAssembly[];
  savedRacks:     SavedAssembly[];
  savedMCHR:      SavedAssembly[];
  savedThreeWay:  SavedAssembly[];
  savedData:      SavedAssembly[];
  savedFA:        SavedAssembly[];
  savedCans:      SavedAssembly[];
  savedGear:      SavedAssembly[];
  savedCustomDev: SavedAssembly[];
  savedTM:        SavedAssembly[];
  savedLV:        SavedAssembly[];
  savedCustomAsm: SavedAssembly[];
  savedHAR:       SavedAssembly[];
  savedFloorBox:  SavedAssembly[];
  asms:           SavedAssembly[];

  // ── Permits & subs ────────────────────────────────────────────
  permits: PermitLine[];
  subs:    SubLine[];

  // ── Bid conditions ────────────────────────────────────────────
  jobCondMult: number;
  heightAdder: boolean;

  // ── Builder current-form states ───────────────────────────────
  condRunState:   ConduitRunState;
  rackState:      RackState;
  mcHRState:      MCHomeRunState;
  threeWayState:  ThreeWayState;
  dataState:      DataState;
  faState:        FireAlarmState;
  gearState:      GearState;
  floorBoxState:  FloorBoxState;
  harState:       HighAmpReceptState;
  canState:       PullCanState;
  lvState:        LVState;
  tmState:        TMState;
  customAsmState: CustomAsmState;
  customDevState: CustomDevState;

  // ── Edit indices (-1 = new, >= 0 = editing that index) ───────
  editRunIdx:       number;
  editRackIdx:      number;
  editHRIdx:        number;
  editTWIdx:        number;
  editDataIdx:      number;
  editFAIdx:        number;
  editCanIdx:       number;
  editGearIdx:      number;
  editCustomDevIdx: number;
  editTMIdx:        number;
  editLVIdx:        number;
  editCustomAsmIdx: number;

  // ── Assembly section order (drag-to-reorder) ──────────────────
  asmSectionOrder: string[];
}

// ─────────────────────────────────────
// Default builder states
// ─────────────────────────────────────

export const DEFAULT_COND_RUN: ConduitRunState = {
  condType: 'EMT', condSize: '3/4', numCond: 3,
  wireSize: '#12', wireMat: 'Cu', suppType: '1-Hole Strap',
  feet: 0, makeup: 0, qty: 1, spliceBox: false,
  underground: false, sandBed: false, warnTape: false,
  gndWire: 'none', gndMat: 'Cu', diff: 1.0,
};

export const DEFAULT_RACK: RackState = {
  mountType: 'wall', rackSize: '24', rodLength: 'none',
  qty: 1, caps: false, diff: 1.0,
};

export const DEFAULT_MCHR: MCHomeRunState = {
  wireSize: '#12', numCond: 2, bkrSize: '20A',
  suppType: 'Staple', feet: 0, makeup: 0, diff: 1.0,
};

export const DEFAULT_THREE_WAY: ThreeWayState = {
  swType: 'standard', travelerFt: 0, lumFt: 0, diff: 1.0,
};

export const DEFAULT_DATA: DataState = {
  ports: 1, emtDrop: false, support: 'J-Hook Small',
  feet: 0, makeup: 0, patchPanel: 'none', diff: 1.0,
};

export const DEFAULT_FA: FireAlarmState = {
  frameType: 'metal', circuitType: 'slc', deviceId: 'fad2',
  pricing: 'firelite', whipFt: 35, homeRun: false,
  qty: 1, diff: 1.0,
};

export const DEFAULT_GEAR: GearState = {
  gearType: 'panel', gearSubtype: 'small', mountMat: 75,
  kva: '', desc: '', qty: 1, diff: 1.0,
  nema3r: false, fuseInstall: false,
};

export const DEFAULT_FLOOR_BOX: FloorBoxState = {
  substrate: 'wood', gangs: 1, mountMat: 0, qty: 1, diff: 1.0,
};

export const DEFAULT_HAR: HighAmpReceptState = {
  receptType: 'recept_30a', cableId: 'w3',
  boxId: 'b1', whipFt: 20, qty: 1, diff: 1.0,
};

export const DEFAULT_CAN: PullCanState = {
  canSize: 'medium', mountMethod: 'wall',
  mountMat: 25, qty: 1, diff: 1.0,
};

export const DEFAULT_LV: LVState = {
  deviceType: 'camera', location: 'indoor',
  feet: 0, makeup: 0, qty: 1, diff: 1.0,
};

export const DEFAULT_TM: TMState = {
  desc: '', mat: 0, lab: 0, markup: 'bulk',
};

export const DEFAULT_CUSTOM_ASM: CustomAsmState = {
  label: '', lines: [],
};

export const DEFAULT_CUSTOM_DEV: CustomDevState = {
  devBomId: 'd1', cableType: 'mc', cableId: 'w1',
  boxId: 'b1', whipFt: 20, qty: 1, diff: 1.0,
};

export const DEFAULT_ASM_SECTION_ORDER = [
  'conduit', 'rack', 'mchr', 'threeway', 'data',
  'fa', 'can', 'lv', 'har', 'floorbox',
  'tm', 'custom', 'customdev',
];

// ─────────────────────────────────────
// Factory function
// ─────────────────────────────────────

export function createNewState(overrides?: Partial<EstimatorState>): EstimatorState {
  return {
    jobId:     crypto.randomUUID(),
    jobName:   'New Job',
    jobNumber: '',
    tab:       'takeoff',
    jobInfo:   { ...DEFAULT_JOB_INFO },
    settings:  { ...DEFAULTS },
    takeoff:   [],
    savedRuns:      [], savedRacks:     [], savedMCHR:      [],
    savedThreeWay:  [], savedData:      [], savedFA:        [],
    savedCans:      [], savedGear:      [], savedCustomDev: [],
    savedTM:        [], savedLV:        [], savedCustomAsm: [],
    savedHAR:       [], savedFloorBox:  [], asms:           [],
    permits: [],
    subs:    [],
    jobCondMult: 1.0,
    heightAdder: false,
    condRunState:   { ...DEFAULT_COND_RUN },
    rackState:      { ...DEFAULT_RACK },
    mcHRState:      { ...DEFAULT_MCHR },
    threeWayState:  { ...DEFAULT_THREE_WAY },
    dataState:      { ...DEFAULT_DATA },
    faState:        { ...DEFAULT_FA },
    gearState:      { ...DEFAULT_GEAR },
    floorBoxState:  { ...DEFAULT_FLOOR_BOX },
    harState:       { ...DEFAULT_HAR },
    canState:       { ...DEFAULT_CAN },
    lvState:        { ...DEFAULT_LV },
    tmState:        { ...DEFAULT_TM },
    customAsmState: { ...DEFAULT_CUSTOM_ASM },
    customDevState: { ...DEFAULT_CUSTOM_DEV },
    editRunIdx:       -1,
    editRackIdx:      -1,
    editHRIdx:        -1,
    editTWIdx:        -1,
    editDataIdx:      -1,
    editFAIdx:        -1,
    editCanIdx:       -1,
    editGearIdx:      -1,
    editCustomDevIdx: -1,
    editTMIdx:        -1,
    editLVIdx:        -1,
    editCustomAsmIdx: -1,
    asmSectionOrder: [...DEFAULT_ASM_SECTION_ORDER],
    ...overrides,
  };
}
