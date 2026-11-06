'use client';

// Display-only preview of job-level adders. Inputs are local state (never saved); nothing here
// feeds any total. Existing values come in as props so the total formula is not copied again.

import { useMemo, useState } from 'react';
import { computeAdders, type AdderRates, type LiftUnit } from '@/lib/estimator/adders';
import { fmt$ } from '@/lib/estimator/format';

interface Props {
  matTotal: number;
  effectiveLaborTotal: number;
  subtotal: number;
  /** The grand total currently shown on the Bid Summary. */
  grandTotal: number;
  rates: AdderRates;
}

const inputCls = 'w-24 border border-gray-300 rounded px-2 py-1 text-right text-sm font-mono';

export function AddersPreviewPanel({ matTotal, effectiveLaborTotal, subtotal, grandTotal, rates }: Props) {
  const [fittingsPct, setFittingsPct] = useState('');
  const [nonProdPct, setNonProdPct] = useState('');
  const [liftQty, setLiftQty] = useState('');
  const [liftRate, setLiftRate] = useState('');
  const [liftUnit, setLiftUnit] = useState<LiftUnit>('weeks');
  const [tempPower, setTempPower] = useState('');

  const preview = useMemo(
    () => computeAdders(
      { matTotal, effectiveLaborTotal, subtotal },
      { fittingsPct, nonProdPct, liftQty, liftRate, liftUnit, tempPower },
      rates,
    ),
    [matTotal, effectiveLaborTotal, subtotal, fittingsPct, nonProdPct, liftQty, liftRate, liftUnit, tempPower, rates],
  );
  const add = (key: string) => preview.rows.find((r) => r.key === key)?.wouldAdd ?? 0;

  const row = (label: string, hint: string, inputs: React.ReactNode, key: string) => (
    <tr className="border-b border-gray-100">
      <td className="py-1.5 pr-3 text-gray-700 align-top">
        {label}
        <div className="text-[11px] text-gray-400">{hint}</div>
      </td>
      <td className="py-1.5 pr-3">{inputs}</td>
      <td className="py-1.5 text-right font-mono text-gray-800 w-28 align-top">{fmt$(add(key))}</td>
    </tr>
  );

  return (
    <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
      <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-1">
        Job adders (preview – not in totals)
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Preview only. Fittings are already inside most assemblies, so a fittings % here would be on top of them.
        Enter any existing lift rental on Permits/Subs OR here, not both.
      </p>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-400 font-semibold border-b border-gray-200">
            <th className="text-left pb-1">Adder</th>
            <th className="text-left pb-1">What-if input</th>
            <th className="text-right pb-1 w-28">Would add</th>
          </tr>
        </thead>
        <tbody>
          {row('Fittings / misc material', '% of material (before profit)',
            <span className="inline-flex items-center gap-1">
              <input type="number" min="0" step="any" inputMode="decimal" value={fittingsPct}
                placeholder="0" onChange={(e) => setFittingsPct(e.target.value)} className={inputCls} />%
            </span>, 'fittings')}
          {row('Non-productive labor', '% of labor, plus overhead',
            <span className="inline-flex items-center gap-1">
              <input type="number" min="0" step="any" inputMode="decimal" value={nonProdPct}
                placeholder="0" onChange={(e) => setNonProdPct(e.target.value)} className={inputCls} />%
            </span>, 'nonProd')}
          {row('Lift rental', `qty × rate, plus ${(rates.bulk * 100).toFixed(1)}% markup (same as Rental)`,
            <span className="inline-flex flex-wrap items-center gap-1">
              <input type="number" min="0" step="any" inputMode="decimal" value={liftQty}
                placeholder="0" onChange={(e) => setLiftQty(e.target.value)} className="w-16 border border-gray-300 rounded px-2 py-1 text-right text-sm font-mono" />
              <select value={liftUnit} onChange={(e) => setLiftUnit(e.target.value as LiftUnit)}
                className="border border-gray-300 rounded px-1 py-1 text-sm">
                <option value="days">days</option>
                <option value="weeks">weeks</option>
              </select>
              ×
              <input type="number" min="0" step="any" inputMode="decimal" value={liftRate}
                placeholder="$ rate" onChange={(e) => setLiftRate(e.target.value)} className={inputCls} />
              <span className="text-gray-400">/{liftUnit === 'days' ? 'day' : 'week'}</span>
            </span>, 'lift')}
          {row('Temp power', 'lump sum $',
            <input type="number" min="0" step="any" inputMode="decimal" value={tempPower}
              placeholder="$0" onChange={(e) => setTempPower(e.target.value)} className={inputCls} />, 'tempPower')}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#1e3a8a] font-bold">
            <td className="pt-2 text-gray-700" colSpan={2}>Total would add (before profit)</td>
            <td className="pt-2 text-right font-mono">{fmt$(preview.totalAdd)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-3 pt-2 border-t border-gray-100 text-sm space-y-1">
        <div className="flex justify-between text-gray-600">
          <span>Grand total change (after overhead on labor, profit on all)</span>
          <span className="font-mono">{fmt$(preview.totalGrandChange)}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Current grand total</span>
          <span className="font-mono">{fmt$(grandTotal)}</span>
        </div>
        <div className="flex justify-between font-semibold text-[#1e3a8a]">
          <span>Grand total would be</span>
          <span className="font-mono">{fmt$(grandTotal + preview.totalGrandChange)}</span>
        </div>
      </div>
    </div>
  );
}
