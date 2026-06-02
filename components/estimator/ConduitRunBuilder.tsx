'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcConduitRun } from '@/lib/estimator/calc';
import { COND_MAP } from '@/lib/estimator/bom';
import { getRates } from '@/lib/estimator/constants';

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
  const { state, updateCondRunState, addConduitRun } = useEstimatorContext();
  const { condRunState } = state;

  const condSizes = useMemo(
    () => getSizesForType(condRunState.condType),
    [condRunState.condType],
  );

  const preview = useMemo(
    () => calcConduitRun(condRunState),
    [condRunState],
  );

  const R = getRates();
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

  const sel = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

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
                    ? 'bg-[#002D72] text-white'
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
            <button
              onClick={() => addConduitRun()}
              disabled={condRunState.feet <= 0}
              className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              + Add {qtyLabel}
            </button>
          </div>
        </div>

        {/* Live preview */}
        {preview && condRunState.feet > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {isNmb ? condRunState.condSize : `${condRunState.condSize}"`}{' '}
              {condRunState.condType} {condRunState.numCond}×{condRunState.wireSize} —{' '}
              {condRunState.feet}ft ×{condRunState.qty}
            </p>
            <PreviewTable lines={preview.lines} totalMat={preview.mat} totalLab={preview.lab} laborRate={R.labor} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared preview table ─────────────────────────────────────────────────────

interface PreviewTableProps {
  lines:      { name: string; qty: number; unit: string; mat: number; lab: number }[];
  totalMat:   number;
  totalLab:   number;
  laborRate:  number;
}

function PreviewTable({ lines, totalMat, totalLab, laborRate }: PreviewTableProps) {
  return (
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
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-0.5 text-gray-700 pr-2">{line.name}</td>
              <td className="text-right py-0.5 text-gray-600">{line.qty}</td>
              <td className="text-right py-0.5 text-gray-400">{line.unit}</td>
              <td className="text-right py-0.5 text-gray-700">
                {line.mat > 0 ? `$${line.mat.toFixed(2)}` : ''}
              </td>
              <td className="text-right py-0.5 text-gray-700">
                {line.lab > 0 ? `${(line.lab / laborRate).toFixed(2)} h` : ''}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold text-gray-800 border-t border-gray-200">
            <td className="py-1" colSpan={3}>Total</td>
            <td className="text-right py-1">${totalMat.toFixed(2)}</td>
            <td className="text-right py-1">{(totalLab / laborRate).toFixed(2)} h</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
