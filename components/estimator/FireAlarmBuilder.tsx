'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcFireAlarm } from '@/lib/estimator/calc';
import { ITEM_LABELS } from '@/lib/estimator/takeoffConstants';
import { EditablePreview } from './EditablePreview';

const FA_TAKEOFF_MAP: Record<string, string> = {
  fa_smoke:       'fad2',
  fa_heat:        'fad3',
  fa_smoke_co:    'fad4',
  fa_pull:        'fad1',
  fa_horn_strobe: 'fad5',
  fa_strobe:      'fad6',
  fa_lf_sounder:  'fad7',
  fa_beacon:      'fad8',
  fa_ctrl_mod:    'fad9',
  fa_monitor_mod: 'fad9',
  fa_duct_smoke:  'fad10',
  fa_annun:       'fad11',
  fa_panel_sm:    'fad12',
  fa_panel_md:    'fad13',
  fa_panel_lg:    'fad14',
  fa_radio:       'fad15',
};

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
  const { state, updateFAState, setState } = useEstimatorContext();
  const { faState } = state;

  const isPanel = PANEL_IDS.has(faState.deviceId);

  const faCounts = Object.entries(state.takeoffCounts)
    .filter(([id, qty]) => id in FA_TAKEOFF_MAP && qty > 0);

  const preview = useMemo(() => calcFireAlarm(faState), [faState]);

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Fire Alarm Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        {faCounts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="text-xs font-bold tracking-widest uppercase text-red-700 mb-2">
              From Takeoff — click to load
            </div>
            <div className="flex flex-wrap gap-2">
              {faCounts.map(([id, qty]) => (
                <button
                  key={id}
                  onClick={() => updateFAState({ deviceId: FA_TAKEOFF_MAP[id], qty })}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ${
                    faState.deviceId === FA_TAKEOFF_MAP[id] && faState.qty === qty
                      ? 'bg-red-700 text-white border-red-700'
                      : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                  }`}>
                  {ITEM_LABELS[id] ?? id} × {qty}
                </button>
              ))}
            </div>
            <p className="text-xs text-red-500 mt-2">
              Click any device to load its count into the builder. Adjust whip footage then Add to Bid.
            </p>
          </div>
        )}
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
          storageKey="rl_default_fa"
          onAdd={asm => setState(s => ({
            ...s,
            savedFA: [...s.savedFA, {
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
