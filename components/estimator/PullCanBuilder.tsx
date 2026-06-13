'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates, applyMarkup, type SavedAssembly } from '@/lib/estimator/constants';
import { EditablePreview } from './EditablePreview';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

const PULL_CAN_LABOR: Record<string, number> = {
  small: 1.0, medium: 1.5, large: 2.5, xl: 4.0,
};

const CAN_SIZE_LABELS: Record<string, string> = {
  small: 'Small (4")', medium: 'Medium (6")', large: 'Large (8")', xl: 'XL (12")',
};

function buildPullCan(
  canSize: string, mountMethod: string,
  mountMat: number, qty: number, diff: number,
): SavedAssembly {
  const R = getRates();
  const lhrEa = PULL_CAN_LABOR[canSize] ?? 1.5;
  const lines: SavedAssembly['lines'] = [];

  lines.push({
    name: `${CAN_SIZE_LABELS[canSize] ?? canSize} pull can (per quote)`,
    qty, unit: 'EA', mat: 0.01 * qty, lab: 0,
  });
  if (mountMat > 0) {
    lines.push({
      name: `Mount hardware ($${mountMat}/ea)`,
      qty, unit: 'EA',
      mat: applyMarkup(mountMat * qty, 'bulk'),
      lab: 0,
    });
  }
  lines.push({
    name: `Install labor (${qty} × ${lhrEa}hr × diff ${diff})`,
    qty, unit: 'EA', mat: 0,
    lab: lhrEa * qty * diff * R.labor,
  });

  const mat = lines.reduce((s, l) => s + l.mat, 0);
  const lab = lines.reduce((s, l) => s + l.lab, 0);
  return {
    label: `Pull can — ${CAN_SIZE_LABELS[canSize] ?? canSize} — ${mountMethod} — ×${qty}`,
    mat, lab, lines,
  };
}

export function PullCanBuilder() {
  const { state, updateCanState, setState } = useEstimatorContext();
  const { canState } = state;

  const preview = useMemo(
    () => buildPullCan(canState.canSize, canState.mountMethod, canState.mountMat, canState.qty, canState.diff),
    [canState],
  );

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Pull Can Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Can Size</label>
            <select className={sel} value={canState.canSize}
              onChange={e => updateCanState({ canSize: e.target.value as 'small' | 'medium' | 'large' | 'xl' })}>
              {Object.entries(CAN_SIZE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mount</label>
            <select className={sel} value={canState.mountMethod}
              onChange={e => updateCanState({ mountMethod: e.target.value as 'wall' | 'ceiling' })}>
              <option value="wall">Wall</option>
              <option value="ceiling">Ceiling</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mount Mat $</label>
            <input type="number" min={0} placeholder="0" className={inp}
              value={canState.mountMat === 0 ? '' : canState.mountMat}
              onChange={e => updateCanState({ mountMat: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={canState.qty}
              onChange={e => updateCanState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateCanState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  canState.diff === d.value
                    ? 'bg-[#1e3a8a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <EditablePreview
          assembly={preview}
          storageKey="rl_default_pull_can"
          onAdd={asm => setState(s => ({
            ...s,
            savedCans: [...s.savedCans, {
              ...asm,
              bidPackage: s.activeBidPackage || undefined,
              area:       s.activeArea       || undefined,
              costCode:   s.activeCostCode   || undefined,
            }],
          }))}
        />
      </div>
    </div>
  );
}
