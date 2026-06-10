'use client';

import {
  useState, useCallback, useEffect, useRef,
  type Dispatch, type SetStateAction,
} from 'react';
import type { EstimatorState, LightingItem, GearItem, AssemblyTemplate } from './state';
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
  type JobMeta,
} from './jobs';
import { initBomCache } from './bom';
import { setRates } from './constants';
import type { SavedAssembly } from './constants';
import {
  calcConduitRun, calcRack, calcMCHomeRun, calcThreeWay,
  calcData, calcFireAlarm, calcLV, calcGear, calcFloorBox,
  calcHighAmpRecept, calcBid,
  type BidResult,
} from './calc';

// Suppress unused-import warning for defaults not yet used in add* functions.
type _Unused = typeof DEFAULT_CUSTOM_ASM | typeof DEFAULT_CUSTOM_DEV |
               typeof DEFAULT_CAN | typeof DEFAULT_TM;

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

  // ── Add assembly to bid ─────────────────────────────────────────
  addConduitRun:    () => boolean;
  addRack:          () => boolean;
  addMCHomeRun:     () => boolean;
  addThreeWay:      () => boolean;
  addDataLocation:  () => boolean;
  addFireAlarm:     () => boolean;
  addLVDevice:      () => boolean;
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

  // ── Assembly template saving ────────────────────────────────────
  saveAssemblyToJob:    (arrayKey: string, asmIndex: number) => void;
  saveAssemblyToMaster: (arrayKey: string, asmIndex: number) => void;

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
  updateFixtureState:  (patch: Partial<EstimatorState['fixtureState']>)  => void;

  // ── Lighting & gear schedule ────────────────────────────────────
  addLightingItem:    (item: Omit<LightingItem, 'id'>) => void;
  updateLightingItem: (id: string, updates: Partial<Omit<LightingItem, 'id'>>) => void;
  removeLightingItem: (id: string) => void;
  addGearItem:        (item: Omit<GearItem, 'id'>) => void;
  updateGearItem:     (id: string, updates: Partial<Omit<GearItem, 'id'>>) => void;
  removeGearItem:     (id: string) => void;

  // ── Section reorder ─────────────────────────────────────────────
  reorderAsmSections: (newOrder: string[]) => void;

  // ── Label system ────────────────────────────────────────────────
  setActiveLabel: (dimension: 'bidPackage' | 'area' | 'costCode', value: string) => void;
  addLabel:       (dimension: 'bidPackage' | 'area' | 'costCode', value: string) => void;
  removeLabel:    (dimension: 'bidPackage' | 'area' | 'costCode', value: string) => void;
}

