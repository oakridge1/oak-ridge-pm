'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates, applyMarkup, type SavedAssembly } from '@/lib/estimator/constants';

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

  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  function handleAdd() {
    const asm = buildPullCan(canState.canSize, canState.mountMethod, canState.mountMat, canState.qty, canState.diff);
    setState(s => ({ ...s, savedCans: [...s.savedCans, asm] }));
  }

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
          <button
            onClick={handleAdd}
            className="bg-[#1e3a8a] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors">
            + Add to Bid
          </button>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Preview: {CAN_SIZE_LABELS[canState.canSize]} — {canState.mountMethod} × {canState.qty}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left py-1 font-medium pr-2">Item</th>
                  <th className="text-right py-1 font-medium w-10">Qty</th>
                  <th className="text-right py-1 font-medium w-10">Unit</th>
                  <th className="text-right py-1 font-medium w-20">Mat $</th>
                  <th className="text-right py-1 font-medium w-16">Hrs</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((line, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-0.5 text-gray-700 pr-2">{line.name}</td>
                    <td className="text-right py-0.5 text-gray-600">{line.qty}</td>
                    <td className="text-right py-0.5 text-gray-400">{line.unit}</td>
                    <td className="text-right py-0.5 text-gray-700">
                      {line.mat > 0 ? `$${line.mat.toFixed(2)}` : ''}
                    </td>
                    <td className="text-right py-0.5 text-gray-700">
                      {line.lab > 0 ? `${(line.lab / R.labor).toFixed(2)} h` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-gray-800 border-t border-gray-200">
                  <td className="py-1" colSpan={3}>Total</td>
                  <td className="text-right py-1">${preview.mat.toFixed(2)}</td>
                  <td className="text-right py-1">{(preview.lab / R.labor).toFixed(2)} h</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
