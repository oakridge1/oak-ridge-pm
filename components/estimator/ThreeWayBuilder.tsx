'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcThreeWay } from '@/lib/estimator/calc';
import { EditablePreview } from './EditablePreview';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

export function ThreeWayBuilder() {
  const { state, updateThreeWayState, setState } = useEstimatorContext();
  const { threeWayState } = state;

  const preview = useMemo(() => calcThreeWay(threeWayState), [threeWayState]);

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

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
                    ? 'bg-[#1e3a8a] text-white'
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
          </div>
        </div>

        <EditablePreview
          assembly={threeWayState.travelerFt > 0 ? preview : null}
          storageKey="rl_default_3way"
          onAdd={asm => setState(s => ({
            ...s,
            savedThreeWay: [...s.savedThreeWay, {
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
