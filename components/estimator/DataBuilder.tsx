'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcData, type DataParams } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

const MAKEUP_OPTIONS = [
  { label: 'None',   value: 0  },
  { label: '3 ft',   value: 3  },
  { label: '5 ft',   value: 5  },
  { label: '10 ft',  value: 10 },
  { label: '12 ft',  value: 12 },
  { label: '18 ft',  value: 18 },
  { label: '24 ft',  value: 24 },
];

export function DataBuilder() {
  const { state, updateDataState, addDataLocation } = useEstimatorContext();
  const { dataState } = state;

  const preview = useMemo(() => calcData(dataState as DataParams), [dataState]);
  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Data Drop Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ports</label>
            <select className={sel} value={dataState.ports}
              onChange={e => updateDataState({ ports: parseInt(e.target.value) as 1 | 2 | 3 | 4 })}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Support</label>
            <select className={sel} value={dataState.support}
              onChange={e => updateDataState({ support: e.target.value as DataParams['support'] })}>
              <option value="J-Hook Small">J-Hook Small</option>
              <option value="J-Hook Large">J-Hook Large</option>
              <option value="Zip Tie">Zip Tie</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Feet</label>
            <input type="number" min={0} placeholder="e.g. 100" className={inp}
              value={dataState.feet === 0 ? '' : dataState.feet}
              onChange={e => updateDataState({ feet: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Makeup/End</label>
            <select className={sel} value={dataState.makeup}
              onChange={e => updateDataState({ makeup: parseInt(e.target.value) })}>
              {MAKEUP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Patch Panel</label>
            <select className={sel} value={dataState.patchPanel}
              onChange={e => updateDataState({ patchPanel: e.target.value as DataParams['patchPanel'] })}>
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none pb-1.5">
            <input type="checkbox" className="rounded"
              checked={dataState.emtDrop}
              onChange={e => updateDataState({ emtDrop: e.target.checked })} />
            <span className="text-gray-700">EMT drop</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateDataState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  dataState.diff === d.value
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {dataState.feet <= 0 && (
              <span className="text-xs text-red-500">Footage required</span>
            )}
            <button
              onClick={() => addDataLocation()}
              disabled={dataState.feet <= 0}
              className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              + Add to Bid
            </button>
          </div>
        </div>

        {preview && dataState.feet > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {dataState.ports}-port Cat6 — {dataState.feet}ft — {dataState.support}
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
