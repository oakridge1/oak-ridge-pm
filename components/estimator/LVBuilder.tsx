'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcLV } from '@/lib/estimator/calc';
import { EditablePreview } from './EditablePreview';
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
  const { state, updateLVState, setState } = useEstimatorContext();
  const { lvState } = state;

  const lvCounts = Object.entries(state.takeoffCounts)
    .filter(([id, qty]) => id in LV_TAKEOFF_MAP && qty > 0);

  const preview = useMemo(() => calcLV(lvState), [lvState]);


  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

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
                    ? 'bg-[#1e3a8a] text-white'
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
          </div>
        </div>

        <EditablePreview
          assembly={lvState.runFt > 0 ? preview : null}
          storageKey="rl_default_lv"
          onAdd={asm => setState(s => ({
            ...s,
            savedLV: [...s.savedLV, {
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
