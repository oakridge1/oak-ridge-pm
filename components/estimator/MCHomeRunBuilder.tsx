'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcMCHomeRun } from '@/lib/estimator/calc';
import { EditablePreview } from './EditablePreview';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

const MAKEUP_OPTIONS = [
  { label: 'None',  value: 0  },
  { label: '3 ft',  value: 3  },
  { label: '5 ft',  value: 5  },
  { label: '10 ft', value: 10 },
];

export function MCHomeRunBuilder() {
  const { state, updateMCHRState, setState } = useEstimatorContext();
  const { mcHRState } = state;

  const preview = useMemo(() => calcMCHomeRun(mcHRState), [mcHRState]);

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        MC Home Run Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Wire Size</label>
            <select className={sel} value={mcHRState.wireSize}
              onChange={e => updateMCHRState({ wireSize: e.target.value as '#14' | '#12' | '#10' })}>
              <option value="#14">#14</option>
              <option value="#12">#12</option>
              <option value="#10">#10</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1"># Cond</label>
            <select className={sel} value={mcHRState.numCond}
              onChange={e => updateMCHRState({ numCond: parseInt(e.target.value) as 2 | 3 })}>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Breaker</label>
            <select className={sel} value={mcHRState.bkrSize}
              onChange={e => updateMCHRState({ bkrSize: e.target.value as '15A' | '20A' | '30A' })}>
              <option value="15A">15A</option>
              <option value="20A">20A</option>
              <option value="30A">30A</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Support</label>
            <select className={sel} value={mcHRState.suppType}
              onChange={e => updateMCHRState({ suppType: e.target.value as 'Staple' | 'Strap' | 'J-Hook' })}>
              <option value="Staple">Staple</option>
              <option value="Strap">Strap</option>
              <option value="J-Hook">J-Hook</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Feet</label>
            <input type="number" min={0} placeholder="e.g. 80" className={inp}
              value={mcHRState.feet === 0 ? '' : mcHRState.feet}
              onChange={e => updateMCHRState({ feet: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Makeup/End</label>
            <select className={sel} value={mcHRState.makeup}
              onChange={e => updateMCHRState({ makeup: parseInt(e.target.value) })}>
              {MAKEUP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateMCHRState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  mcHRState.diff === d.value
                    ? 'bg-[#1e3a8a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {mcHRState.feet <= 0 && (
              <span className="text-xs text-red-500">Footage required</span>
            )}
          </div>
        </div>

        <EditablePreview
          assembly={mcHRState.feet > 0 ? preview : null}
          storageKey="rl_default_mc_hr"
          onAdd={asm => setState(s => ({
            ...s,
            savedMCHR: [...s.savedMCHR, {
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
