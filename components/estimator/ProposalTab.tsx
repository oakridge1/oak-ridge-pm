'use client';

import { useMemo, useCallback } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import {
  type ProposalState,
  type ScopeSection,
  type AddAlternate,
  type PaymentTerms,
  DEFAULT_INCLUSIONS,
  DEFAULT_EXCLUSIONS,
  DEFAULT_WARRANTY,
  PAYMENT_TERM_LABELS,
  getPaymentParagraph,
} from '@/lib/estimator/proposalState';
import { fmt$ } from '@/lib/estimator/format';

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

// Oak Ridge company header constants
const CO_NAME    = 'Oak Ridge Electrical LLC';
const CO_ADDR    = 'Licensed Electrical Contractor';
const CO_PHONE   = '(865) 555-0100';
const CO_EMAIL   = 'info@oakridgeelectrical.com';
const CO_LICENSE = 'TN License # [000000]';

// ─────────────────────────────────────
// Print HTML generator
// ─────────────────────────────────────

function buildPrintHtml(
  p: ProposalState,
  jobName: string,
  baseTotal: number,
): string {
  const validUntil = (() => {
    const d = new Date(p.proposalDate);
    d.setDate(d.getDate() + p.validDays);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  })();

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

  const incHtml = p.inclusions
    .filter(Boolean)
    .map(i => `<li>${i}</li>`)
    .join('');
  const excHtml = p.exclusions
    .filter(Boolean)
    .map(i => `<li>${i}</li>`)
    .join('');

  const scopeHtml = p.scopeSections.map((sec, si) => `
    <div style="margin-bottom:12px">
      <p style="margin:0 0 4px;font-weight:600">${si + 1}. ${sec.title}</p>
      <ul style="margin:0;padding-left:20px">
        ${sec.items.filter(Boolean).map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const altRows = p.alternates.map(a => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd">Add Alternate ${a.number}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${a.title}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${a.desc}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${fmt$(a.price)}</td>
    </tr>
  `).join('');

  const altTable = p.alternates.length > 0 ? `
    <h3 style="margin:20px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #002D72;padding-bottom:4px;color:#002D72">Add Alternates</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#f0f4fa">
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Alt #</th>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Title</th>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:left">Description</th>
          <th style="padding:6px 8px;border:1px solid #ddd;text-align:right">Price</th>
        </tr>
      </thead>
      <tbody>${altRows}</tbody>
    </table>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Proposal — ${jobName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 0; }
  @page { margin: 0.75in; }
  @media print { body { font-size: 11px; } }
  .page { max-width: 800px; margin: 0 auto; padding: 40px; }
  h2 { font-size: 14px; margin: 0 0 2px; text-transform: uppercase; letter-spacing: .06em; }
  h3 { font-size: 12px; margin: 18px 0 6px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #002D72; padding-bottom: 4px; color: #002D72; }
  ul { margin: 4px 0; padding-left: 20px; }
  li { margin-bottom: 2px; }
  p { margin: 4px 0; line-height: 1.5; }
  .sig-line { border-bottom: 1px solid #333; display: inline-block; width: 240px; margin-top: 32px; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <table style="width:100%;border-bottom:2px solid #002D72;padding-bottom:12px;margin-bottom:16px">
    <tr>
      <td>
        <div style="font-size:22px;font-weight:700;color:#002D72;letter-spacing:.02em">${CO_NAME}</div>
        <div style="font-size:11px;color:#555;margin-top:2px">${CO_ADDR}</div>
        <div style="font-size:11px;color:#555">${CO_PHONE} · ${CO_EMAIL}</div>
        <div style="font-size:11px;color:#555">${CO_LICENSE}</div>
      </td>
      <td style="text-align:right;vertical-align:top">
        <div style="font-size:28px;font-weight:700;color:#c8601a;letter-spacing:.08em">PROPOSAL</div>
        <div style="font-size:11px;color:#555;margin-top:4px">Date: ${fmtDate(p.proposalDate)}</div>
        <div style="font-size:11px;color:#555">Valid Until: ${validUntil}</div>
      </td>
    </tr>
  </table>

  <!-- Proposal To -->
  <table style="width:100%;margin-bottom:16px">
    <tr>
      <td style="width:50%;vertical-align:top">
        <strong>Proposal To:</strong><br>
        ${p.clientCompany || '&nbsp;'}<br>
        ${p.clientAttn ? 'Attn: ' + p.clientAttn : '&nbsp;'}
      </td>
      <td style="vertical-align:top">
        <strong>Re:</strong> ${jobName}<br>
        <strong>Working Hours:</strong> ${p.workingHours}
      </td>
    </tr>
  </table>

  <!-- Scope intro -->
  <p style="margin-bottom:12px">${p.scopeIntro}</p>

  <!-- Scope of Work -->
  ${p.scopeSections.length > 0 ? `
  <h3>Scope of Work</h3>
  ${scopeHtml}
  ` : ''}

  <!-- Pricing -->
  <h3>Pricing</h3>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <tbody>
      <tr style="background:#f0f4fa;font-weight:600">
        <td style="padding:8px 10px;border:1px solid #ddd">Base Bid — Complete Electrical Scope</td>
        <td style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-size:15px">${fmt$(baseTotal)}</td>
      </tr>
    </tbody>
  </table>
  ${altTable}

  <!-- Inclusions / Exclusions -->
  <table style="width:100%;margin-top:20px">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:12px">
        <h3 style="margin-top:0">Inclusions</h3>
        <ul>${incHtml}</ul>
      </td>
      <td style="vertical-align:top;padding-left:12px">
        <h3 style="margin-top:0">Exclusions</h3>
        <ul>${excHtml}</ul>
      </td>
    </tr>
  </table>

  <!-- Warranty -->
  <h3>Warranty</h3>
  <p>${p.warrantyText}</p>

  <!-- Payment Terms -->
  <h3>Payment Terms</h3>
  <p style="white-space:pre-line">${getPaymentParagraph(p.paymentTerms)}</p>
  ${p.paymentNote ? `<p><em>${p.paymentNote}</em></p>` : ''}

  <!-- Validity -->
  <p style="margin-top:12px"><em>${p.validityNote}</em></p>

  <!-- Acceptance -->
  <h3>Acceptance</h3>
  <p>The above prices, specifications, and conditions are satisfactory and are hereby accepted. You are authorized to do the work as specified. Payment will be made as outlined above.</p>

  <table style="width:100%;margin-top:24px">
    <tr>
      <td style="width:50%;vertical-align:bottom;padding-right:20px">
        <div class="sig-line"></div><br>
        <div style="font-size:11px;margin-top:4px">Authorized Signature — Owner / GC</div>
        <div style="font-size:11px;color:#555;margin-top:2px">Date: __________________</div>
      </td>
      <td style="vertical-align:bottom;padding-left:20px">
        <div class="sig-line"></div><br>
        <div style="font-size:11px;margin-top:4px">Oak Ridge Electrical LLC</div>
        <div style="font-size:11px;color:#555;margin-top:2px">Date: __________________</div>
      </td>
    </tr>
  </table>

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:8px;border-top:1px solid #ccc;font-size:10px;color:#888;text-align:center">
    ${CO_NAME} · ${CO_PHONE} · ${CO_EMAIL} · ${CO_LICENSE}
  </div>

</div>
</body>
</html>`;
}

