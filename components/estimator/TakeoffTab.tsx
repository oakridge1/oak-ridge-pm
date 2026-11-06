'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { useEffect, useRef, useState } from 'react';
import { RidgeSyncPanel } from './RidgeSyncPanel';
import { DropsPreviewPanel } from './DropsPreviewPanel';
import {
  ITEM_LABELS, ITEM_CATEGORY, FOOTAGE_ITEMS,
  CATEGORY_LABELS, CAT_ORDER, normalizeTakeoffCounts, ITEM_BUILD,
} from '@/lib/estimator/takeoffConstants';

// Translate alias keys to real item ids in imported areas too, so the By Area
// list agrees with the totals.
function normalizeAreas(
  areas: Array<{ areaName: string; counts: Record<string, number> }>,
): Array<{ areaName: string; counts: Record<string, number> }> {
  return areas.map(a => ({ ...a, counts: normalizeTakeoffCounts(a.counts ?? {}) }));
}

type TakeoffArea = { areaName: string; counts: Record<string, number> };

// A pending import waiting for the "Add / Replace / Cancel" choice.
interface PendingImport {
  totals:     Record<string, number>;   // already alias-normalized
  areas:      TakeoffArea[];            // already alias-normalized
  source:     string;
  jobName:    string;
  onApplied?: () => void;               // e.g. mark the sync as seen, offer labels
}

const LAST_IMPORT_KEY = 'ore_takeoff_last_import';

// Same source + same totals => same import (key order does not matter).
function importSignature(source: string, totals: Record<string, number>): string {
  const sorted = Object.keys(totals).sort().map(k => [k, totals[k]]);
  return JSON.stringify([source, sorted]);
}

function lastImportSignature(): string | null {
  try { return localStorage.getItem(LAST_IMPORT_KEY); } catch { return null; }
}

function rememberImport(sig: string) {
  try { localStorage.setItem(LAST_IMPORT_KEY, sig); } catch { /* private browsing — ignore */ }
}

function addCounts(
  a: Record<string, number>, b: Record<string, number>,
): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = typeof out[k] === 'number' && typeof v === 'number' ? out[k] + v : v;
  }
  return out;
}

// Areas with the same name (ignoring case/spacing) have their counts added;
// new areas are appended.
function addAreas(existing: TakeoffArea[], incoming: TakeoffArea[]): TakeoffArea[] {
  const out = existing.map(a => ({ ...a, counts: { ...a.counts } }));
  for (const inc of incoming) {
    const name = (inc.areaName ?? '').trim().toLowerCase();
    const hit = out.find(a => (a.areaName ?? '').trim().toLowerCase() === name);
    if (hit) hit.counts = addCounts(hit.counts, inc.counts ?? {});
    else out.push({ ...inc, counts: { ...(inc.counts ?? {}) } });
  }
  return out;
}

// Build buttons: which builder each item loads into (and with what) comes from the
// "build" field in public/takeoff-items.json, read through ITEM_BUILD.

// ── TakeoffTab ─────────────────────────────────────────────────────────────────

