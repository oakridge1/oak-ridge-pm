'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcFireAlarm, type FireAlarmParams } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

export function FireAlarmBuilder() {
  const { state, updateFAState, addFireAlarm } = useEstimatorContext();
  const { faState } = state;

  const preview = useMemo(() => {
    const p: FireAlarmParams = {
      mountType: faState.frameType,
      wireType:  faState.circuitType,
      feet:      faState.whipFt,
      qty:       faState.qty,
      quoted:    false,
      diff:      faState.diff,
    };
    return calcFireAlarm(p);
  }, [faState]);

  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Fire Alarm Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Frame Type</label>
            <select className={sel} value={faState.frameType}
              onChange={e => updateFAState({ frameType: e.target.value as 'wood' | 'metal' | 'pipe' })}>
              <option value="wood">Wood</option>
              <option value="metal">Metal</option>
              <option value="pipe">Pipe</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Circuit Type</label>
            <select className={sel} value={faState.circuitType}
              onChange={e => updateFAState({ circuitType: e.target.value as 'slc' | 'nac' | 'ann' })}>
              <option value="slc">SLC</option>
              <option value="nac">NAC</option>
              <option value="ann">Annunciator</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Whip Ft</label>
            <input type="number" min={0} placeholder="e.g. 35" className={inp}
              value={faState.whipFt === 0 ? '' : faState.whipFt}
              onChange={e => updateFAState({ whipFt: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={faState.qty}
              onChange={e => updateFAState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none pb-1.5">
            <input type="checkbox" className="rounded"
              checked={faState.homeRun}
              onChange={e => updateFAState({ homeRun: e.target.checked })} />
            <span className="text-gray-700">Home run</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateFAState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  faState.diff === d.value
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => addFireAlarm()}
            className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors">
            + Add to Bid
          </button>
        </div>

        {preview && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {faState.frameType} frame — {faState.circuitType.toUpperCase()} — {faState.whipFt}ft × {faState.qty}
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