// ─────────────────────────────────────
// Section components
// ─────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs font-semibold text-[#002D72] uppercase tracking-wide mb-2">{title}</div>
      {children}
    </div>
  );
}

function LabelInput({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 mb-2">
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={type}
        className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#002D72]"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={e => onChange(e.target.value)}
        key={String(value)}
      />
    </div>
  );
}

// ─────────────────────────────────────
// ProposalTab
// ─────────────────────────────────────

export function ProposalTab() {
  const { state, setState, calcBid } = useEstimatorContext();
  const p = state.proposal;

  const patch = useCallback(<K extends keyof ProposalState>(
    key: K, value: ProposalState[K],
  ) => {
    setState(s => ({ ...s, proposal: { ...s.proposal, [key]: value } }));
  }, [setState]);

  const bid = useMemo(() => calcBid(), [calcBid]);

  // ── Scope sections ──────────────────────────────────────────────

  const addSection = () =>
    patch('scopeSections', [
      ...p.scopeSections,
      { id: uid(), title: 'New Section', items: [''] },
    ]);

  const updateSection = (id: string, changes: Partial<ScopeSection>) =>
    patch('scopeSections', p.scopeSections.map(s =>
      s.id === id ? { ...s, ...changes } : s,
    ));

  const removeSection = (id: string) =>
    patch('scopeSections', p.scopeSections.filter(s => s.id !== id));

  const moveSection = (id: string, dir: -1 | 1) => {
    const arr = [...p.scopeSections];
    const i = arr.findIndex(s => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    patch('scopeSections', arr);
  };

  const updateBullet = (sectionId: string, idx: number, value: string) => {
    const sec = p.scopeSections.find(s => s.id === sectionId);
    if (!sec) return;
    const items = [...sec.items];
    items[idx] = value;
    updateSection(sectionId, { items });
  };

  const removeBullet = (sectionId: string, idx: number) => {
    const sec = p.scopeSections.find(s => s.id === sectionId);
    if (!sec) return;
    updateSection(sectionId, { items: sec.items.filter((_, i) => i !== idx) });
  };

  // ── Alternates ──────────────────────────────────────────────────

  const addAlternate = () => {
    const nextNum = (p.alternates[p.alternates.length - 1]?.number ?? 0) + 1;
    patch('alternates', [
      ...p.alternates,
      { id: uid(), number: nextNum, title: `Alternate ${nextNum}`, desc: '', price: 0 },
    ]);
  };

  const updateAlternate = (id: string, changes: Partial<AddAlternate>) =>
    patch('alternates', p.alternates.map(a =>
      a.id === id ? { ...a, ...changes } : a,
    ));

  const removeAlternate = (id: string) =>
    patch('alternates', p.alternates.filter(a => a.id !== id));

  // ── Inclusions / Exclusions ─────────────────────────────────────

  const addListItem = (key: 'inclusions' | 'exclusions') =>
    patch(key, [...p[key], '']);

  const updateListItem = (key: 'inclusions' | 'exclusions', idx: number, val: string) => {
    const arr = [...p[key]];
    arr[idx] = val;
    patch(key, arr);
  };

  const removeListItem = (key: 'inclusions' | 'exclusions', idx: number) =>
    patch(key, p[key].filter((_, i) => i !== idx));

  // ── Print ───────────────────────────────────────────────────────

  const handlePrint = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(buildPrintHtml(p, state.jobName, bid.grandTotal));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  // ── Preview: valid-until date ───────────────────────────────────
  const validUntil = useMemo(() => {
    const d = new Date(p.proposalDate + 'T12:00:00');
    d.setDate(d.getDate() + p.validDays);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, [p.proposalDate, p.validDays]);

  const fmtDate = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

  // ─────────────────────────────────────
  // Render
  // ─────────────────────────────────────

  return (
    <div className="flex gap-4 max-w-[1400px] h-[calc(100vh-148px)]">

      {/* ── Left: Editor ──────────────────────────────────────────── */}
      <div className="w-80 shrink-0 overflow-y-auto flex flex-col gap-3 pb-4 pr-1">

        {/* Client Info */}
        <Card title="Client Info">
          <LabelInput
            label="Company / GC"
            value={p.clientCompany}
            onChange={v => patch('clientCompany', v)}
            placeholder="GC Company Name"
          />
          <LabelInput
            label="Attn / Contact"
            value={p.clientAttn}
            onChange={v => patch('clientAttn', v)}
            placeholder="Contact Name"
          />
        </Card>

        {/* Proposal Details */}
        <Card title="Proposal Details">
          <LabelInput
            label="Date"
            value={p.proposalDate}
            onChange={v => patch('proposalDate', v)}
            type="date"
          />
          <LabelInput
            label="Valid For (days)"
            value={p.validDays}
            onChange={v => patch('validDays', parseInt(v) || 30)}
            type="number"
          />
          <LabelInput
            label="Working Hours"
            value={p.workingHours}
            onChange={v => patch('workingHours', v)}
          />
        </Card>

        {/* Scope Intro */}
        <Card title="Scope Introduction">
          <textarea
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#002D72] resize-none"
            rows={4}
            defaultValue={p.scopeIntro}
            onBlur={e => patch('scopeIntro', e.target.value)}
            key={p.scopeIntro}
          />
        </Card>

        {/* Scope Sections */}
        <Card title="Scope Sections">
          {p.scopeSections.map((sec, si) => (
            <div key={sec.id} className="mb-3 border border-gray-100 rounded p-2 bg-gray-50">
              {/* Section header */}
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-xs text-gray-500 font-medium w-4">{si + 1}.</span>
                <input
                  className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:border-[#002D72]"
                  defaultValue={sec.title}
                  onBlur={e => updateSection(sec.id, { title: e.target.value })}
                  key={sec.title}
                />
                <button
                  onClick={() => moveSection(sec.id, -1)}
                  disabled={si === 0}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-0.5"
                  title="Move up"
                >↑</button>
                <button
                  onClick={() => moveSection(sec.id, 1)}
                  disabled={si === p.scopeSections.length - 1}
                  className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-xs px-0.5"
                  title="Move down"
                >↓</button>
                <button
                  onClick={() => removeSection(sec.id)}
                  className="text-red-400 hover:text-red-600 text-xs px-0.5"
                  title="Remove section"
                >✕</button>
              </div>
              {/* Bullets */}
              {sec.items.map((item, ii) => (
                <div key={ii} className="flex items-center gap-1 mb-1">
                  <span className="text-gray-300 text-xs">•</span>
                  <input
                    className="flex-1 border border-gray-100 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#002D72] bg-white"
                    defaultValue={item}
                    onBlur={e => updateBullet(sec.id, ii, e.target.value)}
                    key={`${sec.id}-${ii}-${item}`}
                    placeholder="Bullet point…"
                  />
                  <button
                    onClick={() => removeBullet(sec.id, ii)}
                    className="text-red-300 hover:text-red-500 text-xs"
                  >✕</button>
                </div>
              ))}
              <button
                onClick={() => updateSection(sec.id, { items: [...sec.items, ''] })}
                className="text-xs text-[#002D72] hover:underline mt-0.5"
              >+ bullet</button>
            </div>
          ))}
          <button
            onClick={addSection}
            className="w-full text-xs border border-dashed border-[#002D72] text-[#002D72] rounded py-1 hover:bg-blue-50 transition-colors"
          >+ Add Section</button>
        </Card>

        {/* Alternates */}
        <Card title="Add Alternates">
          {p.alternates.map((alt) => (
            <div key={alt.id} className="mb-2 border border-gray-100 rounded p-2 bg-gray-50">
              <div className="flex items-center gap-1 mb-1.5">
                <span className="text-xs font-semibold text-gray-600">Alt {alt.number}</span>
                <input
                  className="flex-1 border border-gray-200 rounded px-1.5 py-0.5 text-xs font-medium focus:outline-none focus:border-[#002D72]"
                  defaultValue={alt.title}
                  onBlur={e => updateAlternate(alt.id, { title: e.target.value })}
                  key={alt.title}
                  placeholder="Title"
                />
                <button
                  onClick={() => removeAlternate(alt.id)}
                  className="text-red-400 hover:text-red-600 text-xs"
                >✕</button>
              </div>
              <input
                className="w-full border border-gray-100 rounded px-1.5 py-0.5 text-xs mb-1 focus:outline-none focus:border-[#002D72] bg-white"
                defaultValue={alt.desc}
                onBlur={e => updateAlternate(alt.id, { desc: e.target.value })}
                key={alt.desc}
                placeholder="Description"
              />
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">$</span>
                <input
                  type="number"
                  className="flex-1 border border-gray-100 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#002D72] bg-white"
                  defaultValue={alt.price}
                  onBlur={e => updateAlternate(alt.id, { price: parseFloat(e.target.value) || 0 })}
                  key={alt.price}
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
          <button
            onClick={addAlternate}
            className="w-full text-xs border border-dashed border-[#002D72] text-[#002D72] rounded py-1 hover:bg-blue-50 transition-colors"
          >+ Add Alternate</button>
        </Card>

        {/* Inclusions */}
        <Card title="Inclusions">
          {p.inclusions.map((item, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <span className="text-gray-300 text-xs">•</span>
              <input
                className="flex-1 border border-gray-100 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#002D72]"
                defaultValue={item}
                onBlur={e => updateListItem('inclusions', i, e.target.value)}
                key={`inc-${i}-${item}`}
              />
              <button
                onClick={() => removeListItem('inclusions', i)}
                className="text-red-300 hover:text-red-500 text-xs"
              >✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => addListItem('inclusions')}
              className="text-xs text-[#002D72] hover:underline"
            >+ Add</button>
            <button
              onClick={() => patch('inclusions', [...DEFAULT_INCLUSIONS])}
              className="text-xs text-gray-400 hover:underline"
            >Reset</button>
          </div>
        </Card>

        {/* Exclusions */}
        <Card title="Exclusions">
          {p.exclusions.map((item, i) => (
            <div key={i} className="flex items-center gap-1 mb-1">
              <span className="text-gray-300 text-xs">•</span>
              <input
                className="flex-1 border border-gray-100 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#002D72]"
                defaultValue={item}
                onBlur={e => updateListItem('exclusions', i, e.target.value)}
                key={`exc-${i}-${item}`}
              />
              <button
                onClick={() => removeListItem('exclusions', i)}
                className="text-red-300 hover:text-red-500 text-xs"
              >✕</button>
            </div>
          ))}
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => addListItem('exclusions')}
              className="text-xs text-[#002D72] hover:underline"
            >+ Add</button>
            <button
              onClick={() => patch('exclusions', [...DEFAULT_EXCLUSIONS])}
              className="text-xs text-gray-400 hover:underline"
            >Reset</button>
          </div>
        </Card>

        {/* Warranty */}
        <Card title="Warranty">
          <textarea
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#002D72] resize-none"
            rows={3}
            defaultValue={p.warrantyText}
            onBlur={e => patch('warrantyText', e.target.value)}
            key={p.warrantyText}
          />
          <button
            onClick={() => patch('warrantyText', DEFAULT_WARRANTY)}
            className="text-xs text-gray-400 hover:underline mt-1"
          >Reset to default</button>
        </Card>

        {/* Payment Terms */}
        <Card title="Payment Terms">
          <div className="flex flex-col gap-1 mb-2">
            {(Object.entries(PAYMENT_TERM_LABELS) as [PaymentTerms, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentTerms"
                  value={key}
                  checked={p.paymentTerms === key}
                  onChange={() => patch('paymentTerms', key)}
                  className="accent-[#002D72]"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
          <LabelInput
            label="Payment Note (optional)"
            value={p.paymentNote}
            onChange={v => patch('paymentNote', v)}
            placeholder="e.g. Customer-furnished scissor lift required"
          />
          <LabelInput
            label="Validity Note"
            value={p.validityNote}
            onChange={v => patch('validityNote', v)}
          />
        </Card>

        {/* Print */}
        <button
          onClick={handlePrint}
          className="w-full py-2.5 rounded-lg bg-[#002D72] text-white font-semibold text-sm hover:bg-[#1a3a5c] transition-colors flex items-center justify-center gap-2"
        >
          🖨️ Print / Save as PDF
        </button>

      </div>

      {/* ── Right: Live Preview ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="bg-white border border-gray-300 rounded-lg shadow-sm mx-auto p-8 text-xs leading-relaxed"
          style={{ maxWidth: 760, fontFamily: 'Arial, sans-serif', color: '#1a1a1a' }}
        >

          {/* Header */}
          <div className="flex justify-between items-start border-b-2 pb-3 mb-4" style={{ borderColor: '#002D72' }}>
            <div>
              <div className="font-bold text-lg" style={{ color: '#002D72' }}>{CO_NAME}</div>
              <div className="text-gray-500 mt-0.5">{CO_ADDR}</div>
              <div className="text-gray-500">{CO_PHONE} · {CO_EMAIL}</div>
              <div className="text-gray-500">{CO_LICENSE}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-2xl tracking-widest" style={{ color: '#c8601a' }}>PROPOSAL</div>
              <div className="text-gray-500 mt-1">Date: {fmtDate(p.proposalDate)}</div>
              <div className="text-gray-500">Valid Until: {validUntil}</div>
            </div>
          </div>

          {/* Proposal To */}
          <div className="flex gap-8 mb-4">
            <div>
              <div className="font-semibold text-gray-700 mb-0.5">Proposal To:</div>
              <div>{p.clientCompany || <span className="text-gray-300 italic">Company name</span>}</div>
              {p.clientAttn && <div>Attn: {p.clientAttn}</div>}
            </div>
            <div>
              <div className="font-semibold text-gray-700 mb-0.5">Re:</div>
              <div>{state.jobName}</div>
              <div className="mt-0.5"><span className="font-semibold text-gray-700">Working Hours:</span> {p.workingHours}</div>
            </div>
          </div>

          {/* Scope intro */}
          <p className="mb-3 leading-relaxed">{p.scopeIntro}</p>

          {/* Scope Sections */}
          {p.scopeSections.length > 0 && (
            <>
              <SectionHeading>Scope of Work</SectionHeading>
              {p.scopeSections.map((sec, si) => (
                <div key={sec.id} className="mb-2">
                  <div className="font-semibold">{si + 1}. {sec.title}</div>
                  <ul className="list-disc pl-5 mt-0.5">
                    {sec.items.filter(Boolean).map((item, ii) => (
                      <li key={ii}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </>
          )}

          {/* Pricing */}
          <SectionHeading>Pricing</SectionHeading>
          <table className="w-full border-collapse mb-2 text-xs">
            <tbody>
              <tr className="font-semibold" style={{ background: '#f0f4fa' }}>
                <td className="px-2.5 py-2 border border-gray-200">Base Bid — Complete Electrical Scope</td>
                <td className="px-2.5 py-2 border border-gray-200 text-right font-bold text-sm">{fmt$(bid.grandTotal)}</td>
              </tr>
            </tbody>
          </table>

          {p.alternates.length > 0 && (
            <>
              <div className="text-xs font-semibold text-gray-600 mt-2 mb-1">Add Alternates</div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr style={{ background: '#f0f4fa' }}>
                    <th className="px-2 py-1.5 border border-gray-200 text-left font-semibold">Alt #</th>
                    <th className="px-2 py-1.5 border border-gray-200 text-left font-semibold">Title</th>
                    <th className="px-2 py-1.5 border border-gray-200 text-left font-semibold">Description</th>
                    <th className="px-2 py-1.5 border border-gray-200 text-right font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {p.alternates.map(alt => (
                    <tr key={alt.id}>
                      <td className="px-2 py-1.5 border border-gray-200">Add Alt {alt.number}</td>
                      <td className="px-2 py-1.5 border border-gray-200">{alt.title}</td>
                      <td className="px-2 py-1.5 border border-gray-200">{alt.desc}</td>
                      <td className="px-2 py-1.5 border border-gray-200 text-right">{fmt$(alt.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Inclusions / Exclusions */}
          <div className="flex gap-6 mt-3">
            <div className="flex-1">
              <SectionHeading>Inclusions</SectionHeading>
              <ul className="list-disc pl-4">
                {p.inclusions.filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
            <div className="flex-1">
              <SectionHeading>Exclusions</SectionHeading>
              <ul className="list-disc pl-4">
                {p.exclusions.filter(Boolean).map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          </div>

          {/* Warranty */}
          <SectionHeading>Warranty</SectionHeading>
          <p>{p.warrantyText}</p>

          {/* Payment Terms */}
          <SectionHeading>Payment Terms</SectionHeading>
          <p className="whitespace-pre-line">{getPaymentParagraph(p.paymentTerms)}</p>
          {p.paymentNote && <p className="italic mt-1">{p.paymentNote}</p>}

          {/* Validity */}
          <p className="italic mt-2">{p.validityNote}</p>

          {/* Acceptance */}
          <SectionHeading>Acceptance</SectionHeading>
          <p>
            The above prices, specifications, and conditions are satisfactory and are hereby accepted.
            You are authorized to do the work as specified. Payment will be made as outlined above.
          </p>
          <div className="flex gap-10 mt-6">
            <div className="flex-1">
              <div className="border-b border-gray-500 h-8" />
              <div className="mt-1 text-gray-600">Authorized Signature — Owner / GC</div>
              <div className="text-gray-500 mt-0.5">Date: _______________</div>
            </div>
            <div className="flex-1">
              <div className="border-b border-gray-500 h-8" />
              <div className="mt-1 text-gray-600">{CO_NAME}</div>
              <div className="text-gray-500 mt-0.5">Date: _______________</div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-2 border-t border-gray-200 text-center text-gray-400" style={{ fontSize: 10 }}>
            {CO_NAME} · {CO_PHONE} · {CO_EMAIL} · {CO_LICENSE}
          </div>

        </div>
      </div>

    </div>
  );
}

// ── Small presentational helper ───────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-semibold text-xs uppercase tracking-wide mt-3 mb-1 pb-0.5 border-b"
      style={{ color: '#002D72', borderColor: '#002D72', letterSpacing: '.05em' }}
    >
      {children}
    </div>
  );
}