export function TakeoffTab() {
  const { state, setState, setTab, setActiveLabel, addLabel, updateFAState, updateLVState, updateDataState, updateFixtureState } = useEstimatorContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [syncPayload, setSyncPayload] = useState<{
    source: string;
    jobName: string;
    totals: Record<string, number>;
    timestamp: number;
    areas: Array<{ areaName: string; counts: Record<string, number> }>;
    activeBidPackage?: string;
    activeArea?:       string;
    activeCostCode?:   string;
  } | null>(null);
  const [labelConfirmPayload, setLabelConfirmPayload] = useState<{
    bidPackage: string;
    area:       string;
    costCode:   string;
  } | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [confirmSame,   setConfirmSame]   = useState(false);

  useEffect(() => {
    function checkSync() {
      try {
        const raw = localStorage.getItem('ore_estimator_sync');
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (!payload.timestamp) return;
        const lastSync = parseInt(
          localStorage.getItem('ore_estimator_sync_last') ?? '0'
        );
        if (payload.timestamp <= lastSync) return;
        setSyncPayload(payload);
      } catch {}
    }
    checkSync();
    const interval = setInterval(checkSync, 3000);
    return () => clearInterval(interval);
  }, []);

  // BroadcastChannel — instant sync path (localStorage poll above stays as fallback)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('ore_tools');
    channel.onmessage = (e) => {
      if (e.data?.type === 'SYNC_COUNTS') {
        setSyncPayload(e.data.payload);
      }
      // LABELS_CHANGED / JOB_CONTEXT originate from the estimator — no action here
    };
    return () => channel.close();
  }, []);

  const counts  = state.takeoffCounts;
  const hasData = Object.keys(counts).length > 0;

  // ── Import: Add / Replace / Cancel ─────────────────────────────────────────

  function applyImport(p: PendingImport, mode: 'add' | 'replace') {
    setState(s => ({
      ...s,
      takeoffCounts: mode === 'add' ? addCounts(s.takeoffCounts, p.totals) : p.totals,
      takeoffAreas:  mode === 'add' ? addAreas(s.takeoffAreas, p.areas)    : p.areas,
      takeoffSource:
        mode === 'add' && s.takeoffSource && !s.takeoffSource.includes(p.source)
          ? `${s.takeoffSource} + ${p.source}`
          : mode === 'add' && s.takeoffSource ? s.takeoffSource : p.source,
      jobName:
        s.jobName === 'New Job' || s.jobName === '' ? (p.jobName || s.jobName) : s.jobName,
    }));
    rememberImport(importSignature(p.source, p.totals));
    setImportError(null);
    p.onApplied?.();
  }

  // No existing counts: import straight away, as before. Otherwise ask first.
  function requestImport(p: PendingImport) {
    if (!hasData) { applyImport(p, 'replace'); return; }
    setConfirmSame(false);
    setPendingImport(p);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = JSON.parse(ev.target?.result as string) as any;
        if (!json.totals || typeof json.totals !== 'object') {
          setImportError('Invalid file — missing totals object.');
          return;
        }
        setImportError(null);
        requestImport({
          totals:  normalizeTakeoffCounts(json.totals as Record<string, number>),
          areas:   Array.isArray(json.areas) ? normalizeAreas(json.areas) : [],
          source:
            `Counter export — ${json.exportDate ?? 'unknown date'}` +
            (json.jobName ? ` (${json.jobName as string})` : ''),
          jobName: (json.jobName as string | undefined) ?? '',
        });
      } catch {
        setImportError('Failed to parse file — is it a valid counter JSON?');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Clear handler ──────────────────────────────────────────────────────────

  function handleClear() {
    if (!window.confirm('Clear all takeoff counts? This cannot be undone.')) return;
    setState(s => ({
      ...s,
      takeoffCounts: {},
      takeoffAreas:  [],
      takeoffSource: '',
    }));
  }

  // ── Inline edit handlers ───────────────────────────────────────────────────

  function updateCount(itemId: string, value: number) {
    setState(s => ({
      ...s,
      takeoffCounts: { ...s.takeoffCounts, [itemId]: value },
    }));
  }

  function removeCount(itemId: string) {
    setState(s => {
      const next = { ...s.takeoffCounts };
      delete next[itemId];
      return { ...s, takeoffCounts: next };
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      <RidgeSyncPanel />
      <DropsPreviewPanel />

      {/* ── IMPORT CHOICE DIALOG (only when counts already exist) ─────────── */}
      {pendingImport && (() => {
        const sameAsLast =
          lastImportSignature() === importSignature(pendingImport.source, pendingImport.totals);
        const close = () => { setPendingImport(null); setConfirmSame(false); };
        const run = (mode: 'add' | 'replace') => { applyImport(pendingImport, mode); close(); };
        const warn = confirmSame;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div role="dialog" aria-modal="true" className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
              <div className="text-base font-semibold text-gray-800 mb-1">
                {warn ? 'Same import as last time?' : 'Counts already exist'}
              </div>
              {warn ? (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                  This looks like the same import as last time - add again? Adding it again will double these quantities.
                </div>
              ) : (
                <div className="text-sm text-gray-600 mb-3">
                  Importing {Object.keys(pendingImport.totals).length} item{Object.keys(pendingImport.totals).length !== 1 ? 's' : ''} from{' '}
                  <span className="font-medium">{pendingImport.source}</span>. You already have{' '}
                  {Object.keys(counts).length} item{Object.keys(counts).length !== 1 ? 's' : ''} counted.
                </div>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => (sameAsLast && !warn ? setConfirmSame(true) : run('add'))}
                  autoFocus
                  className="px-3 py-2 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c]"
                >
                  {warn ? 'Add again' : 'Add to existing counts'}
                </button>
                <button
                  onClick={() => run('replace')}
                  className="px-3 py-2 text-sm font-semibold rounded border border-red-300 text-red-600 hover:bg-red-50"
                >
                  Replace all counts
                </button>
                <button
                  onClick={close}
                  className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── SYNC BANNER ───────────────────────────────────────────────────── */}
      {syncPayload && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg px-4 py-3">
          <span className="text-green-600 text-lg">⇄</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-800">
              New counts available from{' '}
              {syncPayload.source === 'pdf-takeoff' ? 'PDF Takeoff tool' : 'Counter tool'}
              {syncPayload.jobName ? ` — ${syncPayload.jobName}` : ''}
            </div>
            <div className="text-xs text-green-600">
              {Object.keys(syncPayload.totals).length} items ready to import
            </div>
          </div>
          <button
            onClick={() => {
              const payload = syncPayload;
              requestImport({
                totals:  normalizeTakeoffCounts(payload.totals),
                areas:   normalizeAreas(payload.areas ?? []),
                source:  `${payload.source === 'pdf-takeoff' ? 'PDF Takeoff' : 'Counter'} — ${payload.jobName || payload.source}`,
                jobName: payload.jobName || '',
                // Runs only once the import actually happens (not on Cancel).
                onApplied: () => {
                  try {
                    localStorage.setItem('ore_estimator_sync_last', String(payload.timestamp));
                  } catch { /* iOS private browsing — ignore */ }
                  // Labels carried in the SYNC payload → offer to apply them
                  const incomingLabels = {
                    bidPackage: payload.activeBidPackage ?? '',
                    area:       payload.activeArea       ?? '',
                    costCode:   payload.activeCostCode   ?? '',
                  };
                  if (incomingLabels.bidPackage || incomingLabels.area || incomingLabels.costCode) {
                    setLabelConfirmPayload(incomingLabels);
                  }
                  setSyncPayload(null);
                },
              });
            }}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
          >
            Import Now
          </button>
          <button
            onClick={() => {
              try {
                localStorage.setItem('ore_estimator_sync_last', String(syncPayload.timestamp));
              } catch { /* iOS private browsing — ignore */ }
              setSyncPayload(null);
            }}
            className="text-green-500 hover:text-green-700 text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── LABEL CONFIRMATION BANNER ─────────────────────────────────────── */}
      {labelConfirmPayload && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg px-4 py-3">
          <span className="text-green-600 text-lg">⬡</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-800">
              Takeoff labeled:{' '}
              {[labelConfirmPayload.bidPackage, labelConfirmPayload.area, labelConfirmPayload.costCode]
                .filter(Boolean).join(' / ')}
            </div>
            <div className="text-xs text-green-600">
              Apply these as the active labels for new assemblies?
            </div>
          </div>
          <button
            onClick={() => {
              if (labelConfirmPayload.bidPackage) {
                addLabel('bidPackage', labelConfirmPayload.bidPackage);
                setActiveLabel('bidPackage', labelConfirmPayload.bidPackage);
              }
              if (labelConfirmPayload.area) {
                addLabel('area', labelConfirmPayload.area);
                setActiveLabel('area', labelConfirmPayload.area);
              }
              if (labelConfirmPayload.costCode) {
                addLabel('costCode', labelConfirmPayload.costCode);
                setActiveLabel('costCode', labelConfirmPayload.costCode);
              }
              setLabelConfirmPayload(null);
            }}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
          >
            Apply These Labels
          </button>
          <button
            onClick={() => setLabelConfirmPayload(null)}
            className="px-3 py-1.5 text-sm rounded border border-green-300 text-green-700 hover:bg-green-100 whitespace-nowrap"
          >
            Keep Current
          </button>
        </div>
      )}

      {/* ── HEADER BAR ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#eef4ff] border border-[#c0d4f0] rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#1e3a8a]">
            Takeoff Counts
          </div>
          {state.takeoffSource ? (
            <div className="text-xs text-gray-500 mt-0.5">
              Source: {state.takeoffSource}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-0.5">
              Import counts from the handheld counter tool
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] flex items-center gap-1 transition-colors"
          >
            ⬆ Import Counter JSON
          </button>
          {hasData && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          )}
          <input
            type="file"
            accept=".json"
            ref={fileRef}
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {importError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {importError}
        </div>
      )}

      {/* ── EMPTY STATE ───────────────────────────────────────────────────── */}
      {!hasData && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm font-medium text-gray-500 mb-1">
            No takeoff counts yet
          </div>
          <div className="text-xs">
            Export a JSON from the handheld counter tool and import it here to see your counts.
          </div>
        </div>
      )}

      {/* ── COUNTS TABLE — grouped by category ───────────────────────────── */}
      {hasData && (() => {
        // Group counts by category
        const grouped: Record<string, Array<{ id: string; qty: number }>> = {};
        for (const [id, qty] of Object.entries(counts)) {
          if (!qty) continue;
          const cat = ITEM_CATEGORY[id] ?? 'other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({ id, qty });
        }

        return [...CAT_ORDER, 'other'].map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;

          return (
            <div key={cat} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="bg-[#eef4ff] px-4 py-2 flex justify-between items-center border-b border-[#d0dff0]">
                <span className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                  {cat === 'fa' && (
                    <button
                      onClick={() => setTab('assemblies')}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1e3a8a] text-white hover:bg-red-700 whitespace-nowrap transition-colors">
                      → FA Builder
                    </button>
                  )}
                  {cat === 'data_lv' && (
                    <button
                      onClick={() => setTab('assemblies')}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-600 text-white hover:bg-teal-700 whitespace-nowrap transition-colors">
                      → Data/LV Builders
                    </button>
                  )}
                  {(cat === 'devices' || cat === 'fixtures') && (
                    <button
                      onClick={() => setTab('fixtures')}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap transition-colors">
                      → Fixture Builder
                    </button>
                  )}
                </div>
              </div>

              {/* Items table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                    <th className="text-left px-4 py-2 font-semibold">Item</th>
                    <th className="text-right px-4 py-2 font-semibold w-32">Qty / Footage</th>
                    <th className="text-center px-4 py-2 font-semibold w-16">Unit</th>
                    <th className="w-24"></th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ id, qty }) => (
                    <tr
                      key={id}
                      className="border-b border-gray-50 hover:bg-blue-50 transition-colors group"
                    >
                      <td className="px-4 py-2 text-gray-800">
                        {ITEM_LABELS[id] ?? id}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {editingId === id ? (
                          <input
                            type="number"
                            defaultValue={qty}
                            autoFocus
                            className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm font-mono focus:outline-none"
                            onBlur={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > 0) updateCount(id, v);
                              else removeCount(id);
                              setEditingId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="font-mono text-gray-700 cursor-pointer hover:text-[#1e3a8a] hover:underline"
                            onClick={() => setEditingId(id)}
                            title="Click to edit"
                          >
                            {qty.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-gray-400">
                        {FOOTAGE_ITEMS.has(id) ? 'ft' : 'ea'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {ITEM_BUILD[id]?.builder === 'fa' && (
                          <button
                            onClick={() => { updateFAState({ deviceId: ITEM_BUILD[id].target as string, qty }); setTab(ITEM_BUILD[id].tab); }}
                            title="Load into FA Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-red-700 text-white hover:bg-red-800 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {ITEM_BUILD[id]?.builder === 'lv' && (
                          <button
                            onClick={() => { updateLVState({ deviceType: ITEM_BUILD[id].target as string, qty }); setTab(ITEM_BUILD[id].tab); }}
                            title="Load into LV Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-teal-600 text-white hover:bg-teal-700 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {ITEM_BUILD[id]?.builder === 'data' && (
                          <button
                            onClick={() => { updateDataState({ ports: ITEM_BUILD[id].ports as (1 | 2 | 3 | 4) }); setTab(ITEM_BUILD[id].tab); }}
                            title="Load into Data Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {ITEM_BUILD[id]?.builder === 'fixture' && (
                          <button
                            onClick={() => { updateFixtureState({ selectedId: ITEM_BUILD[id].target as string, qty: Math.max(1, Math.round(qty)) }); setTab(ITEM_BUILD[id].tab); }}
                            title="Load into Fixture Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {ITEM_BUILD[id]?.builder === 'threeway' && (
                          <button
                            onClick={() => { setTab(ITEM_BUILD[id].tab); }}
                            title="Open the 3-Way Builder. Enter traveler feet from the drawing. 2 switches = 1 assembly."
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-orange-500 text-white hover:bg-orange-600 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => removeCount(id)}
                          className="text-red-400 hover:text-red-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        });
      })()}

      {/* ── AREA BREAKDOWN ────────────────────────────────────────────────── */}
      {hasData && state.takeoffAreas.length > 1 && (
        <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
            By Area
          </h3>
          <div className="space-y-2">
            {state.takeoffAreas.map((area, i) => {
              const areaTotal = Object.keys(area.counts).length;
              if (areaTotal === 0) return null;
              return (
                <div
                  key={i}
                  className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">{area.areaName}</span>
                  <span className="text-xs text-gray-400">
                    {areaTotal} item type{areaTotal !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SUMMARY BAR ───────────────────────────────────────────────────── */}
      {hasData && (
        <div className="bg-[#1e3a8a] text-white rounded-lg px-4 py-3 flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-blue-200 text-xs">Total line items</div>
            <div className="font-bold">{Object.keys(counts).length}</div>
          </div>
          <div>
            <div className="text-blue-200 text-xs">Total units / footage</div>
            <div className="font-bold">
              {Object.values(counts).reduce((s, v) => s + v, 0).toLocaleString()}
            </div>
          </div>
          {state.takeoffAreas.length > 0 && (
            <div>
              <div className="text-blue-200 text-xs">Areas counted</div>
              <div className="font-bold">{state.takeoffAreas.length}</div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
