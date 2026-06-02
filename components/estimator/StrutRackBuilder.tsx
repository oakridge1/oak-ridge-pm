'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcRack } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

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
  const { state, updateRackState, addRack } = useEstimatorContext();
  const { rackState } = state;

  const preview = useMemo(() => calcRack(rackState), [rackState]);
  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

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
              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
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
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => addRack()}
            className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors">
            + Add to Bid
          </button>
        </div>

        {/* Live preview (always shown) */}
        {preview && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {rackState.rackSize}&quot;{' '}
              {rackState.mountType === 'wall' ? 'wall' : 'hanging'} rack ×{rackState.qty}
              {rackState.mountType === 'hang' && rackState.rodLength !== 'none'
                ? ` · ${rackState.rodLength}" rod`
                : ''}
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
