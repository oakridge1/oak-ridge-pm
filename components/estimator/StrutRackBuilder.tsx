'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcRack } from '@/lib/estimator/calc';
import { EditablePreview } from './EditablePreview';

type MountType  = 'wall' | 'hang';
type RackSize   = '12' | '18' | '24' | '48' | '60';
type RodLength  = 'none' | '18' | '24' | '36' | '48' | '60';

const RACK_SIZES:  RackSize[]  = ['12', '18', '24', '48', '60'];
const ROD_LENGTHS: RodLength[] = ['none', '18', '24', '36', '48', '60'];

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

export function StrutRackBuilder() {
  const { state, updateRackState, setState } = useEstimatorContext();
  const { rackState } = state;

  const preview = useMemo(() => calcRack(rackState), [rackState]);

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Strut Rack Builder
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">

        {/* Row 1: fields */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mount Type</label>
            <select className={sel} value={rackState.mountType}
              onChange={e => updateRackState({
                mountType: e.target.value as MountType,
                rodLength: e.target.value === 'wall' ? 'none' : rackState.rodLength,
              })}>
              <option value="wall">Wall Mount</option>
              <option value="hang">Hanging (rod)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Rack Size</label>
            <select className={sel} value={rackState.rackSize}
              onChange={e => updateRackState({ rackSize: e.target.value as RackSize })}>
              {RACK_SIZES.map(s => (
                <option key={s} value={s}>{s}&quot;</option>
              ))}
            </select>
          </div>

          {rackState.mountType === 'hang' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Rod Length</label>
              <select className={sel} value={rackState.rodLength}
                onChange={e => updateRackState({ rodLength: e.target.value as RodLength })}>
                {ROD_LENGTHS.map(l => (
                  <option key={l} value={l}>{l === 'none' ? 'None' : `${l}"`}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1}
              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              value={rackState.qty}
              onChange={e => updateRackState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>

          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none pb-1.5">
            <input type="checkbox" className="rounded"
              checked={rackState.caps}
              onChange={e => updateRackState({ caps: e.target.checked })} />
            <span className="text-gray-700">End caps</span>
          </label>
        </div>

        {/* Row 2: Difficulty + Add */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateRackState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  rackState.diff === d.value
                    ? 'bg-[#1e3a8a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live preview (always shown) */}
        <EditablePreview
          assembly={preview}
          storageKey="rl_default_rack"
          onAdd={asm => setState(s => ({
            ...s,
            savedRacks: [...s.savedRacks, {
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
