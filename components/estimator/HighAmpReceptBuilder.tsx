'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcHighAmpRecept, type HighAmpReceptParams } from '@/lib/estimator/calc';
import { EditablePreview } from './EditablePreview';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

// Map harState.receptType values (which may use various conventions) to calc param keys
const RECEPT_CALC_KEY: Record<string, HighAmpReceptParams['receptType']> = {
  '30A': '30A', 'recept_30a': '30A',
  '50A': '50A', 'recept_50a': '50A',
  '240V': '240V', 'recept_240v': '240V',
  'twist': 'twist', 'recept_twist': 'twist',
};

const RECEPT_LABELS: Record<string, string> = {
  '30A': '30A Dryer',
  '50A': '50A Range',
  '240V': '240V Standard',
  'twist': 'Twist-Lock',
};

export function HighAmpReceptBuilder() {
  const { state, updateHARState, setState } = useEstimatorContext();
  const { harState } = state;

  const preview = useMemo(() => {
    const calcType = RECEPT_CALC_KEY[harState.receptType] ?? '30A';
    const p: HighAmpReceptParams = {
      receptType: calcType,
      whipFeet:   harState.whipFt,
      qty:        harState.qty,
      diff:       harState.diff,
    };
    return calcHighAmpRecept(p);
  }, [harState]);


  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  const displayLabel = RECEPT_LABELS[RECEPT_CALC_KEY[harState.receptType] ?? '30A'] ?? harState.receptType;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        High-Amp Receptacle Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recept Type</label>
            <select className={sel} value={RECEPT_CALC_KEY[harState.receptType] ?? '30A'}
              onChange={e => updateHARState({ receptType: e.target.value })}>
              {Object.entries(RECEPT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Whip Ft</label>
            <input type="number" min={0} placeholder="e.g. 20" className={inp}
              value={harState.whipFt === 0 ? '' : harState.whipFt}
              onChange={e => updateHARState({ whipFt: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={harState.qty}
              onChange={e => updateHARState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateHARState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  harState.diff === d.value
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
          storageKey="rl_default_har"
          onAdd={asm => setState(s => ({
            ...s,
            savedHAR: [...s.savedHAR, {
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
