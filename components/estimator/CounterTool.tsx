'use client';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { computeTotals } from '@/lib/estimator/counterState';
import type { CounterState } from '@/lib/estimator/counterState';
import {
  ITEM_LABELS, ITEM_CATEGORY, FOOTAGE_ITEMS,
  CATEGORY_LABELS, CAT_ORDER,
} from '@/lib/estimator/takeoffConstants';

// ── Category → item ids lookup (built at module load) ─────────────────────────

const CAT_ITEMS: Record<string, string[]> = {};
Object.entries(ITEM_CATEGORY).forEach(([id, cat]) => {
  if (!CAT_ITEMS[cat]) CAT_ITEMS[cat] = [];
  CAT_ITEMS[cat].push(id);
});

// ── CounterTool ────────────────────────────────────────────────────────────────

export function CounterTool() {
  const { state, setState } = useEstimatorContext();
  const counter = state.counter;

  const [activeTab,   setActiveTab]   = useState(CAT_ORDER[0]);
  const [showAreas,   setShowAreas]   = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const currentArea = counter.areas[counter.currentAreaIdx];

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function patchCounter(patch: Partial<CounterState>) {
    setState(s => ({ ...s, counter: { ...s.counter, ...patch } }));
  }

  function getCount(itemId: string): number {
    return currentArea?.counts[itemId] ?? 0;
  }

  function increment(itemId: string, delta: number) {
    setState(s => {
      const areas = s.counter.areas.map((a, i) => {
        if (i !== s.counter.currentAreaIdx) return a;
        const cur  = a.counts[itemId] ?? 0;
        const next = Math.max(0, cur + delta);
        return { ...a, counts: { ...a.counts, [itemId]: next } };
      });
      return {
        ...s,
        counter:       { ...s.counter, areas },
        takeoffCounts: computeTotals(areas),
        takeoffSource: 'Counter tool — live sync',
      };
    });
  }

  function resetItem(itemId: string) {
    increment(itemId, -(getCount(itemId)));
  }

  function addArea() {
    const name = newAreaName.trim() || `Area ${counter.areas.length + 1}`;
    patchCounter({
      areas:          [...counter.areas, { name, counts: {} }],
      currentAreaIdx: counter.areas.length,
    });
    setNewAreaName('');
  }

  function switchArea(idx: number) {
    patchCounter({ currentAreaIdx: idx });
  }

  function clearArea() {
    if (!window.confirm(`Clear all counts in "${currentArea?.name ?? 'this area'}"?`)) return;
    setState(s => {
      const areas = s.counter.areas.map((a, i) =>
        i === s.counter.currentAreaIdx ? { ...a, counts: {} } : a
      );
      return {
        ...s,
        counter:       { ...s.counter, areas },
        takeoffCounts: computeTotals(areas),
      };
    });
  }

  function deleteArea(idx: number) {
    if (counter.areas.length <= 1) return;
    setState(s => {
      const areas   = s.counter.areas.filter((_, i) => i !== idx);
      let newIdx    = s.counter.currentAreaIdx;
      if (idx < newIdx)      newIdx--;
      else if (idx === newIdx) newIdx = Math.max(0, newIdx - 1);
      return {
        ...s,
        counter:       { ...s.counter, areas, currentAreaIdx: newIdx },
        takeoffCounts: computeTotals(areas),
        takeoffSource: 'Counter tool — live sync',
      };
    });
  }

  function exportJSON() {
    const totals = computeTotals(counter.areas);
    const out = {
      jobName:    state.jobName || 'Untitled',
      exportDate: new Date().toISOString().slice(0, 10),
      areas: counter.areas.map(a => ({
        areaName: a.name,
        counts:   Object.fromEntries(
          Object.entries(a.counts).filter(([, v]) => v > 0)
        ),
      })),
      totals,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${state.jobName || 'takeoff'}-counter.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Bottom bar totals ─────────────────────────────────────────────────────────

  const tabItems     = CAT_ITEMS[activeTab] ?? [];
  const tabItemCount = tabItems.filter(id => getCount(id) > 0).length;
  const tabUnitCount = tabItems.reduce((sum, id) => sum + getCount(id), 0);
  const allTotals    = computeTotals(counter.areas);
  const overallCount = Object.values(allTotals).filter(v => v > 0).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#1e3a8a] text-white px-4 py-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-blue-200">
            RIDGELINE / TAKEOFF
          </span>
          <span className="text-xs text-blue-300 truncate ml-2 max-w-[160px]">
            {state.jobName || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-200 flex-1 truncate">
            AREA: {currentArea?.name ?? 'No area'}
          </span>
          <button
            onClick={() => setShowAreas(true)}
            className="px-2 py-1 text-xs rounded border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            AREAS
          </button>
          <button
            onClick={() => setShowSummary(true)}
            className="px-2 py-1 text-xs rounded border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            SUMMARY
          </button>
          <button
            onClick={exportJSON}
            className="px-2 py-1 text-xs rounded border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            EXPORT
          </button>
        </div>
      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto bg-[#0f2235] border-b border-[#2a4a6c] shrink-0">
        {CAT_ORDER.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={
              activeTab === cat
                ? 'px-4 py-3 text-xs font-bold text-white whitespace-nowrap border-b-2 border-orange-400'
                : 'px-4 py-3 text-xs font-bold text-blue-300 whitespace-nowrap hover:text-white transition-colors'
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* ── ITEM CARDS ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-100">
        {(CAT_ITEMS[activeTab] ?? []).map(id => {
          const count     = getCount(id);
          const isFootage = FOOTAGE_ITEMS.has(id);
          const delta     = isFootage ? 5 : 1;

          return (
            <div
              key={id}
              className="bg-white rounded-xl shadow-sm flex items-center gap-3 px-4 py-3"
            >
              {/* Item name */}
              <span className="flex-1 text-sm font-medium text-gray-800">
                {ITEM_LABELS[id] ?? id}
                {isFootage && (
                  <span className="text-gray-400 ml-1 text-xs">(ft)</span>
                )}
              </span>

              {/* Reset ✕ — only when count > 0 */}
              {count > 0 && (
                <button
                  onClick={() => resetItem(id)}
                  className="text-gray-300 hover:text-red-400 text-xs px-1 transition-colors"
                >
                  ✕
                </button>
              )}

              {/* − */}
              <button
                onClick={() => increment(id, -delta)}
                disabled={count === 0}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center disabled:opacity-30 transition-colors"
              >
                −
              </button>

              {/* Count */}
              <span
                className={`w-10 text-center text-lg font-mono ${
                  count > 0 ? 'font-bold text-[#1e3a8a]' : 'text-gray-300'
                }`}
              >
                {count}
              </span>

              {/* + */}
              <button
                onClick={() => increment(id, delta)}
                className="w-9 h-9 rounded-full bg-[#1e3a8a] hover:bg-[#2e5a8c] text-white font-bold text-lg flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {/* ── BOTTOM BAR ──────────────────────────────────────────────────────── */}
      <div className="bg-[#1e3a8a] text-white px-4 py-2 flex items-center justify-between text-xs shrink-0">
        <span>
          TOTAL THIS TAB: {tabItemCount} item{tabItemCount !== 1 ? 's' : ''} /{' '}
          {tabUnitCount.toLocaleString()} units
        </span>
        <span>OVERALL: {overallCount} item{overallCount !== 1 ? 's' : ''}</span>
      </div>

      {/* ── AREAS SLIDE-OVER ─────────────────────────────────────────────────── */}
      {showAreas && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowAreas(false)}
          />
          <div className="fixed right-0 top-0 h-full w-80 bg-white z-[70] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-bold text-gray-800">Areas</span>
              <button
                onClick={() => setShowAreas(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Add area form */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addArea()}
                  placeholder="New area name..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={addArea}
                  className="px-3 py-2 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] transition-colors"
                >
                  ADD
                </button>
              </div>

              {/* Areas list */}
              <div className="space-y-2">
                {counter.areas.map((area, idx) => {
                  const isCurrent  = idx === counter.currentAreaIdx;
                  const itemTypes  = Object.values(area.counts).filter(v => v > 0).length;
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg p-3 flex items-center gap-2 border ${
                        isCurrent
                          ? 'bg-[#eef4ff] border-[#c0d4f0]'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => { switchArea(idx); setShowAreas(false); }}
                      >
                        <div className={`text-sm font-semibold flex items-center gap-2 ${isCurrent ? 'text-[#1e3a8a]' : 'text-gray-800'}`}>
                          <span className="truncate">{area.name}</span>
                          {isCurrent && (
                            <span className="shrink-0 text-xs bg-[#1e3a8a] text-white rounded-full px-2 py-0.5 font-medium leading-none">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {itemTypes} item type{itemTypes !== 1 ? 's' : ''}
                        </div>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        {isCurrent && (
                          <button
                            onClick={clearArea}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                        {!isCurrent && counter.areas.length > 1 && (
                          <button
                            onClick={() => deleteArea(idx)}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAreas(false)}
                className="w-full py-2 text-sm font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SUMMARY SLIDE-OVER ───────────────────────────────────────────────── */}
      {showSummary && (() => {
        const totals  = computeTotals(counter.areas);
        const nonZero = Object.entries(totals).filter(([, v]) => v > 0);
        const synced  = state.takeoffSource?.includes('Counter tool');

        // Group by category
        const grouped: Record<string, Array<{ id: string; qty: number }>> = {};
        for (const [id, qty] of nonZero) {
          const cat = ITEM_CATEGORY[id] ?? 'other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({ id, qty });
        }

        return (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setShowSummary(false)}
            />
            <div className="fixed right-0 top-0 h-full w-80 bg-white z-[70] shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="font-bold text-gray-800">Summary</span>
                <button
                  onClick={() => setShowSummary(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {synced && (
                  <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
                    Synced to Takeoff tab ✓
                  </div>
                )}

                {nonZero.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No counts yet. Tap + on items to start.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {CAT_ORDER.map(cat => {
                      const items = grouped[cat];
                      if (!items || items.length === 0) return null;
                      return (
                        <div key={cat}>
                          <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] mb-2">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </div>
                          <div className="space-y-1">
                            {items.map(({ id, qty }) => (
                              <div
                                key={id}
                                className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0"
                              >
                                <span className="text-gray-700 truncate pr-2">
                                  {ITEM_LABELS[id] ?? id}
                                </span>
                                <span className="font-mono font-bold text-[#1e3a8a] shrink-0">
                                  {qty.toLocaleString()}{' '}
                                  <span className="font-normal text-gray-400 text-xs">
                                    {FOOTAGE_ITEMS.has(id) ? 'ft' : 'ea'}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowSummary(false)}
                  className="w-full py-2 text-sm font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}
