'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcHighAmpRecept, type HighAmpReceptParams } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

// Map harState.receptType values (which may use various conventions) to calc param keys
const RECEPT_CALC_KEY: Record<string, HighAmpReceptParams['receptType']> = {
  '30A': '30A', 'recept_30a': '30A',
  '50A': '50A', 'recept_50a': '50A',
  '240V': '240V', 'recept_240v': '240V',
  'twist': 'twist', 'recept_twist': 'twist',
};

const RECEPT_LABELS: Record<string, string> = {
  '30A': '30A Dryer',
  '50A': '50A Range',
  '240V': '240V Standard',
  'twist': 'Twist-Lock',
};

export function HighAmpReceptBuilder() {
  const { state, updateHARState, addHighAmpRecept } = useEstimatorContext();
  const { harState } = state;

  const preview = useMemo(() => {
    const calcType = RECEPT_CALC_KEY[harState.receptType] ?? '30A';
    const p: HighAmpReceptParams = {
      receptType: calcType,
      whipFeet:   harState.whipFt,
      qty:        harState.qty,
      diff:       harState.diff,
    };
    return calcHighAmpRecept(p);
  }, [harState]);

  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  const displayLabel = RECEPT_LABELS[RECEPT_CALC_KEY[harState.receptType] ?? '30A'] ?? harState.receptType;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        High-Amp Receptacle Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recept Type</label>
            <select className={sel} value={RECEPT_CALC_KEY[harState.receptType] ?? '30A'}
              onChange={e => updateHARState({ receptType: e.target.value })}>
              {Object.entries(RECEPT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Whip Ft</label>
            <input type="number" min={0} placeholder="e.g. 20" className={inp}
              value={harState.whipFt === 0 ? '' : harState.whipFt}
              onChange={e => updateHARState({ whipFt: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={harState.qty}
              onChange={e => updateHARState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateHARState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  harState.diff === d.value
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => addHighAmpRecept()}
            className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors">
            + Add to Bid
          </button>
        </div>

        {preview && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {displayLabel} — {harState.whipFt}ft whip × {harState.qty}
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
        )}
      </div>
    </div>
  );
}
