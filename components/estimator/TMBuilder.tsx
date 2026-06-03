'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { applyMarkup, type SavedAssembly } from '@/lib/estimator/constants';

const MARKUP_OPTIONS = [
  { label: 'Bulk (15%)',  value: 'bulk'  as const },
  { label: 'Light (8%)', value: 'light' as const },
  { label: 'None',       value: 'none'  as const },
];

export function TMBuilder() {
  const { state, updateTMState, setState, removeAssembly } = useEstimatorContext();
  const { tmState, savedTM } = state;

  function handleAdd() {
    if (!tmState.desc.trim() && tmState.mat <= 0 && tmState.lab <= 0) return;
    const matWithMarkup = applyMarkup(tmState.mat, tmState.markup);
    const asm: SavedAssembly = {
      label: tmState.desc.trim() || 'T&M Item',
      mat: matWithMarkup,
      lab: tmState.lab,
      lines: [{
        name: tmState.desc.trim() || 'T&M Item',
        qty: 1, unit: 'EA',
        mat: matWithMarkup,
        lab: tmState.lab,
      }],
    };
    setState(s => ({ ...s, savedTM: [...s.savedTM, asm] }));
    updateTMState({ desc: '', mat: 0, lab: 0, markup: 'bulk' });
  }

  const inp = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        T&amp;M / Misc Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-gray-500 mb-1">Description</label>
            <input type="text" placeholder="e.g. Extra outlets — office" className={`${inp} w-full`}
              value={tmState.desc}
              onChange={e => updateTMState({ desc: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mat $</label>
            <input type="number" min={0} placeholder="0" className={`${inp} w-24`}
              value={tmState.mat === 0 ? '' : tmState.mat}
              onChange={e => updateTMState({ mat: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Labor $</label>
            <input type="number" min={0} placeholder="0" className={`${inp} w-24`}
              value={tmState.lab === 0 ? '' : tmState.lab}
              onChange={e => updateTMState({ lab: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Markup</label>
            <select className={inp} value={tmState.markup}
              onChange={e => updateTMState({ markup: e.target.value as typeof tmState.markup })}>
              {MARKUP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors pb-1.5">
            + Add T&amp;M
          </button>
        </div>

        {savedTM.length > 0 && (
          <div className="border-t border-gray-100 pt-3 space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Saved T&amp;M Items ({savedTM.length})</p>
            {savedTM.map((asm, i) => (
              <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800 truncate block">{asm.label}</span>
                  <span className="text-xs text-gray-400">
                    Mat: ${asm.mat.toFixed(2)} · Lab: ${asm.lab.toFixed(2)}
                  </span>
                </div>
                <button
                  onClick={() => removeAssembly('savedTM', i)}
                  className="ml-3 text-xs text-red-500 hover:text-red-700 shrink-0">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
