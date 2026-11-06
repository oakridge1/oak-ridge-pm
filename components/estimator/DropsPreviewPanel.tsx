'use client';

// View-only preview of the whip cable already included in each Ridge-placed device.
// Reads localStorage 'ore_ridge_tally' and the estimate; writes nothing. The feet-per-device
// inputs are local what-if state only (not saved anywhere).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import {
  computeDropsPreview, dropTotals, parseRidgeTally, type RidgeTally,
} from '@/lib/estimator/dropsPreview';
import { RIDGE_ASM_KEYS } from '@/lib/estimator/ridgeSync';
import type { SavedAssembly } from '@/lib/estimator/constants';

const TALLY_KEY = 'ore_ridge_tally';

function readTally(): RidgeTally | null {
  try {
    return parseRidgeTally(localStorage.getItem(TALLY_KEY));
  } catch {
    return null;
  }
}

const fmtFt = (n: number) => String(Math.round(n * 100) / 100);

export function DropsPreviewPanel() {
  const { state } = useEstimatorContext();
  const [tally, setTally] = useState<RidgeTally | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({}); // what-if only, never saved

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

  const preview = useMemo(() => {
    if (!tally) return null;
    try {
      const all: SavedAssembly[] = [];
      for (const key of RIDGE_ASM_KEYS) {
        const list = (state as unknown as Record<string, SavedAssembly[] | undefined>)[key];
        if (list) all.push(...list);
      }
      return computeDropsPreview(tally.counts, all);
    } catch {
      return null;
    }
  }, [tally, state]);

  const wrongEstimate = !!tally && tally.estimateId !== (state.jobId || '');

  // What-if feet per device: only valid numbers >= 0 count; anything else falls back to the included whip.
  const overrides = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [label, raw] of Object.entries(edits)) {
      const v = parseFloat(raw);
      if (raw.trim() !== '' && Number.isFinite(v) && v >= 0) out[label] = v;
    }
    return out;
  }, [edits]);

  const totals = useMemo(
    () => (preview ? dropTotals(preview.rows, overrides) : { totalDevices: 0, totalWhipFt: 0 }),
    [preview, overrides],
  );

  return (
    <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
      <div className="text-sm font-semibold text-[#1e3a8a]">Drops preview (included whip – view only)</div>
      <div className="text-xs text-gray-500 mb-2">
        Whip cable is already priced inside each assembly. Changing a number here is what-if only and changes nothing in the estimate.
      </div>

      {!tally && <div className="text-xs text-gray-400">No PDF placements yet.</div>}

      {wrongEstimate && (
        <div className="text-sm text-yellow-800 bg-yellow-50 border border-yellow-300 rounded px-3 py-2 mb-2">
          These PDF counts belong to a different estimate (or the PDF wasn&apos;t linked)
        </div>
      )}

      {tally && preview && preview.rows.length === 0 && (
        <div className="text-xs text-gray-400">No Ridge List items placed.</div>
      )}

      {preview && preview.rows.length > 0 && (
        <div className={`overflow-x-auto ${wrongEstimate ? 'opacity-50' : ''}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                <th className="py-1 pr-3 font-medium">Device</th>
                <th className="py-1 pr-3 font-medium text-right">Placed</th>
                <th className="py-1 pr-3 font-medium text-right">Whip ft each</th>
                <th className="py-1 font-medium text-right">Total ft</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row) => {
                const usable = row.whipFtEach !== null;
                const shown = edits[row.label] ?? (usable ? fmtFt(row.whipFtEach as number) : '');
                const each = overrides[row.label] ?? row.whipFtEach ?? 0;
                return (
                  <tr key={row.label} className={`border-b border-gray-100 last:border-0 ${usable ? '' : 'text-gray-400'}`}>
                    <td className="py-1 pr-3">{row.label}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{row.placed}</td>
                    <td className="py-1 pr-3 text-right">
                      {usable ? (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          disabled={wrongEstimate}
                          value={shown}
                          onChange={(e) => setEdits((s) => ({ ...s, [row.label]: e.target.value }))}
                          className="w-20 border border-gray-300 rounded px-2 py-0.5 text-right text-sm tabular-nums"
                        />
                      ) : (
                        <span className="text-xs">{row.reason}</span>
                      )}
                    </td>
                    <td className="py-1 text-right tabular-nums">{usable ? fmtFt(row.placed * each) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 font-semibold">
                <td className="py-1 pr-3">Total</td>
                <td className="py-1 pr-3 text-right tabular-nums">{totals.totalDevices}</td>
                <td className="py-1 pr-3" />
                <td className="py-1 text-right tabular-nums">{fmtFt(totals.totalWhipFt)} ft</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
