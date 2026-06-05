'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcLV } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';
import { ITEM_LABELS } from '@/lib/estimator/takeoffConstants';

const LV_TAKEOFF_MAP: Record<string, string> = {
  camera_indoor:  'camera',
  camera_outdoor: 'camera',
  access_reader:  'reader',
  intercom:       'intercom',
  av_outlet:      'av',
  speaker:        'speaker',
  doorbell:       'doorbell',
};

const DEVICE_OPTIONS = [
  { value: 'camera',   label: 'Security Camera' },
  { value: 'reader',   label: 'Card Reader' },
  { value: 'intercom', label: 'Intercom Station' },
  { value: 'av',       label: 'TV/AV Outlet' },
  { value: 'speaker',  label: 'Speaker' },
  { value: 'doorbell', label: 'Doorbell/Call Button' },
];

const SUPPORT_OPTIONS = [
  { value: 'j-hook-sm', label: 'J-Hook Small (4")' },
  { value: 'j-hook-lg', label: 'J-Hook Large (7")' },
  { value: 'zip-tie',   label: 'Zip Tie' },
  { value: 'staple',    label: 'LV Staple' },
];

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

export function LVBuilder() {
  const { state, updateLVState, addLVDevice } = useEstimatorContext();
  const { lvState } = state;

  const lvCounts = Object.entries(state.takeoffCounts)
    .filter(([id, qty]) => id in LV_TAKEOFF_MAP && qty > 0);

  const preview = useMemo(() => calcLV(lvState), [lvState]);

  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Low Voltage Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        {lvCounts.length > 0 && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
            <div className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-2">
              From Takeoff — click to load
            </div>
            <div className="flex flex-wrap gap-2">
              {lvCounts.map(([id, qty]) => (
                <button
                  key={id}
                  onClick={() => updateLVState({ deviceType: LV_TAKEOFF_MAP[id], qty })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                    lvState.deviceType === LV_TAKEOFF_MAP[id] && lvState.qty === qty
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-teal-700 border-teal-300 hover:bg-teal-50'
                  }`}>
                  {ITEM_LABELS[id] ?? id} × {qty}
                </button>
              ))}
            </div>
            <p className="text-xs text-teal-500 mt-2">
              Click any device to load its count into the builder. Adjust run footage then Add to Bid.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3 items-end">

          <div>
            <label className="block text-xs text-gray-500 mb-1">Device</label>
            <select className={sel} value={lvState.deviceType}
              onChange={e => updateLVState({ deviceType: e.target.value })}>
              {DEVICE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Support</label>
            <select className={sel}
              value={lvState.supportType}
              onChange={e => updateLVState({ supportType: e.target.value as typeof lvState.supportType })}>
              {SUPPORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Run Ft</label>
            <input type="number" min={0} placeholder="e.g. 50" className={inp}
              value={lvState.runFt === 0 ? '' : lvState.runFt}
              onChange={e => updateLVState({ runFt: parseFloat(e.target.value) || 0 })} />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={lvState.qty}
              onChange={e => updateLVState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>

          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none pb-1.5">
            <input type="checkbox" className="rounded"
              checked={lvState.outdoor}
              onChange={e => updateLVState({ outdoor: e.target.checked })} />
            <span className="text-gray-700">Outdoor (WP box)</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateLVState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  lvState.diff === d.value
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {lvState.runFt <= 0 && (
              <span className="text-xs text-red-500">Footage required</span>
            )}
            <button
              onClick={() => addLVDevice()}
              disabled={lvState.runFt <= 0}
              className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              + Add to Bid
            </button>
          </div>
        </div>

        {preview && lvState.runFt > 0 && (
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
