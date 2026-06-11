'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates } from '@/lib/estimator/constants';
import { createJob } from '@/app/(app)/actions';
import { fmt$ } from '@/lib/estimator/format';

// ── Format helpers ─────────────────────────────────────────────────────────────

const fmtH = (n: number | null | undefined) =>
  ((n == null || !isFinite(n)) ? 0 : n).toFixed(2) + ' hrs';

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
  const router = useRouter();

  const [converting,     setConverting]     = useState(false);
  const [convertError,   setConvertError]   = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState(false);
  const [summaryView,    setSummaryView]    = useState<'type' | 'label'>('type');

  // ── Conditions ────────────────────────────────────────────────────────────
  const setCondMult = (v: number) =>
    setState(s => ({ ...s, jobCondMult: v }));
  const toggleHeight = () =>
    setState(s => ({ ...s, heightAdder: !s.heightAdder }));

  // ── Assembly totals (from calcBid hook) ───────────────────────────────────
  // NOTE: result.permits and result.subs are rate constants (0.05, 0.03),
  // NOT dollar amounts. We compute actual permit/sub/rental totals below.
  const result = calcBid();

  // ── Lighting & gear quoted costs ──────────────────────────────────────────
  const lightingPerUnit = state.lightingSchedule.reduce((sum, item) => {
    if (!item.quotedPrice || !item.qty) return sum;
    return sum + item.quotedPrice * item.qty * (1 + item.markup);
  }, 0);

  const lightingCost = state.lightingTotalQuote
    ? state.lightingTotalQuote * (1 + (state.lightingQuoteMarkup ?? 0.05))
    : lightingPerUnit;

  const gearPerUnit = state.gearSchedule.reduce((sum, item) => {
    if (!item.quotedPrice || !item.qty) return sum;
    return sum + item.quotedPrice * item.qty * (1 + item.markup);
  }, 0);

  const gearCost = state.gearTotalQuote
    ? state.gearTotalQuote * (1 + (state.gearQuoteMarkup ?? 0.05))
    : gearPerUnit;

  const lightingPending =
    state.lightingSchedule.filter(i => i.qty > 0).length > 0 &&
    !state.lightingTotalQuote &&
    lightingPerUnit === 0;
  const gearPending =
    state.gearSchedule.filter(i => i.qty > 0).length > 0 &&
    !state.gearTotalQuote &&
    gearPerUnit === 0;

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
                   + permitTotal + rentalTotal + subTotal
                   + lightingCost + gearCost;
  const profit     = subtotal * R.profit;
  const grandTotal = subtotal + profit;

  const totalHrs   = effectiveLaborTotal / R.labor;
  // Base labor hours before condMult (for reference display)
  const laborBaseHrs = state.jobCondMult !== 1.0
    ? (laborBase / state.jobCondMult) / R.labor
    : totalHrs;

  // ── Convert to PM project ─────────────────────────────────────────────────
  async function handleConvert() {
    if (!state.jobName.trim() || !state.jobNumber.trim()) {
      setConvertError('Job Name and Job Number are required in Settings before converting.');
      return;
    }
    const ok = window.confirm(
      `Convert "${state.jobName}" to a PM project?\n\n` +
      `This will create a new job in the project manager ` +
      `with the estimate financials pre-filled.\n\n` +
      `Job #: ${state.jobNumber}\n` +
      `Grand Total: ${grandTotal.toFixed(2)}\n` +
      `Total Hours: ${totalHrs.toFixed(1)}`
    );
    if (!ok) return;
    setConverting(true);
    setConvertError(null);
    try {
      const fd = new FormData();
      fd.append('jobNumber',        state.jobNumber);
      fd.append('jobName',          state.jobName);
      fd.append('jobType',          'BID');
      fd.append('status',           'ACTIVE');
      fd.append('contractValue',    grandTotal.toFixed(2));
      fd.append('materialBudget',   result.matTotal.toFixed(2));
      fd.append('laborBudgetDollars', effectiveLaborTotal.toFixed(2));
      fd.append('blendedLaborRate', state.settings.labor.toFixed(2));
      const response = await createJob(fd);
      if ('jobId' in response && response.jobId) {
        setConvertSuccess(true);
        setTimeout(() => router.push(`/jobs/${response.jobId}`), 1500);
      } else if ('error' in response) {
        setConvertError((response as { error?: string }).error ?? 'Failed to create project.');
      }
    } catch {
      setConvertError('An unexpected error occurred.');
    } finally {
      setConverting(false);
    }
  }

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  function copyToClipboard() {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });

    const lines: string[] = [
      `Ridgeline — Bid Summary`,
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
      ...(lightingCost > 0 ? [`  Lighting:       ${fmt$(lightingCost)}`] : []),
      ...(gearCost     > 0 ? [`  Electrical Gear:${fmt$(gearCost)}`]     : []),
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

  // ── Download Summary PDF ─────────────────────────────────────────────────
  function handleDownloadSummaryPDF() {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const fmt = (n: number | null | undefined) => {
      const safe = (n == null || !isFinite(n)) ? 0 : n;
      return '$' + safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // ── Assembly breakdown rows ──
    const breakdownRows = Object.entries(result.breakdown)
      .filter(([, v]) => v.mat + v.lab > 0)
      .map(([key, v]) => {
        const labAdj = v.lab * heightMult;
        const total  = v.mat + labAdj;
        const lbl    = BREAKDOWN_LABELS[key] ?? key;
        return `<tr>
          <td>${lbl}</td>
          <td class="r">${fmt(v.mat)}</td>
          <td class="r">${fmt(labAdj)}</td>
          <td class="r b">${fmt(total)}</td>
        </tr>`;
      }).join('');

    // ── By Label section (only if any package other than (No Package)) ──
    const hasLabels = allAsms.some(a => a.bidPackage || a.area || a.costCode);
    let labelHtml = '';
    if (hasLabels) {
      const pkgRows = Object.entries(labelGrouped).map(([pkg, areas]) => {
        let pkgTotal = 0;
        const areaRows = Object.entries(areas).map(([area, ccs]) => {
          const ccRows = Object.entries(ccs).map(([cc, asms]) => {
            const mat = asms.reduce((s, a) => s + a.mat, 0);
            const lab = asms.reduce((s, a) => s + a.lab * (state.jobCondMult ?? 1.0) * heightMult, 0);
            pkgTotal += mat + lab;
            return `<tr>
              <td style="padding-left:24px;color:#444">${cc}</td>
              <td class="r">${fmt(mat)}</td>
              <td class="r">${fmt(lab)}</td>
              <td class="r b">${fmt(mat + lab)}</td>
            </tr>`;
          }).join('');
          return `<tr style="background:#f4f0fb">
            <td style="padding-left:12px;font-weight:600;color:#6b21a8">${area}</td>
            <td colspan="3"></td>
          </tr>${ccRows}`;
        }).join('');
        return `<tr style="background:#e8eef8">
          <td style="font-weight:700;color:#1e3a8a">${pkg}</td>
          <td colspan="3" class="r" style="font-weight:600;color:#1e3a8a"></td>
        </tr>${areaRows}`;
      }).join('');

      labelHtml = `
        <h3 style="margin-top:24px">By Label Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th style="text-align:left">Package / Area / Cost Code</th>
              <th class="r">Material</th>
              <th class="r">Labor</th>
              <th class="r">Total</th>
            </tr>
          </thead>
          <tbody>${pkgRows}</tbody>
        </table>`;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Bid Summary — ${state.jobName || 'Estimate'}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 32px; }
    h1 { font-size: 18px; color: #1e3a8a; margin: 0 0 4px; }
    h2 { font-size: 13px; color: #444; font-weight: normal; margin: 0 0 16px; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em;
         border-bottom: 2px solid #1e3a8a; color: #1e3a8a;
         padding-bottom: 3px; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { padding: 5px 8px; border: 1px solid #ddd; }
    th { background: #f0f4fa; font-weight: 600; }
    .r { text-align: right; }
    .b { font-weight: 700; }
    .grand { background: #1e3a8a; color: #fff; font-size: 14px; }
    .grand td { border-color: #1e3a8a; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>BID SUMMARY</h1>
  <h2>${state.jobName || '(No Job Name)'} &nbsp;·&nbsp; ${today}</h2>
  <div style="font-size:11px;color:#666;margin-bottom:16px">
    Labor rate: ${fmt(R.labor)}/hr &nbsp;|&nbsp;
    Overhead: ${(R.overhead * 100).toFixed(0)}% &nbsp;|&nbsp;
    Profit: ${(R.profit * 100).toFixed(0)}% &nbsp;|&nbsp;
    Condition mult: ${(state.jobCondMult ?? 1).toFixed(2)}x
    ${state.heightAdder ? ' &nbsp;|&nbsp; Height adder: +10%' : ''}
  </div>

  <h3>Assembly Breakdown</h3>
  <table>
    <thead>
      <tr>
        <th style="text-align:left">Category</th>
        <th class="r">Material</th>
        <th class="r">Labor</th>
        <th class="r">Total</th>
      </tr>
    </thead>
    <tbody>${breakdownRows}</tbody>
  </table>

  <h3>Cost Summary</h3>
  <table>
    <tbody>
      <tr><td>Material</td><td class="r">${fmt(matTotal)}</td></tr>
      <tr><td>Labor (${fmtH(totalHrs)})</td><td class="r">${fmt(effectiveLaborTotal)}</td></tr>
      <tr><td>Overhead (${(R.overhead * 100).toFixed(0)}%)</td><td class="r">${fmt(effectiveOverhead)}</td></tr>
      ${permitTotal > 0 ? `<tr><td>Permits</td><td class="r">${fmt(permitTotal)}</td></tr>` : ''}
      ${subTotal    > 0 ? `<tr><td>Subcontractors</td><td class="r">${fmt(subTotal)}</td></tr>` : ''}
      ${rentalTotal > 0 ? `<tr><td>Equipment Rental</td><td class="r">${fmt(rentalTotal)}</td></tr>` : ''}
      ${lightingCost > 0 ? `<tr><td>Lighting Fixtures</td><td class="r">${fmt(lightingCost)}</td></tr>` : ''}
      ${gearCost    > 0 ? `<tr><td>Electrical Gear</td><td class="r">${fmt(gearCost)}</td></tr>` : ''}
      <tr style="background:#f5f5f5;font-weight:600"><td>Subtotal</td><td class="r">${fmt(subtotal)}</td></tr>
      <tr><td>Profit (${(R.profit * 100).toFixed(0)}%)</td><td class="r">${fmt(profit)}</td></tr>
    </tbody>
  </table>
  <table>
    <tbody>
      <tr class="grand"><td class="b">GRAND TOTAL</td><td class="r b">${fmt(grandTotal)}</td></tr>
    </tbody>
  </table>

  ${labelHtml}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Bid_Summary_${
      (state.jobName || 'Estimate').replace(/\s+/g, '_')
    }_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // ── All assemblies (for By Label view) ───────────────────────────────────
  const allAsms = useMemo(() => [
    ...state.savedRuns, ...state.savedRacks, ...state.savedMCHR,
    ...state.savedThreeWay, ...state.savedData, ...state.savedFA,
    ...state.savedCans, ...state.savedGear, ...state.savedCustomDev,
    ...state.savedTM, ...state.savedLV, ...state.savedCustomAsm,
    ...state.savedHAR, ...state.savedFloorBox, ...state.asms,
    ...state.savedPanels,
  ], [state]);

  // Group allAsms by bidPackage → area → costCode
  type LabelGroup = Record<string, Record<string, Record<string, typeof allAsms>>>;
  const labelGrouped = useMemo<LabelGroup>(() => {
    const grouped: LabelGroup = {};
    for (const asm of allAsms) {
      const pkg  = asm.bidPackage || 'Base Bid';
      const area = asm.area       || '(No Area)';
      const cc   = asm.costCode   || '(No Cost Code)';
      if (!grouped[pkg]) grouped[pkg] = {};
      if (!grouped[pkg][area]) grouped[pkg][area] = {};
      if (!grouped[pkg][area][cc]) grouped[pkg][area][cc] = [];
      grouped[pkg][area][cc].push(asm);
    }
    return grouped;
  }, [allAsms]);

  // ── Empty guard ───────────────────────────────────────────────────────────
  const isEmpty =
    matTotal === 0 && laborBase === 0 &&
    permitBase === 0 && subBase === 0 && rentalBase === 0 &&
    lightingCost === 0 && gearCost === 0;

  return (
    <div className="max-w-3xl">

      {/* ── JOB CONDITIONS ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
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
                    ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#1e3a8a]'
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
            className="w-4 h-4 accent-[#1e3a8a]"
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
          <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
            <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a]">
              Assembly Breakdown
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setSummaryView('type')}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  summaryView === 'type'
                    ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-[#1e3a8a]'
                }`}
              >
                By Type
              </button>
              <button
                onClick={() => setSummaryView('label')}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  summaryView === 'label'
                    ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                    : 'bg-white text-gray-500 border-gray-300 hover:border-[#1e3a8a]'
                }`}
              >
                By Label
              </button>
            </div>
          </div>

          {summaryView === 'type' && (
          <>
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
              <tr className="border-t-2 border-[#1e3a8a] font-bold">
                <td className="pt-2 text-gray-700">Assembly Subtotal</td>
                <td className="pt-2 text-right font-mono">{fmt$(matTotal)}</td>
                <td className="pt-2 text-right font-mono">{fmt$(effectiveLaborTotal)}</td>
                <td className="pt-2 text-right font-mono text-[#1e3a8a]">
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
          </>) /* end summaryView === 'type' */}

          {/* ── By Label view ──────────────────────────────────────────────── */}
          {summaryView === 'label' && (
            <div className="space-y-4">
              {Object.entries(labelGrouped).map(([pkg, areas]) => {
                const pkgMat = Object.values(areas).flatMap(a => Object.values(a).flat()).reduce((s, a) => s + a.mat, 0);
                const pkgLab = Object.values(areas).flatMap(a => Object.values(a).flat()).reduce((s, a) => s + a.lab * heightMult, 0);
                return (
                  <div key={pkg}>
                    <div className="bg-[#1e3a8a] text-white px-3 py-1.5 rounded-t text-xs font-bold flex justify-between">
                      <span>{pkg}</span>
                      <span className="font-mono">{fmt$(pkgMat + pkgLab)}</span>
                    </div>
                    {Object.entries(areas).map(([area, costCodes]) => {
                      const areaMat = Object.values(costCodes).flat().reduce((s, a) => s + a.mat, 0);
                      const areaLab = Object.values(costCodes).flat().reduce((s, a) => s + a.lab * heightMult, 0);
                      return (
                        <div key={area} className="border border-[#1e3a8a]/20 border-t-0">
                          <div className="bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 flex justify-between">
                            <span>{area}</span>
                            <span className="font-mono">{fmt$(areaMat + areaLab)}</span>
                          </div>
                          <table className="w-full text-xs">
                            <tbody>
                              {Object.entries(costCodes).map(([cc, items]) => {
                                const ccMat = items.reduce((s, a) => s + a.mat, 0);
                                const ccLab = items.reduce((s, a) => s + a.lab * heightMult, 0);
                                return (
                                  <tr key={cc} className="border-b border-gray-100 hover:bg-blue-50/30">
                                    <td className="py-1.5 px-3 text-gray-600">
                                      <span className="text-green-700 font-medium">{cc}</span>
                                      <span className="ml-2 text-gray-400">({items.length})</span>
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-gray-500 w-24 pr-2">{fmt$(ccMat)}</td>
                                    <td className="py-1.5 text-right font-mono text-gray-500 w-24 pr-2">{fmt$(ccLab)}</td>
                                    <td className="py-1.5 text-right font-mono font-semibold text-gray-800 w-28 pr-3">{fmt$(ccMat + ccLab)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PERMITS / SUBS / RENTAL ──────────────────────────────────────────── */}
      {(permitBase > 0 || subBase > 0 || rentalBase > 0) && (
        <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
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
          <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
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
            {lightingPending && (
              <div className="flex justify-between text-amber-600 text-sm">
                <span>Lighting Fixtures</span>
                <span className="text-xs italic">⚠ Awaiting quote</span>
              </div>
            )}
            {lightingCost > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Lighting Fixtures</span>
                <span className="font-mono">{fmt$(lightingCost)}</span>
              </div>
            )}
            {gearPending && (
              <div className="flex justify-between text-amber-600 text-sm">
                <span>Electrical Gear</span>
                <span className="text-xs italic">⚠ Awaiting quote</span>
              </div>
            )}
            {gearCost > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Electrical Gear</span>
                <span className="font-mono">{fmt$(gearCost)}</span>
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
          <div className="mt-3 pt-3 border-t-2 border-[#1e3a8a] flex justify-between items-baseline">
            <span className="text-base font-bold text-[#1e3a8a]">Grand Total</span>
            <span className="text-xl font-bold text-[#1e3a8a] font-mono">{fmt$(grandTotal)}</span>
          </div>
        </div>
      )}

      {/* ── ACTIONS ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={copyToClipboard}
          className="px-4 py-2 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] transition-colors"
        >
          📋 Copy Summary
        </button>
        <button
          onClick={handleExport}
          className="px-4 py-2 text-sm font-semibold rounded border border-[#1e3a8a] text-[#1e3a8a] hover:bg-[#eef4ff] transition-colors"
        >
          ↓ Export JSON
        </button>
        <button
          onClick={handleDownloadSummaryPDF}
          className="px-4 py-2 text-sm font-semibold rounded border border-[#1e3a8a] text-[#1e3a8a] hover:bg-[#eef4ff] transition-colors"
        >
          ⬇ Download Summary (open & print to PDF)
        </button>
        <button
          onClick={handleConvert}
          disabled={converting || convertSuccess}
          className="px-4 py-2 text-sm font-semibold rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {converting ? '⏳ Creating…' : convertSuccess ? '✓ Project created! Redirecting…' : '🏗 Convert to Project'}
        </button>
      </div>
      {convertError && (
        <p className="text-red-600 text-xs mt-2">{convertError}</p>
      )}
    </div>
  );
}
