'use client';

// Read-only view of the PDF tool's Ridge List tally against this estimate.
// Never changes the estimate: it only reads localStorage 'ore_ridge_tally'.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { compareRidgeTally, type RidgeSyncRow } from '@/lib/estimator/ridgeSync';
import type { SavedAssembly } from '@/lib/estimator/constants';

const TALLY_KEY = 'ore_ridge_tally';

interface Tally {
  estimateId: string;
  updatedAt: string;
  counts: Record<string, number>;
}

// Returns null for missing or malformed data; never throws.
function readTally(): Tally | null {
  try {
    const raw = localStorage.getItem(TALLY_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.counts || typeof data.counts !== 'object' || Array.isArray(data.counts)) {
      return null;
    }
    const counts: Record<string, number> = {};
    for (const [label, n] of Object.entries(data.counts as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) counts[label] = n;
    }
    return {
      estimateId: typeof data.estimateId === 'string' ? data.estimateId : '',
      updatedAt:  typeof data.updatedAt === 'string' ? data.updatedAt : '',
      counts,
    };
  } catch {
    return null;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'an unknown time' : d.toLocaleString();
}

function statusFor(row: RidgeSyncRow): { text: string; tone: 'ok' | 'warn' | 'grey' } {
  if (row.action === 'equal') return { text: 'Matches', tone: 'ok' };
  if (!row.hasSourceAssembly) return { text: 'No matching assembly in this estimate', tone: 'grey' };
  if (row.action === 'add') return { text: `PDF has ${row.diff} more`, tone: 'warn' };
  return { text: `Estimate has ${row.diff} more`, tone: 'warn' };
}

export function RidgeSyncPanel() {
  const { state } = useEstimatorContext();
  const [tally, setTally] = useState<Tally | null>(null);

  const refresh = useCallback(() => setTally(readTally()), []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('ore_tools');
        channel.onmessage = (e) => {
          if (e.data?.type === 'RIDGE_TALLY') refresh();
        };
      }
    } catch {
      channel = null;
    }
    return () => {
      window.removeEventListener('focus', onFocus);
      channel?.close();
    };
  }, [refresh]);

  const rows = useMemo(() => {
    if (!tally) return [];
    try {
      const all: SavedAssembly[] = [
        ...(state.savedRuns      ?? []), ...(state.savedRacks     ?? []),
        ...(state.savedMCHR      ?? []), ...(state.savedThreeWay  ?? []),
        ...(state.savedData      ?? []), ...(state.savedFA        ?? []),
        ...(state.savedCans      ?? []), ...(state.savedGear      ?? []),
        ...(state.savedCustomDev ?? []), ...(state.savedTM        ?? []),
        ...(state.savedLV        ?? []), ...(state.savedCustomAsm ?? []),
        ...(state.savedHAR       ?? []), ...(state.savedFloorBox  ?? []),
        ...(state.asms           ?? []), ...(state.savedPanels    ?? []),
      ];
      return compareRidgeTally(tally.counts, all);
    } catch {
      return [];
    }
  }, [tally, state]);

  const wrongEstimate = !!tally && tally.estimateId !== (state.jobId || '');

  return (
    <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <div className="text-sm font-semibold text-[#1e3a8a]">PDF tool placements (read only)</div>
          <div className="text-xs text-gray-500">
            {tally
              ? `From PDF tool, updated ${tally.updatedAt ? formatTime(tally.updatedAt) : 'an unknown time'}`
              : 'No PDF placements yet.'}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="text-xs font-medium px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {wrongEstimate && (
        <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-300 rounded px-3 py-2 mb-2">
          These PDF counts belong to a different estimate (or the PDF wasn&apos;t linked)
        </div>
      )}

      {tally && rows.length === 0 && (
        <div className="text-xs text-gray-400">No Ridge List items placed.</div>
      )}

      {rows.length > 0 && (
        <div className={`overflow-x-auto ${wrongEstimate ? 'opacity-50' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-1 pr-3 font-medium">Item</th>
                <th className="py-1 pr-3 font-medium text-right">PDF</th>
                <th className="py-1 pr-3 font-medium text-right">Estimate</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const s = statusFor(row);
                const tone =
                  s.tone === 'ok' ? 'text-green-700' : s.tone === 'warn' ? 'text-amber-700' : 'text-gray-400';
                return (
                  <tr key={row.label} className="border-b border-gray-100 last:border-0">
                    <td className="py-1 pr-3 text-gray-800">{row.label}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{row.pdfCount}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{row.estimateCount}</td>
                    <td className={`py-1 ${tone}`}>{s.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
