'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { useEffect, useRef, useState } from 'react';
import {
  ITEM_LABELS, ITEM_CATEGORY, FOOTAGE_ITEMS,
  CATEGORY_LABELS, CAT_ORDER,
} from '@/lib/estimator/takeoffConstants';

// ── TakeoffTab ─────────────────────────────────────────────────────────────────

export function TakeoffTab() {
  const { state, setState } = useEstimatorContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [syncPayload, setSyncPayload] = useState<{
    source: string;
    jobName: string;
    totals: Record<string, number>;
    timestamp: number;
    areas: Array<{ areaName: string; counts: Record<string, number> }>;
  } | null>(null);

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

  const counts  = state.takeoffCounts;
  const hasData = Object.keys(counts).length > 0;

  // ── Import handler ─────────────────────────────────────────────────────────

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
        setState(s => ({
          ...s,
          takeoffCounts: json.totals as Record<string, number>,
          takeoffAreas:  Array.isArray(json.areas) ? json.areas : [],
          takeoffSource:
            `Counter export — ${json.exportDate ?? 'unknown date'}` +
            (json.jobName ? ` (${json.jobName as string})` : ''),
          jobName:
            s.jobName === 'New Job' || s.jobName === ''
              ? (json.jobName as string | undefined) ?? s.jobName
              : s.jobName,
        }));
        setImportError(null);
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
              setState(s => ({
                ...s,
                takeoffCounts: syncPayload.totals,
                takeoffAreas:  syncPayload.areas ?? [],
                takeoffSource: `${syncPayload.source === 'pdf-takeoff' ? 'PDF Takeoff' : 'Counter'} — ${syncPayload.jobName || syncPayload.source}`,
                jobName: (s.jobName === 'New Job' || s.jobName === '')
                  ? (syncPayload.jobName || s.jobName) : s.jobName,
              }));
              localStorage.setItem('ore_estimator_sync_last', String(syncPayload.timestamp));
              setSyncPayload(null);
            }}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
          >
            Import Now
          </button>
          <button
            onClick={() => {
              localStorage.setItem('ore_estimator_sync_last', String(syncPayload.timestamp));
              setSyncPayload(null);
            }}
            className="text-green-500 hover:text-green-700 text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── HEADER BAR ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#eef4ff] border border-[#c0d4f0] rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#1a3a5c]">
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
            className="px-3 py-1.5 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] flex items-center gap-1 transition-colors"
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
                <span className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className="text-xs text-gray-500">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Items table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                    <th className="text-left px-4 py-2 font-semibold">Item</th>
                    <th className="text-right px-4 py-2 font-semibold w-32">Qty / Footage</th>
                    <th className="text-center px-4 py-2 font-semibold w-16">Unit</th>
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
                            className="font-mono text-gray-700 cursor-pointer hover:text-[#1a3a5c] hover:underline"
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
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
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
        <div className="bg-[#1a3a5c] text-white rounded-lg px-4 py-3 flex flex-wrap gap-6 text-sm">
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
