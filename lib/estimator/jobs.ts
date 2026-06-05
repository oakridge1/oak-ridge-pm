import type { EstimatorState } from './state';
import { createNewState } from './state';
import { setRates } from './constants';

const JOBS_INDEX_KEY  = 'oakridge_jobs_index';
const JOB_PREFIX      = 'oakridge_job_';
const CURRENT_JOB_KEY = 'oakridge_current_job';
const SCHEMA_VERSION  = 2;

export interface JobMeta {
  jobId:     string;
  jobName:   string;
  jobNumber: string;
  savedAt:   string;
  version:   number;
}

function isClient(): boolean {
  return typeof window !== 'undefined';
}

function getIndex(): string[] {
  if (!isClient()) return [];
  try {
    return JSON.parse(localStorage.getItem(JOBS_INDEX_KEY) ?? '[]') as string[];
  } catch { return []; }
}

function setIndex(ids: string[]): void {
  if (!isClient()) return;
  localStorage.setItem(JOBS_INDEX_KEY, JSON.stringify(ids));
}

export function saveJob(state: EstimatorState): void {
  if (!isClient()) return;
  const key     = JOB_PREFIX + state.jobId;
  const payload = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    state,
  };
  localStorage.setItem(key, JSON.stringify(payload));

  const index = getIndex();
  if (!index.includes(state.jobId)) {
    index.unshift(state.jobId);
    setIndex(index);
  }

  localStorage.setItem(CURRENT_JOB_KEY, state.jobId);
}

export function loadJob(jobId: string): EstimatorState | null {
  if (!isClient()) return null;
  try {
    const raw = localStorage.getItem(JOB_PREFIX + jobId);
    if (!raw) return null;
    const payload = JSON.parse(raw) as { state: Partial<EstimatorState> };
    const state   = createNewState(payload.state);
    if (state.settings) setRates(state.settings);
    return state;
  } catch {
    return null;
  }
}

export function loadCurrentJob(): EstimatorState | null {
  if (!isClient()) return null;
  const currentId = localStorage.getItem(CURRENT_JOB_KEY);
  if (currentId) return loadJob(currentId);
  const index = getIndex();
  if (index.length > 0) return loadJob(index[0]);
  return null;
}

export function listJobs(): JobMeta[] {
  if (!isClient()) return [];
  const index = getIndex();
  const metas: JobMeta[] = [];
  for (const id of index) {
    try {
      const raw = localStorage.getItem(JOB_PREFIX + id);
      if (!raw) continue;
      const payload = JSON.parse(raw) as {
        state: { jobId: string; jobName?: string; jobNumber?: string };
        savedAt: string;
        version: number;
      };
      metas.push({
        jobId:     payload.state.jobId,
        jobName:   payload.state.jobName   ?? 'Unnamed',
        jobNumber: payload.state.jobNumber ?? '',
        savedAt:   payload.savedAt,
        version:   payload.version,
      });
    } catch { continue; }
  }
  return metas;
}

export function deleteJob(jobId: string): void {
  if (!isClient()) return;
  localStorage.removeItem(JOB_PREFIX + jobId);
  const index = getIndex().filter(id => id !== jobId);
  setIndex(index);
  if (localStorage.getItem(CURRENT_JOB_KEY) === jobId) {
    localStorage.removeItem(CURRENT_JOB_KEY);
  }
}

export function newJob(): EstimatorState {
  const state = createNewState();
  saveJob(state);
  return state;
}

export function exportJobJSON(state: EstimatorState): string {
  return JSON.stringify({
    version:    SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }, null, 2);
}

export function importJobJSON(json: string): EstimatorState | null {
  try {
    const payload = JSON.parse(json) as { state?: Partial<EstimatorState> & { jobName?: string } };
    if (!payload.state) return null;
    const state = createNewState({
      ...payload.state,
      jobId:   crypto.randomUUID(),
      jobName: (payload.state.jobName ?? 'Imported Job') + ' (imported)',
    });
    saveJob(state);
    return state;
  } catch {
    return null;
  }
}

// Debounced auto-save — call after any state mutation. Returns a cancel fn.
let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAutoSave(
  state: EstimatorState,
  delayMs = 1500,
): () => void {
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(() => {
    saveJob(state);
    _autoSaveTimer = null;
  }, delayMs);
  return () => {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
  };
}

