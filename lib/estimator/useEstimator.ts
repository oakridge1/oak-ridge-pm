'use client';

import {
  useState, useCallback, useEffect, useRef,
  type Dispatch, type SetStateAction,
} from 'react';
import type { EstimatorState } from './state';
import {
  createNewState,
  DEFAULT_COND_RUN, DEFAULT_RACK, DEFAULT_MCHR,
  DEFAULT_THREE_WAY, DEFAULT_DATA, DEFAULT_FA,
  DEFAULT_GEAR, DEFAULT_FLOOR_BOX, DEFAULT_HAR,
  DEFAULT_CAN, DEFAULT_LV, DEFAULT_TM,
  DEFAULT_CUSTOM_ASM, DEFAULT_CUSTOM_DEV,
} from './state';
import {
  saveJob, loadJob as loadJobFn, loadCurrentJob, newJob, deleteJob,
  listJobs, exportJobJSON, importJobJSON,
  loadPriceOverrides, savePriceOverrides,
  type JobMeta, type PriceOverrides,
} from './jobs';
import { setRates } from './constants';
import type { SavedAssembly } from './constants';
import {
  calcConduitRun, calcRack, calcMCHomeRun, calcThreeWay,
  calcData, calcFireAlarm, calcGear, calcFloorBox,
  calcHighAmpRecept, calcBid,
  type BidResult,
} from './calc';

// Suppress unused-import warning for defaults not yet used in add* functions.
type _Unused = typeof DEFAULT_CUSTOM_ASM | typeof DEFAULT_CUSTOM_DEV |
               typeof DEFAULT_CAN | typeof DEFAULT_LV | typeof DEFAULT_TM;

export interface EstimatorActions {
  // ── State ───────────────────────────────────────────────────────
  state:    EstimatorState;
  setState: Dispatch<SetStateAction<EstimatorState>>;

  // ── Tab navigation ──────────────────────────────────────────────
  setTab: (tab: string) => void;

  // ── Job management ──────────────────────────────────────────────
  createNewJob:   () => void;
  saveCurrentJob: () => void;
  loadJob:        (jobId: string) => void;
  deleteJob:      (jobId: string) => void;
  listJobs:       () => JobMeta[];
  exportJob:      () => string;
  importJob:      (json: string) => boolean;

  // ── Settings ────────────────────────────────────────────────────
  updateSettings: (overrides: Partial<EstimatorState['settings']>) => void;

  // ── Price overrides ─────────────────────────────────────────────
  priceOverrides:     PriceOverrides;
  setPriceOverride:   (bomId: string, mat: number) => void;
  clearPriceOverride: (bomId: string) => void;

  // ── Add assembly to bid ─────────────────────────────────────────
  addConduitRun:    () => boolean;
  addRack:          () => boolean;
  addMCHomeRun:     () => boolean;
  addThreeWay:      () => boolean;
  addDataLocation:  () => boolean;
  addFireAlarm:     () => boolean;
  addGear:          () => boolean;
  addFloorBox:      () => boolean;
  addHighAmpRecept: () => boolean;

  // ── Remove assembly from saved array ───────────────────────────
  removeAssembly: (
    arrayKey: keyof Pick<EstimatorState,
      'savedRuns' | 'savedRacks' | 'savedMCHR' | 'savedThreeWay' |
      'savedData' | 'savedFA'   | 'savedCans'  | 'savedGear'     |
      'savedCustomDev' | 'savedTM' | 'savedLV' | 'savedCustomAsm' |
      'savedHAR' | 'savedFloorBox' | 'asms'    | 'savedPanels'>,
    index: number
  ) => void;

  // ── Inline assembly line editing ────────────────────────────────
  updateAssemblyLine: (
    arrayKey: keyof EstimatorState,
    asmIndex: number,
    lineIndex: number,
    field: 'name' | 'mat' | 'lab',
    value: string | number
  ) => void;
  addAssemblyLine: (
    arrayKey: keyof EstimatorState,
    asmIndex: number,
    name: string, mat: number, lab: number
  ) => void;
  removeAssemblyLine: (
    arrayKey: keyof EstimatorState,
    asmIndex: number,
    lineIndex: number
  ) => void;

  // ── Bid calculation ─────────────────────────────────────────────
  calcBid: () => BidResult;

