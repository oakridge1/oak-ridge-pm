'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcFloorBox, type FloorBoxParams } from '@/lib/estimator/calc';
import { EditablePreview } from './EditablePreview';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

const SUBSTRATE_LABELS: Record<string, string> = {
  wood:           'Wood subfloor',
  concrete_new:   'Concrete (new pour)',
  concrete_core:  'Concrete (core drill)',
};

// Labor reference: wood 0.75+0.25/gang, concrete_new 1.00+0.25/gang, concrete_core 1.50+0.35/gang
const FLOOR_LAB_HINT: Record<string, string> = {
  wood:          '0.75 + 0.25/gang hr',
  concrete_new:  '1.00 + 0.25/gang hr',
  concrete_core: '1.50 + 0.35/gang hr',
};

export function FloorBoxBuilder() {
  const { state, updateFloorBoxState, setState } = useEstimatorContext();
  const { floorBoxState } = state;

  const preview = useMemo(() => {
    const p: FloorBoxParams = {
      floorType: floorBoxState.substrate,
      gangs:     floorBoxState.gangs,
      qty:       floorBoxState.qty,
      quoted:    floorBoxState.mountMat > 0,
      diff:      floorBoxState.diff,
    };
    return calcFloorBox(p);
  }, [floorBoxState]);


  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Floor Box Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Substrate</label>
            <select className={sel} value={floorBoxState.substrate}
              onChange={e => updateFloorBoxState({ substrate: e.target.value as FloorBoxParams['floorType'] })}>
              {Object.entries(SUBSTRATE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Gangs</label>
            <input type="number" min={1} max={6} className={inp}
              value={floorBoxState.gangs}
              onChange={e => updateFloorBoxState({ gangs: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mount Mat $</label>
            <input type="number" min={0} placeholder="0" className={inp}
              value={floorBoxState.mountMat === 0 ? '' : floorBoxState.mountMat}
              onChange={e => updateFloorBoxState({ mountMat: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={floorBoxState.qty}
              onChange={e => updateFloorBoxState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
          <div className="pb-1.5">
            <span className="text-xs text-gray-400">
              Labor: {FLOOR_LAB_HINT[floorBoxState.substrate]}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateFloorBoxState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  floorBoxState.diff === d.value
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
          storageKey="rl_default_floor_box"
          onAdd={asm => setState(s => ({
            ...s,
            savedFloorBox: [...s.savedFloorBox, {
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
