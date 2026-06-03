'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates } from '@/lib/estimator/constants';

// ── Format helpers ─────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtH = (n: number) => n.toFixed(2) + ' hrs';

// ── Job condition options ──────────────────────────────────────────────────────

const COND_OPTIONS = [
  { label: 'Clean / New Construction',  value: 1.00 },
  { label: 'Light Retrofit / Occupied', value: 1.15 },
  { label: 'Heavy Retrofit / Tight',    value: 1.25 },
];

// ── Breakdown key → display label ─────────────────────────────────────────────

const BREAKDOWN_LABELS: Record<string, string> = {
  conduitRuns:    'Conduit Runs',
  racks:          'Strut Racks',
  mcHomeRuns:     'MC Home Runs',
  threeWays:      'Three-Way Circuits',
  dataDrops:      'Data Locations',
  fireAlarm:      'Fire Alarm',
  gear:           'Commercial Gear',
  floorBoxes:     'Floor Boxes',
  highAmpRecepts: 'High-Amp Receptacles',
  misc:           'Misc / T&M / LV / Custom',
  lighting:       'Fixtures & Devices',
  heating:        'Heating',
  tempPower:      'Temp Power',
  underground:    'Underground',
  other:          'Other',
};

// ── BidSummaryTab ──────────────────────────────────────────────────────────────

