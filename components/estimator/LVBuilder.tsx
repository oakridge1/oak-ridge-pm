'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates, applyMarkup, type SavedAssembly } from '@/lib/estimator/constants';
import { getBomItem } from '@/lib/estimator/bom';

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.0  },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

const LV_LABOR: Record<string, number> = {
  camera: 0.75, reader: 0.85, intercom: 1.00,
  av: 0.60, speaker: 0.50, doorbell: 0.60,
};

const DEVICE_LABELS: Record<string, string> = {
  camera: 'Camera', reader: 'Card Reader', intercom: 'Intercom',
  av: 'AV Device', speaker: 'Speaker', doorbell: 'Doorbell',
};

const MAKEUP_OPTIONS = [
  { label: 'None',  value: 0  },
  { label: '3 ft',  value: 3  },
  { label: '5 ft',  value: 5  },
  { label: '10 ft', value: 10 },
];

function buildLV(
  deviceType: string, location: string,
  feet: number, makeup: number, qty: number, diff: number,
): SavedAssembly | null {
  if (feet <= 0 || qty <= 0) return null;
  const R = getRates();
  const lhrEa = LV_LABOR[deviceType] ?? 0.75;
  const devLabel = DEVICE_LABELS[deviceType] ?? deviceType;
  const lines: SavedAssembly['lines'] = [];

  // LV cable (lvc1: Cat6/Coax/2-wire per ft)
  const totalFt = Math.ceil((feet + makeup * 2) / 10) * 10 * qty;
  try {
    const cable = getBomItem('lvc1');
    lines.push({
      name: `LV cable (${totalFt}ft)`,
      qty: totalFt, unit: 'FT',
      mat: applyMarkup(cable.mat * totalFt, cable.mk),
      lab: cable.lhr * totalFt * R.labor,
    });
  } catch {
    lines.push({
      name: `LV cable (${totalFt}ft)`,
      qty: totalFt, unit: 'FT',
      mat: applyMarkup(0.375 * totalFt, 'bulk'),
      lab: 0.010 * totalFt * R.labor,
    });
  }

  // LV staples (lvc3)
  const stapleQty = Math.ceil(feet * qty / 4) + 2 * qty;
  try {
    const staple = getBomItem('lvc3');
    lines.push({
      name: `LV staple (${stapleQty})`,
      qty: stapleQty, unit: 'EA',
      mat: applyMarkup(staple.mat * stapleQty, staple.mk),
      lab: staple.lhr * stapleQty * R.labor,
    });
  } catch {
    lines.push({
      name: `LV staple (${stapleQty})`,
      qty: stapleQty, unit: 'EA',
      mat: applyMarkup(0.044 * stapleQty, 'bulk'),
      lab: 0,
    });
  }

  // Device — PER QUOTE
  lines.push({
    name: `${devLabel} ${location} (per quote)`,
    qty, unit: 'EA', mat: 0.01 * qty, lab: 0,
  });

  // Install labor
  lines.push({
    name: `${devLabel} install (${qty} × ${lhrEa}hr × diff ${diff})`,
    qty, unit: 'EA', mat: 0,
    lab: lhrEa * qty * diff * R.labor,
  });

  const mat = lines.reduce((s, l) => s + l.mat, 0);
  const lab = lines.reduce((s, l) => s + l.lab, 0);
  return {
    label: `LV — ${devLabel} ${location} — ${feet}ft × ${qty}`,
    mat, lab, lines,
  };
}

export function LVBuilder() {
  const { state, updateLVState, setState } = useEstimatorContext();
  const { lvState } = state;

  const preview = useMemo(
    () => buildLV(lvState.deviceType, lvState.location, lvState.feet, lvState.makeup, lvState.qty, lvState.diff),
    [lvState],
  );

  const R = getRates();

  const sel = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';
  const inp = 'w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]';

  function handleAdd() {
    const asm = buildLV(lvState.deviceType, lvState.location, lvState.feet, lvState.makeup, lvState.qty, lvState.diff);
    if (!asm) return;
    setState(s => ({ ...s, savedLV: [...s.savedLV, asm] }));
  }

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-2">
        Low Voltage Builder
      </h2>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Device Type</label>
            <select className={sel} value={lvState.deviceType}
              onChange={e => updateLVState({ deviceType: e.target.value as typeof lvState.deviceType })}>
              {Object.entries(DEVICE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Location</label>
            <select className={sel} value={lvState.location}
              onChange={e => updateLVState({ location: e.target.value as 'indoor' | 'outdoor' })}>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Feet</label>
            <input type="number" min={0} placeholder="e.g. 50" className={inp}
              value={lvState.feet === 0 ? '' : lvState.feet}
              onChange={e => updateLVState({ feet: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Makeup/End</label>
            <select className={sel} value={lvState.makeup}
              onChange={e => updateLVState({ makeup: parseInt(e.target.value) })}>
              {MAKEUP_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty</label>
            <input type="number" min={1} className={inp}
              value={lvState.qty}
              onChange={e => updateLVState({ qty: Math.max(1, parseInt(e.target.value) || 1) })} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex gap-1">
            {DIFF_OPTIONS.map(d => (
              <button key={d.value}
                onClick={() => updateLVState({ diff: d.value })}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  lvState.diff === d.value
                    ? 'bg-[#002D72] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {lvState.feet <= 0 && (
              <span className="text-xs text-red-500">Footage required</span>
            )}
            <button
              onClick={handleAdd}
              disabled={lvState.feet <= 0}
              className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              + Add to Bid
            </button>
          </div>
        </div>

        {preview && lvState.feet > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-medium text-gray-500 mb-2">
              Preview: {DEVICE_LABELS[lvState.deviceType]} {lvState.location} — {lvState.feet}ft × {lvState.qty}
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
