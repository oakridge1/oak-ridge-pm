'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcThreeWay } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

export function ThreeWayBuilder() {
  const { state, updateThreeWayState, addThreeWay } = useEstimatorContext();
  const { threeWayState } = state;

  const preview = useMemo(() => calcThreeWay(threeWayState), [threeWayState]);
  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        3-Way Switch Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Switch Type</label>
            <select className={sel} value={threeWayState.swType}
              onChange={e => updateThreeWayState({ swType: e.target.value as 'standard' | 'dimming' | 'volt010' })}>
              <option value="standard">Standard</option>
              <option value="dimming">Dimming</option>
              <option value="volt010">0-10V</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Traveler Ft</label>
            <input type="number" min={0} placeholder="e.g. 50" className={inp}
              value={threeWayState.travelerFt === 0 ? '' : threeWayState.travelerFt}
              onChange={e => updateThreeWayState({ travelerFt: parseFloat(e.target.value) || 0 })} />
          </div>
          {threeWayState.swType === 'volt010' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">0-10V Cable Ft</label>
              <input type="number" min={0} placeholder="e.g. 30" className={inp}
                value={threeWayState.lumFt === 0 ? '' : threeWayState.lumFt}
                onChange={e => updateThreeWayState({ lumFt: parseFloat(e.target.value) || 0 })} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateThreeWayState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  threeWayState.diff === d.value
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {threeWayState.travelerFt <= 0 && (
              <span className="text-xs text-red-500">Traveler footage required</span>
            )}
            <button
              onClick={() => addThreeWay()}
              disabled={threeWayState.travelerFt <= 0}
              className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              + Add to Bid
            </button>
          </div>
        </div>

        {preview && threeWayState.travelerFt > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: 3-Way {threeWayState.swType} — {threeWayState.travelerFt}ft traveler
              {threeWayState.swType === 'volt010' && threeWayState.lumFt > 0
                ? ` · ${threeWayState.lumFt}ft 0-10V`
                : ''}
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
