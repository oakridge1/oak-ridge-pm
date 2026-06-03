'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { useState, useRef } from 'react';
import type { JobMeta } from '@/lib/estimator/jobs';

// ── Relative time helper ───────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const s    = Math.floor(diff / 1000);
  if (s < 60)  return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d} day${d !== 1 ? 's' : ''} ago`;
  return new Date(isoString).toLocaleDateString();
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface JobsModalProps {
  open:    boolean;
  onClose: () => void;
}

// ── JobsModal ──────────────────────────────────────────────────────────────────

export function JobsModal({ open, onClose }: JobsModalProps) {
  const {
    state, setState,
    createNewJob, loadJob, deleteJob, listJobs,
    exportJob, importJob,
  } = useEstimatorContext();

  const [renamingId,  setRenamingId]  = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  // Re-compute on every render (listJobs reads localStorage)
  const jobs: JobMeta[] = listJobs().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );

  const isOnlyJob = jobs.length <= 1;

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleNew() {
    if (window.confirm('Start a new estimate? Current job is auto-saved.')) {
      createNewJob();
      onClose();
    }
  }

  function handleLoad(jobId: string) {
    loadJob(jobId);
    onClose();
  }

  function handleDelete(job: JobMeta) {
    if (!window.confirm(`Delete "${job.jobName || 'Unnamed Estimate'}"? This cannot be undone.`))
      return;
    deleteJob(job.jobId);
    if (job.jobId === state.jobId) {
      createNewJob();
    }
    // List re-computes on next render automatically
  }

  function handleExport() {
    const json = exportJob();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${state.jobName || 'estimate'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRenameStart(job: JobMeta) {
    setRenamingId(job.jobId);
    setRenameValue(job.jobName);
  }

  function handleRenameSave() {
    if (renamingId === state.jobId) {
      const newName = renameValue.trim() || 'Unnamed Estimate';
      setState(s => ({ ...s, jobName: newName }));
      // autosave picks it up within 1.5 s
    }
    setRenamingId(null);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json    = ev.target?.result as string;
      const success = importJob(json);
      if (success) {
        onClose();
      } else {
        setImportError('Failed to import — invalid file format.');
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col max-w-2xl w-full max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors shrink-0"
          >
            + New Estimate
          </button>
          <span className="text-lg font-bold text-[#1a3a5c] flex-1">
            Saved Estimates
          </span>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            × Close
          </button>
        </div>

        {/* ── BODY ────────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400">
              <p className="text-sm font-medium">No saved estimates yet.</p>
              <p className="text-xs mt-1">
                Start building to auto-save your first estimate.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {jobs.map(job => {
                const isCurrent  = job.jobId === state.jobId;
                const isRenaming = renamingId === job.jobId;

                return (
                  <div
                    key={job.jobId}
                    className={`flex items-center gap-3 py-3 px-3 rounded-lg border transition-colors group ${
                      isCurrent
                        ? 'bg-[#eef4ff] border-[#c0d4f0]'
                        : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    {/* LEFT — job info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isRenaming ? (
                          <input
                            type="text"
                            autoFocus
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            onBlur={handleRenameSave}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  handleRenameSave();
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="border border-blue-400 rounded px-2 py-0.5 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                          />
                        ) : (
                          <span
                            className={`font-semibold text-sm truncate ${
                              job.jobName
                                ? 'text-gray-900'
                                : 'italic text-gray-500'
                            }`}
                          >
                            {job.jobName || 'Unnamed Estimate'}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="shrink-0 text-xs bg-[#1a3a5c] text-white rounded-full px-2 py-0.5 font-medium leading-none">
                            Current
                          </span>
                        )}
                      </div>
                      {job.jobNumber && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          #{job.jobNumber}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        Saved {relativeTime(job.savedAt)}
                      </div>
                    </div>

                    {/* RIGHT — action buttons */}
                    <div
                      className={`flex items-center gap-1.5 shrink-0 transition-opacity ${
                        isCurrent
                          ? 'opacity-100'
                          : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {/* Load — non-current only */}
                      {!isCurrent && (
                        <button
                          onClick={() => handleLoad(job.jobId)}
                          className="text-xs px-2 py-1 rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors"
                        >
                          Load
                        </button>
                      )}

                      {/* Rename — only meaningful for current job */}
                      <button
                        onClick={() => isCurrent && handleRenameStart(job)}
                        disabled={!isCurrent}
                        title={!isCurrent ? 'Load this estimate first to rename.' : 'Rename'}
                        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Rename
                      </button>

                      {/* Export — current job only */}
                      {isCurrent && (
                        <button
                          onClick={handleExport}
                          className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          Export
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(job)}
                        disabled={isCurrent && isOnlyJob}
                        title={
                          isCurrent && isOnlyJob
                            ? 'Cannot delete the only estimate.'
                            : 'Delete'
                        }
                        className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
            >
              ⬆ Import JSON
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileRef}
              className="hidden"
              onChange={handleImport}
            />
            {importError && (
              <p className="text-xs text-red-600">{importError}</p>
            )}
          </div>
          <span className="text-xs text-gray-400 self-center">
            {jobs.length} saved estimate{jobs.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
