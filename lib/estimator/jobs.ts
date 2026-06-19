import { generateId } from '@/lib/utils/uuid';
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

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

// Notify listeners (e.g. EstimatorShell) of cloud sync status. Fires the
// optional callback AND a window event so the autosave path — which calls
// saveJob without a callback — still drives the UI indicator.
function emitSync(status: SyncStatus, cb?: (s: SyncStatus) => void): void {
  cb?.(status);
  if (isClient()) {
    window.dispatchEvent(new CustomEvent('estimator-sync-status', { detail: { status } }));
  }
}

export function saveJob(
  state: EstimatorState,
  onSyncStatus?: (status: SyncStatus) => void,
): void {
  if (!isClient()) return;

  // 1. localStorage — primary, fast, source of truth on this device.
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

  // 2. Cloud sync — background, best-effort. Never blocks the local save.
  emitSync('saving', onSyncStatus);
  fetch('/api/estimator-jobs', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jobId:     state.jobId,
      jobName:   state.jobName   || '',
      jobNumber: state.jobNumber || '',
      data:      state,
    }),
  })
    .then((res) => emitSync(res.ok ? 'saved' : 'error', onSyncStatus))
    .catch(() => emitSync('error', onSyncStatus)); // offline — localStorage already holds it
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

// Fetch a single job from the cloud, hydrate it, and cache to localStorage.
export async function loadJobFromCloud(jobId: string): Promise<EstimatorState | null> {
  if (!isClient()) return null;
  try {
    const res = await fetch(`/api/estimator-jobs/${jobId}`);
    if (!res.ok) return null;
    const record = await res.json();
    if (!record?.data) return null;
    const state = createNewState(record.data as Partial<EstimatorState>);
    if (state.settings) setRates(state.settings);
    // Cache locally for fast subsequent access.
    const payload = {
      version: SCHEMA_VERSION,
      savedAt: record.savedAt,
      state,
    };
    localStorage.setItem(JOB_PREFIX + jobId, JSON.stringify(payload));
    return state;
  } catch {
    return null;
  }
}

// List the current user's jobs from the cloud as JobMeta[].
export async function listJobsFromCloud(): Promise<JobMeta[]> {
  if (!isClient()) return [];
  try {
    const res = await fetch('/api/estimator-jobs');
    if (!res.ok) return [];
    const records = await res.json();
    return (records as Array<{
      jobId:     string;
      jobName:   string;
      jobNumber: string;
      updatedAt: string;
    }>).map((r) => ({
      jobId:     r.jobId,
      jobName:   r.jobName,
      jobNumber: r.jobNumber,
      savedAt:   r.updatedAt,
      version:   SCHEMA_VERSION,
    }));
  } catch {
    return [];
  }
}

// True when this device already has at least one estimate in localStorage.
export function hasLocalJobs(): boolean {
  return getIndex().length > 0;
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

  // Delete from cloud too — best-effort, non-blocking.
  fetch(`/api/estimator-jobs/${jobId}`, { method: 'DELETE' }).catch(() => {});
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
      jobId:   generateId(),
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