export function useEstimator(): EstimatorActions {
  const [state, setState] = useState<EstimatorState>(() => {
    const loaded = loadCurrentJob();
    return loaded ?? createNewState();
  });

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

  useEffect(() => { initBomCache(); }, []);

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

  // ── Add to bid ───────────────────────────────────────────────────
  const addConduitRun = useCallback(() => {
    const result = calcConduitRun(state.condRunState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedRuns: [...s.savedRuns, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      condRunState: { ...DEFAULT_COND_RUN },
    }));
    return true;
  }, [state.condRunState]);

  const addRack = useCallback(() => {
    const result = calcRack(state.rackState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedRacks: [...s.savedRacks, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      rackState: { ...DEFAULT_RACK },
    }));
    return true;
  }, [state.rackState]);

  const addMCHomeRun = useCallback(() => {
    const result = calcMCHomeRun(state.mcHRState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedMCHR: [...s.savedMCHR, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      mcHRState: { ...DEFAULT_MCHR },
    }));
    return true;
  }, [state.mcHRState]);

  const addThreeWay = useCallback(() => {
    const result = calcThreeWay(state.threeWayState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedThreeWay: [...s.savedThreeWay, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      threeWayState: { ...DEFAULT_THREE_WAY },
    }));
    return true;
  }, [state.threeWayState]);

  const addDataLocation = useCallback(() => {
    const result = calcData(state.dataState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedData: [...s.savedData, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      dataState: { ...DEFAULT_DATA },
    }));
    return true;
  }, [state.dataState]);

  const addFireAlarm = useCallback(() => {
    const result = calcFireAlarm(state.faState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedFA: [...s.savedFA, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      faState: { ...DEFAULT_FA },
    }));
    return true;
  }, [state.faState]);

  const addLVDevice = useCallback(() => {
    const result = calcLV(state.lvState);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedLV: [...s.savedLV, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      lvState: { ...DEFAULT_LV },
    }));
    return true;
  }, [state.lvState]);

  const addGear = useCallback(() => {
    const result = calcGear(
      state.gearState as unknown as Parameters<typeof calcGear>[0]);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedGear: [...s.savedGear, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      gearState: { ...DEFAULT_GEAR },
    }));
    return true;
  }, [state.gearState]);

  const addFloorBox = useCallback(() => {
    const result = calcFloorBox(
      state.floorBoxState as unknown as Parameters<typeof calcFloorBox>[0]);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedFloorBox: [...s.savedFloorBox, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      floorBoxState: { ...DEFAULT_FLOOR_BOX },
    }));
    return true;
  }, [state.floorBoxState]);

  const addHighAmpRecept = useCallback(() => {
    const result = calcHighAmpRecept(
      state.harState as unknown as Parameters<typeof calcHighAmpRecept>[0]);
    if (!result) return false;
    setState(s => ({
      ...s,
      savedHAR: [...s.savedHAR, {
        ...result,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
      harState: { ...DEFAULT_HAR },
    }));
    return true;
  }, [state.harState]);

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

  // ── Assembly template saving ─────────────────────────────────────
  const saveAssemblyToJob = useCallback(
    (arrayKey: string, asmIndex: number) => {
      setState(s => {
        const asm = (s[arrayKey as keyof EstimatorState] as SavedAssembly[])[asmIndex];
        if (!asm) return s;
        const templateId = `${arrayKey}_template`;
        const template: AssemblyTemplate = {
          id:      templateId,
          label:   asm.label,
          lines:   [...asm.lines],
          savedAt: new Date().toISOString(),
          scope:   'job',
        };
        const existing = s.assemblyTemplates.filter(t => t.id !== templateId);
        return { ...s, assemblyTemplates: [...existing, template] };
      });
    },
    []
  );

  const saveAssemblyToMaster = useCallback(
    (arrayKey: string, asmIndex: number) => {
      setState(s => {
        const asm = (s[arrayKey as keyof EstimatorState] as SavedAssembly[])[asmIndex];
        if (!asm) return s;
        const templateId = `${arrayKey}_template`;
        const template: AssemblyTemplate = {
          id:      templateId,
          label:   asm.label,
          lines:   [...asm.lines],
          savedAt: new Date().toISOString(),
          scope:   'master',
        };
        try {
          const existing: AssemblyTemplate[] = JSON.parse(
            localStorage.getItem('ore_master_templates') ?? '[]'
          );
          const filtered = existing.filter(t => t.id !== templateId);
          localStorage.setItem(
            'ore_master_templates',
            JSON.stringify([...filtered, template])
          );
        } catch { /* ignore */ }
        return s; // master save is localStorage only — no state mutation
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
  const updateFixtureState  = useCallback((p: Partial<EstimatorState['fixtureState']>)  => patch(s => ({ fixtureState:  { ...s.fixtureState,  ...p } })), [patch]);

  // ── Lighting & gear schedule ─────────────────────────────────────
  const addLightingItemFn = useCallback(
    (item: Omit<LightingItem, 'id'>) => {
      setState(s => ({
        ...s,
        lightingSchedule: [...s.lightingSchedule, { ...item, id: crypto.randomUUID() }],
      }));
    }, []
  );

  const updateLightingItemFn = useCallback(
    (id: string, updates: Partial<Omit<LightingItem, 'id'>>) => {
      setState(s => ({
        ...s,
        lightingSchedule: s.lightingSchedule.map(i => i.id === id ? { ...i, ...updates } : i),
      }));
    }, []
  );

  const removeLightingItemFn = useCallback(
    (id: string) => {
      setState(s => ({
        ...s,
        lightingSchedule: s.lightingSchedule.filter(i => i.id !== id),
      }));
    }, []
  );

  const addGearItemFn = useCallback(
    (item: Omit<GearItem, 'id'>) => {
      setState(s => ({
        ...s,
        gearSchedule: [...s.gearSchedule, { ...item, id: crypto.randomUUID() }],
      }));
    }, []
  );

  const updateGearItemFn = useCallback(
    (id: string, updates: Partial<Omit<GearItem, 'id'>>) => {
      setState(s => ({
        ...s,
        gearSchedule: s.gearSchedule.map(i => i.id === id ? { ...i, ...updates } : i),
      }));
    }, []
  );

  const removeGearItemFn = useCallback(
    (id: string) => {
      setState(s => ({
        ...s,
        gearSchedule: s.gearSchedule.filter(i => i.id !== id),
      }));
    }, []
  );

  // ── Section reorder ──────────────────────────────────────────────
  const reorderAsmSections = useCallback(
    (newOrder: string[]) => patch({ asmSectionOrder: newOrder }),
    [patch]
  );

  // ── Label system ─────────────────────────────────────────────────
  const setActiveLabel = useCallback(
    (dimension: 'bidPackage' | 'area' | 'costCode', value: string) => {
      const key = dimension === 'bidPackage' ? 'activeBidPackage'
                : dimension === 'area'       ? 'activeArea'
                :                              'activeCostCode';
      patch({ [key]: value });
    },
    [patch]
  );

  const addLabel = useCallback(
    (dimension: 'bidPackage' | 'area' | 'costCode', value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const key = dimension === 'bidPackage' ? 'labelsBidPackage'
                : dimension === 'area'       ? 'labelsArea'
                :                              'labelsCostCode';
      setState(s => {
        const arr = s[key] as string[];
        if (arr.includes(trimmed)) return s;
        return { ...s, [key]: [...arr, trimmed] };
      });
    },
    []
  );

  const removeLabel = useCallback(
    (dimension: 'bidPackage' | 'area' | 'costCode', value: string) => {
      const key = dimension === 'bidPackage' ? 'labelsBidPackage'
                : dimension === 'area'       ? 'labelsArea'
                :                              'labelsCostCode';
      const activeKey = dimension === 'bidPackage' ? 'activeBidPackage'
                      : dimension === 'area'       ? 'activeArea'
                      :                              'activeCostCode';
      setState(s => {
        const arr = (s[key] as string[]).filter(v => v !== value);
        const active = s[activeKey] as string;
        return {
          ...s,
          [key]: arr,
          [activeKey]: active === value ? (arr[0] ?? '') : active,
        };
      });
    },
    []
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
    addConduitRun, addRack, addMCHomeRun, addThreeWay,
    addDataLocation, addFireAlarm, addLVDevice, addGear, addFloorBox,
    addHighAmpRecept,
    removeAssembly,
    updateAssemblyLine, addAssemblyLine, removeAssemblyLine,
    saveAssemblyToJob, saveAssemblyToMaster,
    calcBid: runCalcBid,
    updateCondRunState, updateRackState, updateMCHRState,
    updateThreeWayState, updateDataState, updateFAState,
    updateGearState, updateFloorBoxState, updateHARState,
    updateCanState, updateLVState, updateTMState, updateFixtureState,
    addLightingItem:    addLightingItemFn,
    updateLightingItem: updateLightingItemFn,
    removeLightingItem: removeLightingItemFn,
    addGearItem:        addGearItemFn,
    updateGearItem:     updateGearItemFn,
    removeGearItem:     removeGearItemFn,
    reorderAsmSections,
    setActiveLabel, addLabel, removeLabel,
  };
}
