'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcFloorBox, type FloorBoxParams } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

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
  const { state, updateFloorBoxState, addFloorBox } = useEstimatorContext();
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

  const R = getRates();

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
          <button
            onClick={() => addFloorBox()}
            className="bg-[#1e3a8a] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors">
            + Add to Bid
          </button>
        </div>

        {preview && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {SUBSTRATE_LABELS[floorBoxState.substrate]} — {floorBoxState.gangs}-gang × {floorBoxState.qty}
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
