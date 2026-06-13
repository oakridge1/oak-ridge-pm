'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcConduitRun } from '@/lib/estimator/calc';
import { COND_MAP } from '@/lib/estimator/bom';
import { EditablePreview } from './EditablePreview';

// ── Static option lists ──────────────────────────────────────────────────────

const CONDUIT_TYPES = [
  'EMT', 'Sch40 PVC', 'Sch80 PVC', 'Rigid', 'IMC',
  'Flex', 'Liquid Tight', 'NM-B',
];

const WIRE_SIZES = [
  'None', '#14', '#12', '#10', '#8', '#6', '#4', '#2', '#1',
  '1/0', '2/0', '3/0', '4/0', '250kcmil', '350kcmil', '500kcmil',
];

const GND_WIRE_SIZES = [
  '#14', '#12', '#10', '#8', '#6', '#4', '#2', '1/0', '2/0', '4/0',
];

const MAKEUP_OPTIONS = [
  { label: 'None',  value: 0  },
  { label: '1 ft',  value: 1  },
  { label: '2 ft',  value: 2  },
  { label: '3 ft',  value: 3  },
  { label: '6 ft',  value: 6  },
  { label: '12 ft', value: 12 },
  { label: '18 ft', value: 18 },
  { label: '24 ft', value: 24 },
];

