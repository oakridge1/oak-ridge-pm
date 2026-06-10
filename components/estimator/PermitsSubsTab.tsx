'use client';
import { generateId } from '@/lib/utils/uuid';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates } from '@/lib/estimator/constants';

// ── Format helper ──────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Shared className constants (per spec) ──────────────────────────────────────

const CLS = {
  inputText:    'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white flex-1 min-w-[200px]',
  inputAmt:     'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-32 text-right font-mono',
  addBtn:       'px-3 py-1.5 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] whitespace-nowrap transition-colors',
  removeBtn:    'text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors',
  entryRow:     'flex items-center gap-3 py-2 border-b border-gray-100 last:border-0',
  sectionCard:  'bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm',
  sectionTitle: 'text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3 flex justify-between items-center',
  subtotalRow:  'mt-3 pt-2 border-t border-gray-200 text-xs text-gray-600 flex gap-4',
};

// ── PermitsSubsTab ─────────────────────────────────────────────────────────────

export function PermitsSubsTab() {
  const { state, setState } = useEstimatorContext();
  const R = getRates();

  // ── Local form state ───────────────────────────────────────────────────────
  const [permitDesc, setPermitDesc] = useState('');
  const [permitCost, setPermitCost] = useState('');
  const [subDesc,    setSubDesc]    = useState('');
  const [subCost,    setSubCost]    = useState('');
  const [rentalDesc, setRentalDesc] = useState('');
  const [rentalCost, setRentalCost] = useState('');

  // ── Derived entry lists ────────────────────────────────────────────────────
  const permitEntries = state.permits.filter(p => !p.desc.startsWith('[Rental]'));
  const rentalEntries = state.permits.filter(p =>  p.desc.startsWith('[Rental]'));

  // ── Add handlers ──────────────────────────────────────────────────────────
  function addPermit() {
    const cost = parseFloat(permitCost) || 0;
    if (!permitDesc.trim() && cost <= 0) return;
    setState(s => ({
      ...s,
      permits: [...s.permits, {
        id:   generateId(),
        desc: permitDesc.trim() || 'Permit',
        cost,
      }],
    }));
    setPermitDesc(''); setPermitCost('');
  }

  function addSub() {
    const cost = parseFloat(subCost) || 0;
    if (!subDesc.trim() && cost <= 0) return;
    setState(s => ({
      ...s,
      subs: [...s.subs, {
        id:   generateId(),
        desc: subDesc.trim() || 'Subcontractor',
        cost,
      }],
    }));
    setSubDesc(''); setSubCost('');
  }

  function addRental() {
    const cost = parseFloat(rentalCost) || 0;
    if (!rentalDesc.trim() && cost <= 0) return;
    setState(s => ({
      ...s,
      permits: [...s.permits, {
        id:   generateId(),
        desc: '[Rental] ' + (rentalDesc.trim() || 'Equipment'),
        cost,
      }],
    }));
    setRentalDesc(''); setRentalCost('');
  }

  // ── Remove handlers (permits array covers both permit + rental entries) ───
  function removeFromPermits(id: string) {
    setState(s => ({ ...s, permits: s.permits.filter(p => p.id !== id) }));
  }
  function removeFromSubs(id: string) {
    setState(s => ({ ...s, subs: s.subs.filter(p => p.id !== id) }));
  }

  // ── Section totals ─────────────────────────────────────────────────────────
  const permitBase   = permitEntries.reduce((s, p) => s + p.cost, 0);
  const permitMkup   = permitEntries.reduce((s, p) => s + p.cost * R.permit, 0);
  const subBase      = state.subs.reduce((s, p) => s + p.cost, 0);
  const subMkup      = state.subs.reduce((s, p) => s + p.cost * R.sub, 0);
  const rentalBase   = rentalEntries.reduce((s, p) => s + p.cost, 0);
  const rentalMkup   = rentalEntries.reduce((s, p) => s + p.cost * R.bulk, 0);
  const grandTotal   =
    (permitBase + permitMkup) + (subBase + subMkup) + (rentalBase + rentalMkup);

  // ── Helper: key-press enter to submit ─────────────────────────────────────
  const onEnter = (fn: () => void) =>
    (e: React.KeyboardEvent) => e.key === 'Enter' && fn();

  return (
    <div className="max-w-3xl">

      {/* ── PERMITS & FEES ─────────────────────────────────────────────────── */}
      <div className={CLS.sectionCard}>
        <div className={CLS.sectionTitle}>
          <span>Permits &amp; Fees</span>
          <span className="font-normal text-gray-500 normal-case tracking-normal">
            (+{(R.permit * 100).toFixed(0)}% markup applied)
          </span>
        </div>

        {permitEntries.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No permit entries yet.</p>
        )}

        {permitEntries.map(p => (
          <div key={p.id} className={CLS.entryRow}>
            <span className="flex-1 text-sm text-gray-800">{p.desc}</span>
            <span className="font-mono text-sm text-gray-600">{fmt$(p.cost)}</span>
            <span className="text-xs text-gray-400 shrink-0">
              markup: {fmt$(p.cost * R.permit)}
            </span>
            <button onClick={() => removeFromPermits(p.id)} className={CLS.removeBtn}>
              × Remove
            </button>
          </div>
        ))}

        <div className="flex gap-2 mt-3 flex-wrap">
          <input type="text" placeholder="Description" value={permitDesc}
            onChange={e => setPermitDesc(e.target.value)}
            onKeyDown={onEnter(addPermit)}
            className={CLS.inputText} />
          <input type="number" placeholder="$0.00" min={0} step="0.01" value={permitCost}
            onChange={e => setPermitCost(e.target.value)}
            onKeyDown={onEnter(addPermit)}
            className={CLS.inputAmt} />
          <button onClick={addPermit} className={CLS.addBtn}>+ Add Permit</button>
        </div>

        {permitEntries.length > 0 && (
          <div className={CLS.subtotalRow}>
            <span>Base: {fmt$(permitBase)}</span>
            <span>Markup: {fmt$(permitMkup)}</span>
            <span className="font-semibold text-gray-800">
              Total: {fmt$(permitBase + permitMkup)}
            </span>
          </div>
        )}
      </div>

      {/* ── SUBCONTRACTORS ─────────────────────────────────────────────────── */}
      <div className={CLS.sectionCard}>
        <div className={CLS.sectionTitle}>
          <span>Subcontractors</span>
          <span className="font-normal text-gray-500 normal-case tracking-normal">
            (+{(R.sub * 100).toFixed(0)}% markup applied)
          </span>
        </div>

        {state.subs.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No subcontractor entries yet.</p>
        )}

        {state.subs.map(p => (
          <div key={p.id} className={CLS.entryRow}>
            <span className="flex-1 text-sm text-gray-800">{p.desc}</span>
            <span className="font-mono text-sm text-gray-600">{fmt$(p.cost)}</span>
            <span className="text-xs text-gray-400 shrink-0">
              markup: {fmt$(p.cost * R.sub)}
            </span>
            <button onClick={() => removeFromSubs(p.id)} className={CLS.removeBtn}>
              × Remove
            </button>
          </div>
        ))}

        <div className="flex gap-2 mt-3 flex-wrap">
          <input type="text" placeholder="Description" value={subDesc}
            onChange={e => setSubDesc(e.target.value)}
            onKeyDown={onEnter(addSub)}
            className={CLS.inputText} />
          <input type="number" placeholder="$0.00" min={0} step="0.01" value={subCost}
            onChange={e => setSubCost(e.target.value)}
            onKeyDown={onEnter(addSub)}
            className={CLS.inputAmt} />
          <button onClick={addSub} className={CLS.addBtn}>+ Add Sub</button>
        </div>

        {state.subs.length > 0 && (
          <div className={CLS.subtotalRow}>
            <span>Base: {fmt$(subBase)}</span>
            <span>Markup: {fmt$(subMkup)}</span>
            <span className="font-semibold text-gray-800">
              Total: {fmt$(subBase + subMkup)}
            </span>
          </div>
        )}
      </div>

      {/* ── EQUIPMENT RENTAL ───────────────────────────────────────────────── */}
      <div className={CLS.sectionCard}>
        <div className={CLS.sectionTitle}>
          <span>Equipment Rental</span>
          <span className="font-normal text-gray-500 normal-case tracking-normal">
            (+{(R.bulk * 100).toFixed(1)}% bulk markup applied)
          </span>
        </div>

        {rentalEntries.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No rental entries yet.</p>
        )}

        {rentalEntries.map(p => (
          <div key={p.id} className={CLS.entryRow}>
            <span className="flex-1 text-sm text-gray-800">
              {p.desc.replace('[Rental] ', '')}
            </span>
            <span className="font-mono text-sm text-gray-600">{fmt$(p.cost)}</span>
            <span className="text-xs text-gray-400 shrink-0">
              markup: {fmt$(p.cost * R.bulk)}
            </span>
            <button onClick={() => removeFromPermits(p.id)} className={CLS.removeBtn}>
              × Remove
            </button>
          </div>
        ))}

        <div className="flex gap-2 mt-3 flex-wrap">
          <input type="text" placeholder="Description" value={rentalDesc}
            onChange={e => setRentalDesc(e.target.value)}
            onKeyDown={onEnter(addRental)}
            className={CLS.inputText} />
          <input type="number" placeholder="$0.00" min={0} step="0.01" value={rentalCost}
            onChange={e => setRentalCost(e.target.value)}
            onKeyDown={onEnter(addRental)}
            className={CLS.inputAmt} />
          <button onClick={addRental} className={CLS.addBtn}>+ Add Rental</button>
        </div>

        {rentalEntries.length > 0 && (
          <div className={CLS.subtotalRow}>
            <span>Base: {fmt$(rentalBase)}</span>
            <span>Markup: {fmt$(rentalMkup)}</span>
            <span className="font-semibold text-gray-800">
              Total: {fmt$(rentalBase + rentalMkup)}
            </span>
          </div>
        )}
      </div>

      {/* ── GRAND TOTAL BAR ────────────────────────────────────────────────── */}
      <div className="bg-[#eef4ff] border border-[#d0dff0] rounded-lg px-4 py-3 text-sm text-[#1e3a8a] flex flex-wrap gap-x-6 gap-y-1 items-center">
        <span><strong>Permits:</strong> {fmt$(permitBase + permitMkup)}</span>
        <span><strong>Subs:</strong> {fmt$(subBase + subMkup)}</span>
        <span><strong>Rental:</strong> {fmt$(rentalBase + rentalMkup)}</span>
        <span className="ml-auto font-bold text-base">
          <strong>Total w/ markup:</strong> {fmt$(grandTotal)}
        </span>
      </div>
    </div>
  );
}