  // ── Builder state updaters (generic) ───────────────────────────
  updateCondRunState:  (patch: Partial<EstimatorState['condRunState']>)  => void;
  updateRackState:     (patch: Partial<EstimatorState['rackState']>)     => void;
  updateMCHRState:     (patch: Partial<EstimatorState['mcHRState']>)     => void;
  updateThreeWayState: (patch: Partial<EstimatorState['threeWayState']>) => void;
  updateDataState:     (patch: Partial<EstimatorState['dataState']>)     => void;
  updateFAState:       (patch: Partial<EstimatorState['faState']>)       => void;
  updateGearState:     (patch: Partial<EstimatorState['gearState']>)     => void;
  updateFloorBoxState: (patch: Partial<EstimatorState['floorBoxState']>) => void;
  updateHARState:      (patch: Partial<EstimatorState['harState']>)      => void;
  updateCanState:      (patch: Partial<EstimatorState['canState']>)      => void;
  updateLVState:       (patch: Partial<EstimatorState['lvState']>)       => void;
  updateTMState:       (patch: Partial<EstimatorState['tmState']>)       => void;

  // ── Section reorder ─────────────────────────────────────────────
  reorderAsmSections: (newOrder: string[]) => void;
}

export function useEstimator(): EstimatorActions {
  const [state, setState] = useState<EstimatorState>(() => {
    const loaded = loadCurrentJob();
    return loaded ?? createNewState();
  });

  const [priceOverrides, setPriceOverrides] =
    useState<PriceOverrides>(() => loadPriceOverrides());

  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveJob(state);
    }, 1500);
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [state]);

  // ── Helpers ──────────────────────────────────────────────────────

  const patch = useCallback(
    (update: Partial<EstimatorState> | ((s: EstimatorState) => Partial<EstimatorState>)) => {
      setState(s => ({
        ...s,
        ...(typeof update === 'function' ? update(s) : update),
      }));
    },
    []
  );

  const pushToArray = useCallback(
    (key: keyof EstimatorState, item: SavedAssembly) => {
      setState(s => ({
        ...s,
        [key]: [...(s[key] as SavedAssembly[]), item],
      }));
    },
    []
  );

  // ── Tab ──────────────────────────────────────────────────────────
  const setTab = useCallback((tab: string) => patch({ tab }), [patch]);

  // ── Job management ───────────────────────────────────────────────
  const createNewJob = useCallback(() => {
    setState(newJob());
  }, []);

  const saveCurrentJob = useCallback(() => saveJob(state), [state]);

  const loadJobById = useCallback((jobId: string) => {
    const loaded = loadJobFn(jobId);
    if (loaded) setState(loaded);
  }, []);

  const deleteJobById = useCallback((jobId: string) => {
    deleteJob(jobId);
  }, []);

  const exportJob = useCallback(() => exportJobJSON(state), [state]);

  const importJob = useCallback((json: string) => {
    const imported = importJobJSON(json);
    if (imported) { setState(imported); return true; }
    return false;
  }, []);

  // ── Settings ─────────────────────────────────────────────────────
  const updateSettings = useCallback(
    (overrides: Partial<EstimatorState['settings']>) => {
      patch(s => {
        const updated = { ...s.settings, ...overrides };
        setRates(updated);
        return { settings: updated };
      });
    },
    [patch]
  );

  // ── Price overrides ──────────────────────────────────────────────
  const setPriceOverride = useCallback((bomId: string, mat: number) => {
    setPriceOverrides(prev => {
      const next = { ...prev, [bomId]: mat };
      savePriceOverrides(next);
      return next;
    });
  }, []);

  const clearPriceOverride = useCallback((bomId: string) => {
    setPriceOverrides(prev => {
      const next = { ...prev };
      delete next[bomId];
      savePriceOverrides(next);
      return next;
    });
  }, []);

  // ── Add to bid ───────────────────────────────────────────────────
  const addConduitRun = useCallback(() => {
    const result = calcConduitRun(state.condRunState);
    if (!result) return false;
    pushToArray('savedRuns', result);
    patch({ condRunState: { ...DEFAULT_COND_RUN } });
    return true;
  }, [state.condRunState, pushToArray, patch]);

  const addRack = useCallback(() => {
    const result = calcRack(state.rackState);
    if (!result) return false;
    pushToArray('savedRacks', result);
    patch({ rackState: { ...DEFAULT_RACK } });
    return true;
  }, [state.rackState, pushToArray, patch]);

  const addMCHomeRun = useCallback(() => {
    const result = calcMCHomeRun(state.mcHRState);
    if (!result) return false;
    pushToArray('savedMCHR', result);
    patch({ mcHRState: { ...DEFAULT_MCHR } });
    return true;
  }, [state.mcHRState, pushToArray, patch]);

  const addThreeWay = useCallback(() => {
    const result = calcThreeWay(state.threeWayState);
    if (!result) return false;
    pushToArray('savedThreeWay', result);
    patch({ threeWayState: { ...DEFAULT_THREE_WAY } });
    return true;
  }, [state.threeWayState, pushToArray, patch]);

  const addDataLocation = useCallback(() => {
    const result = calcData(state.dataState);
    if (!result) return false;
    pushToArray('savedData', result);
    patch({ dataState: { ...DEFAULT_DATA } });
    return true;
  }, [state.dataState, pushToArray, patch]);

  const addFireAlarm = useCallback(() => {
    const result = calcFireAlarm(
      state.faState as unknown as Parameters<typeof calcFireAlarm>[0]);
    if (!result) return false;
    pushToArray('savedFA', result);
    patch({ faState: { ...DEFAULT_FA } });
    return true;
  }, [state.faState, pushToArray, patch]);

  const addGear = useCallback(() => {
    const result = calcGear(
      state.gearState as unknown as Parameters<typeof calcGear>[0]);
    if (!result) return false;
    pushToArray('savedGear', result);
    patch({ gearState: { ...DEFAULT_GEAR } });
    return true;
  }, [state.gearState, pushToArray, patch]);

  const addFloorBox = useCallback(() => {
    const result = calcFloorBox(
      state.floorBoxState as unknown as Parameters<typeof calcFloorBox>[0]);
    if (!result) return false;
    pushToArray('savedFloorBox', result);
    patch({ floorBoxState: { ...DEFAULT_FLOOR_BOX } });
    return true;
  }, [state.floorBoxState, pushToArray, patch]);

  const addHighAmpRecept = useCallback(() => {
    const result = calcHighAmpRecept(
      state.harState as unknown as Parameters<typeof calcHighAmpRecept>[0]);
    if (!result) return false;
    pushToArray('savedHAR', result);
    patch({ harState: { ...DEFAULT_HAR } });
    return true;
  }, [state.harState, pushToArray, patch]);

  // ── Remove assembly ──────────────────────────────────────────────
  const removeAssembly = useCallback(
    (arrayKey: keyof EstimatorState, index: number) => {
      setState(s => {
        const arr = [...(s[arrayKey] as SavedAssembly[])];
        arr.splice(index, 1);
        return { ...s, [arrayKey]: arr };
      });
    },
    []
  );

  // ── Inline line editing ──────────────────────────────────────────
  const updateAssemblyLine = useCallback(
    (
      arrayKey: keyof EstimatorState,
      asmIndex: number,
      lineIndex: number,
      field: 'name' | 'mat' | 'lab',
      value: string | number
    ) => {
      setState(s => {
        const arr = [...(s[arrayKey] as SavedAssembly[])];
        const asm = { ...arr[asmIndex] };
        const lines = [...asm.lines];
        lines[lineIndex] = { ...lines[lineIndex], [field]: value };
        const newMat = lines.reduce((sum, l) => sum + (l.mat ?? 0), 0);
        const newLab = lines.reduce((sum, l) => sum + (l.lab ?? 0), 0);
        arr[asmIndex] = { ...asm, lines, mat: newMat, lab: newLab, _edited: true };
        return { ...s, [arrayKey]: arr };
      });
    },
    []
  );

  const addAssemblyLine = useCallback(
    (
      arrayKey: keyof EstimatorState,
      asmIndex: number,
      name: string,
      mat: number,
      lab: number
    ) => {
      setState(s => {
        const arr = [...(s[arrayKey] as SavedAssembly[])];
        const asm = { ...arr[asmIndex] };
        const lines = [...asm.lines, { name, qty: 1, unit: 'EA', mat, lab }];
        const newMat = lines.reduce((sum, l) => sum + (l.mat ?? 0), 0);
        const newLab = lines.reduce((sum, l) => sum + (l.lab ?? 0), 0);
        arr[asmIndex] = { ...asm, lines, mat: newMat, lab: newLab, _edited: true };
        return { ...s, [arrayKey]: arr };
      });
    },
    []
  );

  const removeAssemblyLine = useCallback(
    (arrayKey: keyof EstimatorState, asmIndex: number, lineIndex: number) => {
      setState(s => {
        const arr = [...(s[arrayKey] as SavedAssembly[])];
        const asm = { ...arr[asmIndex] };
        const lines = asm.lines.filter((_, i) => i !== lineIndex);
        const newMat = lines.reduce((sum, l) => sum + (l.mat ?? 0), 0);
        const newLab = lines.reduce((sum, l) => sum + (l.lab ?? 0), 0);
        arr[asmIndex] = { ...asm, lines, mat: newMat, lab: newLab, _edited: true };
        return { ...s, [arrayKey]: arr };
      });
    },
    []
  );

  // ── Bid calc ─────────────────────────────────────────────────────
  const runCalcBid = useCallback((): BidResult => {
    return calcBid({
      conduitRuns:    state.savedRuns,
      racks:          state.savedRacks,
      mcHomeRuns:     state.savedMCHR,
      threeWays:      state.savedThreeWay,
      dataDrops:      state.savedData,
      fireAlarm:      state.savedFA,
      gear:           [...state.savedGear, ...state.savedPanels],
      floorBoxes:     state.savedFloorBox,
      highAmpRecepts: state.savedHAR,
      misc: [
        ...state.savedCans,
        ...state.savedCustomDev,
        ...state.savedTM,
        ...state.savedLV,
        ...state.savedCustomAsm,
      ],
      lighting:    state.asms,
      heating:     [],
      tempPower:   [],
      underground: [],
      other:       [],
      condMult: state.jobCondMult,
    });
  }, [state]);

  // ── Builder state updaters ───────────────────────────────────────
  const updateCondRunState  = useCallback((p: Partial<EstimatorState['condRunState']>)  => patch(s => ({ condRunState:  { ...s.condRunState,  ...p } })), [patch]);
  const updateRackState     = useCallback((p: Partial<EstimatorState['rackState']>)     => patch(s => ({ rackState:     { ...s.rackState,     ...p } })), [patch]);
  const updateMCHRState     = useCallback((p: Partial<EstimatorState['mcHRState']>)     => patch(s => ({ mcHRState:     { ...s.mcHRState,     ...p } })), [patch]);
  const updateThreeWayState = useCallback((p: Partial<EstimatorState['threeWayState']>) => patch(s => ({ threeWayState: { ...s.threeWayState, ...p } })), [patch]);
  const updateDataState     = useCallback((p: Partial<EstimatorState['dataState']>)     => patch(s => ({ dataState:     { ...s.dataState,     ...p } })), [patch]);
  const updateFAState       = useCallback((p: Partial<EstimatorState['faState']>)       => patch(s => ({ faState:       { ...s.faState,       ...p } })), [patch]);
  const updateGearState     = useCallback((p: Partial<EstimatorState['gearState']>)     => patch(s => ({ gearState:     { ...s.gearState,     ...p } })), [patch]);
  const updateFloorBoxState = useCallback((p: Partial<EstimatorState['floorBoxState']>) => patch(s => ({ floorBoxState: { ...s.floorBoxState, ...p } })), [patch]);
  const updateHARState      = useCallback((p: Partial<EstimatorState['harState']>)      => patch(s => ({ harState:      { ...s.harState,      ...p } })), [patch]);
  const updateCanState      = useCallback((p: Partial<EstimatorState['canState']>)      => patch(s => ({ canState:      { ...s.canState,      ...p } })), [patch]);
  const updateLVState       = useCallback((p: Partial<EstimatorState['lvState']>)       => patch(s => ({ lvState:       { ...s.lvState,       ...p } })), [patch]);
  const updateTMState       = useCallback((p: Partial<EstimatorState['tmState']>)       => patch(s => ({ tmState:       { ...s.tmState,       ...p } })), [patch]);

  // ── Section reorder ──────────────────────────────────────────────
  const reorderAsmSections = useCallback(
    (newOrder: string[]) => patch({ asmSectionOrder: newOrder }),
    [patch]
  );

  return {
    state, setState,
    setTab,
    createNewJob, saveCurrentJob,
    loadJob: loadJobById,
    deleteJob: deleteJobById,
    listJobs,
    exportJob, importJob,
    updateSettings,
    priceOverrides, setPriceOverride, clearPriceOverride,
    addConduitRun, addRack, addMCHomeRun, addThreeWay,
    addDataLocation, addFireAlarm, addGear, addFloorBox,
    addHighAmpRecept,
    removeAssembly,
    updateAssemblyLine, addAssemblyLine, removeAssemblyLine,
    calcBid: runCalcBid,
    updateCondRunState, updateRackState, updateMCHRState,
    updateThreeWayState, updateDataState, updateFAState,
    updateGearState, updateFloorBoxState, updateHARState,
    updateCanState, updateLVState, updateTMState,
    reorderAsmSections,
  };
}