const DIFF_OPTIONS = [
  { label: 'Normal',     value: 1.0  },
  { label: 'Difficult',  value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

// ── COND_MAP size derivation ─────────────────────────────────────────────────
// COND_MAP has flat keys: 'emt_34', 'pvc_1', etc.
// We filter by prefix to get available sizes for each conduit type.

const COND_TYPE_PFX: Record<string, string> = {
  'EMT': 'emt', 'IMC': 'emt',
  'Sch40 PVC': 'pvc', 'Sch80 PVC': 'p80',
  'Rigid': 'rigid', 'Flex': 'flex', 'Liquid Tight': 'lt',
};

// Ordered from smallest to largest
const SIZE_SFX_ORDER = ['12', '34', '1', '114', '112', '2', '212', '3', '312', '4'];

const SFX_TO_SIZE: Record<string, string> = {
  '12':  '1/2',   '34': '3/4',   '1':   '1',
  '114': '1-1/4', '112': '1-1/2', '2':  '2',
  '212': '2-1/2', '3':  '3',      '312': '3-1/2',
  '4':   '4',
};

const NMB_SIZES = ['14/2', '12/2', '12/3', '14/3', '10/2', '10/3'];

function getSizesForType(condType: string): string[] {
  if (condType === 'NM-B') return NMB_SIZES;
  const pfx = COND_TYPE_PFX[condType];
  if (!pfx) return [];
  return SIZE_SFX_ORDER
    .filter(sfx => `${pfx}_${sfx}` in COND_MAP)
    .map(sfx => SFX_TO_SIZE[sfx] ?? sfx);
}

// ── NEC minimum ground wire hint ─────────────────────────────────────────────
const NEC_HINT: Record<string, string> = {
  '#14': '#14', '#12': '#12', '#10': '#10', '#8': '#10',
  '#6': '#10',  '#4': '#8',   '#3': '#8',   '#2': '#8',
  '#1': '#8',   '1/0': '#6',  '2/0': '#6',  '3/0': '#4',
  '4/0': '#4',  '250kcmil': '#4', '350kcmil': '#2', '500kcmil': '1/0',
};

// ── Component ────────────────────────────────────────────────────────────────

export function ConduitRunBuilder() {
  const { state, updateCondRunState, setState } = useEstimatorContext();
  const { condRunState } = state;

  const condSizes = useMemo(
    () => getSizesForType(condRunState.condType),
    [condRunState.condType],
  );

  const preview = useMemo(
    () => calcConduitRun(condRunState),
    [condRunState],
  );

  const isNmb = condRunState.condType === 'NM-B';
  const necHint = condRunState.gndWire === 'none' && condRunState.wireSize !== 'None'
    ? NEC_HINT[condRunState.wireSize]
    : undefined;

  const handleCondTypeChange = (newType: string) => {
    const sizes = getSizesForType(newType);
    updateCondRunState({ condType: newType, condSize: sizes[0] ?? '3/4' });
  };

  const qtyLabel = condRunState.qty !== 1
    ? `${condRunState.qty} Runs`
    : '1 Run';

  const sel = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';
  const inp = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]';

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Conduit Run Builder
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">

        {/* Row 1: Type · Size · Conductors · Wire Size · Material · Support */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Conduit Type</label>
            <select className={sel} value={condRunState.condType}
              onChange={e => handleCondTypeChange(e.target.value)}>
              {CONDUIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Size</label>
            <select className={sel} value={condRunState.condSize}
              onChange={e => updateCondRunState({ condSize: e.target.value })}>
              {condSizes.length === 0
                ? <option value="">—</option>
                : condSizes.map(s => (
                    <option key={s} value={s}>{isNmb ? s : `${s}"`}</option>
                  ))
              }
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1"># Conductors</label>
            <select className={sel} value={condRunState.numCond}
              onChange={e => updateCondRunState({ numCond: parseInt(e.target.value) })}>
              {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Wire Size</label>
            <select className={sel} value={condRunState.wireSize}
              onChange={e => updateCondRunState({ wireSize: e.target.value })}>
              {WIRE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Material</label>
            <select className={sel} value={condRunState.wireMat}
              onChange={e => updateCondRunState({ wireMat: e.target.value })}>
              <option value="Cu">Cu</option>
              <option value="Al">Al</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Support Type</label>
            <select className={sel} value={condRunState.suppType}
              onChange={e => updateCondRunState({ suppType: e.target.value })}>
              <option value="1-Hole Strap">1-Hole Strap</option>
              <option value="Strut Clip">Strut Clip</option>
              <option value="Conduit Hanger">Conduit Hanger</option>
            </select>
          </div>
        </div>

        {/* Row 2: Feet · Qty · Checkboxes · Makeup · Ground · NEC hint */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 items-start">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Feet per Run</label>
            <input type="number" min={0} placeholder="e.g. 200" className={inp}
              value={condRunState.feet === 0 ? '' : condRunState.feet}
              onChange={e => updateCondRunState({ feet: parseFloat(e.target.value) || 0 })} />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1"># of Runs</label>
            <input type="number" min={1} className={inp}
              value={condRunState.qty}
              onChange={e => updateCondRunState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>

          <div className="space-y-1 pt-5">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input type="checkbox" className="rounded"
                checked={condRunState.spliceBox}
                onChange={e => updateCondRunState({ spliceBox: e.target.checked })} />
              <span className="text-gray-700">Splice box</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
              <input type="checkbox" className="rounded"
                checked={condRunState.underground}
                onChange={e => updateCondRunState({ underground: e.target.checked })} />
              <span className="text-gray-700">Underground</span>
            </label>
            {condRunState.underground && (
              <div className="pl-4 space-y-1">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="rounded"
                    checked={condRunState.sandBed}
                    onChange={e => updateCondRunState({ sandBed: e.target.checked })} />
                  <span className="text-xs text-gray-600">Sand bed (+$0.25/ft)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" className="rounded"
                    checked={condRunState.warnTape}
                    onChange={e => updateCondRunState({ warnTape: e.target.checked })} />
                  <span className="text-xs text-gray-600">Warn tape (+$0.08/ft)</span>
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Makeup per End</label>
            <select className={sel} value={condRunState.makeup}
              onChange={e => updateCondRunState({ makeup: parseInt(e.target.value) })}>
              {MAKEUP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Ground Wire</label>
            <select className={sel} value={condRunState.gndWire}
              onChange={e => updateCondRunState({ gndWire: e.target.value, gndMat: 'Cu' })}>
              <option value="none">None (bare/bonded)</option>
              {GND_WIRE_SIZES.map(s => (
                <option key={s} value={s}>{s} Cu</option>
              ))}
            </select>
          </div>

          <div className="pt-5">
            {necHint && (
              <span className="text-xs text-amber-600 font-medium">
                NEC min: {necHint}
              </span>
            )}
          </div>
        </div>

        {/* Row 3: Difficulty + Add */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateCondRunState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  condRunState.diff === d.value
                    ? 'bg-[#1e3a8a] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {condRunState.feet <= 0 && (
              <span className="text-xs text-red-500">Footage required</span>
            )}
          </div>
        </div>

        {/* Live preview — editable */}
        <EditablePreview
          assembly={condRunState.feet > 0 ? preview : null}
          storageKey="rl_default_conduit"
          addLabel={`+ Add ${qtyLabel}`}
          onAdd={asm => setState(s => ({
            ...s,
            savedRuns: [...s.savedRuns, {
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