export function BidSummaryTab() {
  const { state, setState, calcBid, exportJob } = useEstimatorContext();
  const R = getRates();

  // ── Conditions ────────────────────────────────────────────────────────────
  const setCondMult = (v: number) =>
    setState(s => ({ ...s, jobCondMult: v }));
  const toggleHeight = () =>
    setState(s => ({ ...s, heightAdder: !s.heightAdder }));

  // ── Assembly totals (from calcBid hook) ───────────────────────────────────
  // NOTE: result.permits and result.subs are rate constants (0.05, 0.03),
  // NOT dollar amounts. We compute actual permit/sub/rental totals below.
  const result = calcBid();

  // ── Permit / sub / rental totals (computed from state directly) ───────────
  const permitEntries = state.permits.filter(p => !p.desc.startsWith('[Rental]'));
  const rentalEntries = state.permits.filter(p =>  p.desc.startsWith('[Rental]'));

  const permitBase  = permitEntries.reduce((s, p) => s + p.cost, 0);
  const rentalBase  = rentalEntries.reduce((s, p) => s + p.cost, 0);
  const subBase     = state.subs.reduce((s, p) => s + p.cost, 0);

  const permitTotal = permitBase  * (1 + R.permit);
  const rentalTotal = rentalBase  * (1 + R.bulk);
  const subTotal    = subBase     * (1 + R.sub);

  // ── Labor: apply heightAdder on top of condMult (condMult already in result.laborTotal) ──
  const matTotal           = result.matTotal;
  const laborBase          = result.laborTotal;                        // condMult already applied
  const heightMult         = state.heightAdder ? 1.10 : 1.0;
  const effectiveLaborTotal = laborBase * heightMult;
  const effectiveOverhead  = effectiveLaborTotal * R.overhead;

  // ── Grand total (correct, independent of result.grandTotal) ──────────────
  const subtotal   = matTotal + effectiveLaborTotal + effectiveOverhead
                   + permitTotal + rentalTotal + subTotal;
  const profit     = subtotal * R.profit;
  const grandTotal = subtotal + profit;

  const totalHrs   = effectiveLaborTotal / R.labor;
  // Base labor hours before condMult (for reference display)
  const laborBaseHrs = state.jobCondMult !== 1.0
    ? (laborBase / state.jobCondMult) / R.labor
    : totalHrs;

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  function copyToClipboard() {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    const lines: string[] = [
      `Oak Ridge Electrical — Bid Summary`,
      `Job: ${state.jobName}`,
      `Date: ${today}`,
      ``,
      `── ASSEMBLY COSTS ──────────────────────`,
      `  Material:       ${fmt$(matTotal)}`,
      `  Labor (${fmtH(totalHrs)}):  ${fmt$(effectiveLaborTotal)}`,
      `  Overhead (${(R.overhead * 100).toFixed(0)}%): ${fmt$(effectiveOverhead)}`,
      ``,
      `── PERMITS / SUBS / RENTAL ────────────`,
      `  Permits:        ${fmt$(permitTotal)}`,
      `  Subcontractors: ${fmt$(subTotal)}`,
      `  Equipment Rent: ${fmt$(rentalTotal)}`,
      ``,
      `── TOTALS ─────────────────────────────`,
      `  Subtotal:       ${fmt$(subtotal)}`,
      `  Profit (${(R.profit * 100).toFixed(0)}%):   ${fmt$(profit)}`,
      `  Grand Total:    ${fmt$(grandTotal)}`,
      ``,
      `── JOB CONDITIONS ─────────────────────`,
      `  Condition mult: ${state.jobCondMult.toFixed(2)}x`,
      `  Height adder:   ${state.heightAdder ? 'Yes (+10%)' : 'No'}`,
    ];

    // Non-zero breakdown lines
    const nonZero = Object.entries(result.breakdown)
      .filter(([, v]) => v.mat + v.lab > 0);
    if (nonZero.length > 0) {
      lines.push(``, `── BREAKDOWN ──────────────────────────`);
      for (const [key, v] of nonZero) {
        const label = BREAKDOWN_LABELS[key] ?? key;
        lines.push(`  ${label}: ${fmt$(v.mat + v.lab)}`);
      }
    }

    navigator.clipboard.writeText(lines.join('\n')).catch(() => {
      /* clipboard permission denied — silent fail */
    });
  }

  // ── Export JSON ───────────────────────────────────────────────────────────
  function handleExport() {
    const json    = exportJob();
    const blob    = new Blob([json], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    const safeName = state.jobName.replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'job';
    a.href        = url;
    a.download    = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Empty guard ───────────────────────────────────────────────────────────
  const isEmpty =
    matTotal === 0 && laborBase === 0 &&
    permitBase === 0 && subBase === 0 && rentalBase === 0;

  return (
    <div className="max-w-3xl">

      {/* ── JOB CONDITIONS ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
          Job Conditions
        </div>

        {/* Condition multiplier */}
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Labor difficulty multiplier:</p>
          <div className="flex flex-wrap gap-2">
            {COND_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setCondMult(opt.value)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  state.jobCondMult === opt.value
                    ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#1a3a5c]'
                }`}
              >
                {opt.label}
                <span className="ml-1 font-mono opacity-70">
                  ({opt.value.toFixed(2)}×)
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Height adder */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={state.heightAdder}
            onChange={toggleHeight}
            className="w-4 h-4 accent-[#1a3a5c]"
          />
          <span className="text-sm text-gray-700">
            Height / overhead-work adder
            <span className="ml-1 text-xs text-gray-400">(+10% to labor)</span>
          </span>
        </label>
      </div>

      {/* ── EMPTY STATE ─────────────────────────────────────────────────────── */}
      {isEmpty && (
        <div className="bg-white rounded border border-gray-200 p-8 mb-4 text-center text-gray-400 text-sm shadow-sm">
          No assemblies, permits, subs, or rentals have been added yet.
        </div>
      )}

      {/* ── ASSEMBLY BREAKDOWN ──────────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
            Assembly Breakdown
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 font-semibold border-b border-gray-200">
                <th className="text-left pb-1">Category</th>
                <th className="text-right pb-1 w-28">Material</th>
                <th className="text-right pb-1 w-28">Labor</th>
                <th className="text-right pb-1 w-28">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.breakdown)
                .filter(([, v]) => v.mat + v.lab > 0)
                .map(([key, v]) => (
                  <tr key={key} className="border-b border-gray-100 hover:bg-blue-50/30">
                    <td className="py-1.5 text-gray-700">
                      {BREAKDOWN_LABELS[key] ?? key}
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-600">
                      {fmt$(v.mat)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-gray-600">
                      {fmt$(v.lab * heightMult)}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold text-gray-800">
                      {fmt$(v.mat + v.lab * heightMult)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#1a3a5c] font-bold">
                <td className="pt-2 text-gray-700">Assembly Subtotal</td>
                <td className="pt-2 text-right font-mono">{fmt$(matTotal)}</td>
                <td className="pt-2 text-right font-mono">{fmt$(effectiveLaborTotal)}</td>
                <td className="pt-2 text-right font-mono text-[#1a3a5c]">
                  {fmt$(matTotal + effectiveLaborTotal)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Labor hours detail */}
          <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500 flex flex-wrap gap-4">
            <span>Base hrs: {fmtH(laborBaseHrs)}</span>
            {state.jobCondMult !== 1.0 && (
              <span>After {state.jobCondMult.toFixed(2)}× cond: {fmtH(laborBase / R.labor)}</span>
            )}
            {state.heightAdder && (
              <span>After height +10%: {fmtH(totalHrs)}</span>
            )}
            {!state.heightAdder && state.jobCondMult === 1.0 && (
              <span>Total hrs: {fmtH(totalHrs)}</span>
            )}
          </div>
        </div>
      )}

      {/* ── PERMITS / SUBS / RENTAL ──────────────────────────────────────────── */}
      {(permitBase > 0 || subBase > 0 || rentalBase > 0) && (
        <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
            Permits, Subs &amp; Rental
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 font-semibold border-b border-gray-200">
                <th className="text-left pb-1">Category</th>
                <th className="text-right pb-1 w-24">Base</th>
                <th className="text-right pb-1 w-20">Markup</th>
                <th className="text-right pb-1 w-28">w/ Markup</th>
              </tr>
            </thead>
            <tbody>
              {permitBase > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-700">
                    Permits &amp; Fees
                    <span className="ml-1 text-gray-400">
                      (+{(R.permit * 100).toFixed(0)}%)
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-600">{fmt$(permitBase)}</td>
                  <td className="py-1.5 text-right font-mono text-gray-600">{fmt$(permitBase * R.permit)}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-gray-800">{fmt$(permitTotal)}</td>
                </tr>
              )}
              {subBase > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-700">
                    Subcontractors
                    <span className="ml-1 text-gray-400">
                      (+{(R.sub * 100).toFixed(0)}%)
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-600">{fmt$(subBase)}</td>
                  <td className="py-1.5 text-right font-mono text-gray-600">{fmt$(subBase * R.sub)}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-gray-800">{fmt$(subTotal)}</td>
                </tr>
              )}
              {rentalBase > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-700">
                    Equipment Rental
                    <span className="ml-1 text-gray-400">
                      (+{(R.bulk * 100).toFixed(1)}%)
                    </span>
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-600">{fmt$(rentalBase)}</td>
                  <td className="py-1.5 text-right font-mono text-gray-600">{fmt$(rentalBase * R.bulk)}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-gray-800">{fmt$(rentalTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── BID SUMMARY ─────────────────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
            Bid Summary
          </div>

          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Material</span>
              <span className="font-mono">{fmt$(matTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Labor ({fmtH(totalHrs)})</span>
              <span className="font-mono">{fmt$(effectiveLaborTotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Overhead ({(R.overhead * 100).toFixed(0)}%)</span>
              <span className="font-mono">{fmt$(effectiveOverhead)}</span>
            </div>
            {permitTotal > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Permits &amp; Fees</span>
                <span className="font-mono">{fmt$(permitTotal)}</span>
              </div>
            )}
            {subTotal > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Subcontractors</span>
                <span className="font-mono">{fmt$(subTotal)}</span>
              </div>
            )}
            {rentalTotal > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Equipment Rental</span>
                <span className="font-mono">{fmt$(rentalTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700 border-t border-gray-200 pt-1.5">
              <span>Subtotal</span>
              <span className="font-mono font-semibold">{fmt$(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Profit ({(R.profit * 100).toFixed(0)}%)</span>
              <span className="font-mono">{fmt$(profit)}</span>
            </div>
          </div>

          {/* Grand total */}
          <div className="mt-3 pt-3 border-t-2 border-[#1a3a5c] flex justify-between items-baseline">
            <span className="text-base font-bold text-[#1a3a5c]">Grand Total</span>
            <span className="text-xl font-bold text-[#1a3a5c] font-mono">{fmt$(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* ── ACTIONS ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={copyToClipboard}
          className="px-4 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors"
        >
          📋 Copy Summary
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm font-semibold rounded border border-[#1a3a5c] text-[#1a3a5c] hover:bg-[#eef4ff] transition-colors"
        >
          ↓ Export JSON
        </button>
      </div>
    </div>
  );
}
