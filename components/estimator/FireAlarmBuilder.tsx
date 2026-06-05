'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcFireAlarm } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

const DEVICE_OPTIONS = [
  { id: 'fad1',  label: 'Pull Station' },
  { id: 'fad2',  label: 'Smoke Detector' },
  { id: 'fad3',  label: 'Heat Detector' },
  { id: 'fad4',  label: 'Smoke/CO Combo' },
  { id: 'fad5',  label: 'Horn/Strobe' },
  { id: 'fad6',  label: 'Strobe' },
  { id: 'fad7',  label: 'LF Sounder' },
  { id: 'fad8',  label: 'Beacon' },
  { id: 'fad9',  label: 'Control/Monitor Module' },
  { id: 'fad10', label: 'Duct Smoke Detector' },
  { id: 'fad11', label: 'Annunciator' },
  { id: 'fad12', label: 'FL FACP Small (4ch)' },
  { id: 'fad13', label: 'FL FACP Medium (6ch)' },
  { id: 'fad14', label: 'FL FACP Large (10ch)' },
  { id: 'fad15', label: 'FL Radio Box' },
];

const PANEL_IDS = new Set(['fad12', 'fad13', 'fad14', 'fad15']);

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

export function FireAlarmBuilder() {
  const { state, updateFAState, addFireAlarm } = useEstimatorContext();
  const { faState } = state;

  const isPanel = PANEL_IDS.has(faState.deviceId);

  const preview = useMemo(() => calcFireAlarm(faState), [faState]);

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
            <label className="block text-xs text-gray-500 mb-1">Device</label>
            <select className={sel} value={faState.deviceId}
              onChange={e => updateFAState({ deviceId: e.target.value })}>
              {DEVICE_OPTIONS.map(d => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Pricing</label>
            <select className={sel} value={faState.pricing}
              onChange={e => updateFAState({ pricing: e.target.value as 'firelite' | 'quoted' })}>
              <option value="firelite">Firelite Price</option>
              <option value="quoted">Per Quote</option>
            </select>
          </div>

          {!isPanel && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Frame</label>
                <select className={sel} value={faState.frameType}
                  onChange={e => updateFAState({ frameType: e.target.value as 'wood' | 'metal' | 'pipe' })}>
                  <option value="wood">Wood/NM</option>
                  <option value="metal">Metal/MC</option>
                  <option value="pipe">Pipe/MC</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Circuit</label>
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
            </>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={faState.qty}
              onChange={e => updateFAState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>

          {!isPanel && (
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none pb-1.5">
              <input type="checkbox" className="rounded"
                checked={faState.homeRun}
                onChange={e => updateFAState({ homeRun: e.target.checked })} />
              <span className="text-gray-700">Class A (×2)</span>
            </label>
          )}

          {isPanel && (
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none pb-1.5">
              <input type="checkbox" className="rounded"
                checked={faState.includePower}
                onChange={e => updateFAState({ includePower: e.target.checked })} />
              <span className="text-gray-700">120V power circuit</span>
            </label>
          )}
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
              Preview: {preview.label}
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
