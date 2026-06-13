'use client';
import { generateId } from '@/lib/utils/uuid';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import {
  BREAKER_DEFS, PANEL_MOUNT_LABOR,
  calcPanel, createPanelState,
  type CircuitSlot,
} from '@/lib/estimator/panelBuilder';
import { getRates } from '@/lib/estimator/constants';
import { fmt$ } from '@/lib/estimator/format';
import { LabelSelector } from './LabelSelector';
import { useMemo, useState } from 'react';

// ── Button group helper ────────────────────────────────────────────────────────

function BtnGroup<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value:   T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
      {options.map((opt, i) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
            i > 0 ? 'border-l border-gray-200' : '',
            value === opt.value
              ? 'bg-[#1e3a8a] text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── PanelBuilderTab ────────────────────────────────────────────────────────────

export function PanelBuilderTab() {
  const { state, setState } = useEstimatorContext();
  const panel = state.panelState;
  const R = getRates();

  // Local state for adding a new circuit
  const [newBreaker, setNewBreaker] = useState('1p20');
  const [newDesc,    setNewDesc]    = useState('');

  function patchPanel(patch: Partial<typeof panel>) {
    setState(s => ({
      ...s,
      panelState: { ...s.panelState, ...patch },
    }));
  }

  function nextSlot(): number {
    const used = new Set(panel.circuits.map(c => c.slot));
    let slot = 1;
    while (used.has(slot)) slot += 2;
    return slot;
  }

  function addCircuit() {
    const def = BREAKER_DEFS[newBreaker];
    if (!def) return;
    const slot = nextSlot();
    const circuit: CircuitSlot = {
      id:          generateId(),
      slot,
      desc:        newDesc || def.label,
      breakerType: newBreaker,
      bomId:       def.bomId,
    };
    patchPanel({ circuits: [...panel.circuits, circuit] });
    setNewDesc('');
  }

  function removeCircuit(id: string) {
    patchPanel({ circuits: panel.circuits.filter(c => c.id !== id) });
  }

  function updateCircuitDesc(id: string, desc: string) {
    patchPanel({
      circuits: panel.circuits.map(c =>
        c.id === id ? { ...c, desc } : c
      ),
    });
  }

  const maxSlots = panel.panelBomId === 'pg1' ? 30 : 40;

  // All panel-derived values in one memo so panel.circuits is only iterated once per change
  const { preview, totalSlots, mountLhr, bkrSummary, sortedCircuits } = useMemo(() => {
    const preview    = calcPanel(panel);
    const mountLhr   = PANEL_MOUNT_LABOR[panel.panelBomId]?.[panel.mountType] ?? 3.0;
    let   totalSlots = 0;
    const bkrTally: Record<string, number> = {};
    const sorted     = [...panel.circuits].sort((a, b) => a.slot - b.slot);
    for (const c of panel.circuits) {
      const def    = BREAKER_DEFS[c.breakerType];
      totalSlots  += def?.isTandem ? 1 : (def?.poles ?? 1);
      bkrTally[c.breakerType] = (bkrTally[c.breakerType] ?? 0) + 1;
    }
    const bkrSummary = Object.entries(bkrTally)
      .map(([bt, qty]) => `${BREAKER_DEFS[bt]?.label ?? bt} ×${qty}`)
      .join(' | ');
    return { preview, totalSlots, mountLhr, bkrSummary, sortedCircuits: sorted };
  }, [panel]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl">
      <LabelSelector />
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 space-y-4 lg:space-y-0">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* PANEL SELECTION */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] mb-3">
              Panel Builder
            </h2>

            <div className="space-y-3">
              {/* Panel type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Panel Type
                </label>
                <BtnGroup
                  options={[
                    { value: 'pg1', label: '100A Load Center' },
                    { value: 'pg2', label: '200A Load Center' },
                  ]}
                  value={panel.panelBomId}
                  onChange={v => patchPanel({ panelBomId: v })}
                />
              </div>

              {/* Panel description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Panel Description
                </label>
                <input
                  key={panel.panelBomId + '-desc'}
                  type="text"
                  defaultValue={panel.panelDesc}
                  placeholder="e.g. Main Panel — Building A"
                  onBlur={e => patchPanel({ panelDesc: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Mount type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Mount Type
                </label>
                <BtnGroup
                  options={[
                    { value: 'surface',  label: 'Surface Mount' },
                    { value: 'recessed', label: 'Recessed'      },
                  ]}
                  value={panel.mountType}
                  onChange={v => patchPanel({ mountType: v })}
                />
              </div>

              {/* Surge protector */}
              <div className="flex items-center gap-2">
                <input
                  id="surge-check"
                  type="checkbox"
                  checked={panel.surge}
                  onChange={e => patchPanel({ surge: e.target.checked })}
                  className="w-4 h-4 accent-[#1e3a8a]"
                />
                <label htmlFor="surge-check" className="text-sm text-gray-700 cursor-pointer">
                  Add whole-home surge protector <span className="text-gray-400">(+$101.89)</span>
                </label>
              </div>

              {/* Difficulty — inline buttons (number values, avoids parseFloat) */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Difficulty
                </label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200 w-fit">
                  {([
                    { value: 1.0,  label: 'Normal'      },
                    { value: 1.25, label: 'Difficult'   },
                    { value: 1.55, label: 'V.Difficult' },
                  ] as const).map((opt, i) => (
                    <button
                      key={opt.value}
                      onClick={() => patchPanel({ diff: opt.value })}
                      className={[
                        'px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                        i > 0 ? 'border-l border-gray-200' : '',
                        panel.diff === opt.value
                          ? 'bg-[#1e3a8a] text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CIRCUIT DIRECTORY */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h2 className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] mb-3">
              Circuit Directory
            </h2>

            {panel.circuits.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No circuits added yet. Add circuits below.
              </p>
            ) : (
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400 font-semibold">
                      <th className="text-left pb-1.5 pr-2 w-10">Slot</th>
                      <th className="text-left pb-1.5 pr-2">Description</th>
                      <th className="text-left pb-1.5 pr-2">Breaker</th>
                      <th className="text-center pb-1.5 w-10">Poles</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCircuits.map(circuit => {
                      const def = BREAKER_DEFS[circuit.breakerType];
                      return (
                        <tr key={circuit.id} className="border-b border-gray-50 hover:bg-blue-50/30">
                          <td className="py-1 pr-2 font-mono text-xs text-gray-400 w-10">
                            {circuit.slot}
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              key={circuit.id + '-desc'}
                              type="text"
                              defaultValue={circuit.desc}
                              onBlur={e => updateCircuitDesc(circuit.id, e.target.value)}
                              className="text-sm border-transparent bg-transparent rounded px-1 focus:border-blue-300 focus:bg-white focus:outline-none w-full"
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <span className="text-xs text-gray-600">
                              {def?.label ?? circuit.breakerType}
                            </span>
                            {def?.isAfci && (
                              <span className="ml-1 px-1 py-0.5 text-[10px] rounded bg-orange-100 text-orange-700 font-bold">
                                AFCI
                              </span>
                            )}
                            {def?.isGfci && (
                              <span className="ml-1 px-1 py-0.5 text-[10px] rounded bg-blue-100 text-blue-700 font-bold">
                                GFCI
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-center text-xs text-gray-400 w-10">
                            {def?.poles ?? '—'}
                          </td>
                          <td className="py-1 text-right w-8">
                            <button
                              onClick={() => removeCircuit(circuit.id)}
                              className="text-red-400 hover:text-red-600 text-xs px-1 transition-colors"
                              title="Remove circuit"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ADD CIRCUIT FORM */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
              <select
                value={newBreaker}
                onChange={e => setNewBreaker(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
              >
                <optgroup label="Single Pole">
                  <option value="1p15">1P 15A</option>
                  <option value="1p15_afci">1P 15A AFCI</option>
                  <option value="1p20">1P 20A</option>
                  <option value="1p20_afci">1P 20A AFCI/GFCI</option>
                  <option value="1p20_gfci">1P 20A GFCI</option>
                  <option value="1p30">1P 30A</option>
                  <option value="1p60">1P 60A</option>
                  <option value="tandem_20">Tandem 2×20A</option>
                </optgroup>
                <optgroup label="Double Pole">
                  <option value="2p20">2P 20A</option>
                  <option value="2p30">2P 30A</option>
                  <option value="2p50">2P 50A</option>
                  <option value="2p50_gfci">2P 50A GFCI</option>
                </optgroup>
              </select>

              <input
                type="text"
                placeholder="e.g. Kitchen Recepts"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCircuit(); }}
                className="flex-1 min-w-[140px] border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
              />

              <button
                onClick={addCircuit}
                className="px-3 py-1.5 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] transition-colors whitespace-nowrap"
              >
                + Add Circuit
              </button>
            </div>

            {/* BREAKER SUMMARY */}
            {bkrSummary && (
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 font-mono">
                {bkrSummary}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* LIVE PREVIEW */}
          {preview && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] mb-1">
                Preview
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                {preview.label}
              </p>

              {/* Slot usage */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500">Slots used:</span>
                <span className={`text-xs font-bold font-mono ${
                  totalSlots > maxSlots ? 'text-red-600' : 'text-[#1e3a8a]'
                }`}>
                  {totalSlots} / {maxSlots}
                </span>
                {totalSlots > maxSlots && (
                  <span className="text-xs text-red-500">⚠ Over capacity</span>
                )}
              </div>

              {/* Line items */}
              <table className="w-full text-xs mb-2">
                <thead>
                  <tr className="text-gray-400 font-semibold border-b border-gray-100">
                    <th className="text-left pb-1 pr-2">Item</th>
                    <th className="text-right pb-1 w-8">Qty</th>
                    <th className="text-right pb-1 w-20">Mat</th>
                    <th className="text-right pb-1 w-14">Hrs</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-0.5 pr-2 text-gray-700 truncate max-w-[120px]" title={line.name}>
                        {line.name}
                      </td>
                      <td className="py-0.5 text-right text-gray-400 w-8">
                        {line.qty}
                      </td>
                      <td className="py-0.5 text-right font-mono text-gray-700 w-20">
                        {line.mat > 0 ? fmt$(line.mat) : '—'}
                      </td>
                      <td className="py-0.5 text-right font-mono text-gray-400 w-14">
                        {line.lab > 0 ? (line.lab / R.labor).toFixed(2) + 'h' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-[#1e3a8a]">
                    <td className="py-1 text-gray-700" colSpan={2}>Total</td>
                    <td className="py-1 text-right font-mono text-gray-800">
                      {fmt$(preview.mat)}
                    </td>
                    <td className="py-1 text-right font-mono text-gray-600">
                      {(preview.lab / R.labor).toFixed(2)}h
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Mount labor note */}
              <p className="text-[10px] text-gray-400 italic">
                Panel mount labor: {mountLhr}hrs ({panel.mountType}, NECA S4)
              </p>

              {/* ADD TO BID */}
              <button
                disabled={panel.circuits.length === 0}
                onClick={() => {
                  const result = calcPanel(panel);
                  if (!result) return;
                  setState(s => ({
                    ...s,
                    savedPanels: [...s.savedPanels, result],
                    panelState:  createPanelState(),
                  }));
                }}
                className="mt-3 w-full py-2 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#003d99] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                + Add Panel to Bid
              </button>
              {panel.circuits.length === 0 && (
                <p className="text-[10px] text-gray-400 mt-1 text-center">
                  Add at least one circuit first
                </p>
              )}
            </div>
          )}

          {/* SAVED PANELS LIST */}
          {state.savedPanels.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <h3 className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] mb-3">
                Saved Panels
              </h3>
              <div className="space-y-2">
                {state.savedPanels.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-2 py-1.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{p.label}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {fmt$(p.mat)} mat · {(p.lab / R.labor).toFixed(2)}h labor
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setState(s => ({
                          ...s,
                          savedPanels: s.savedPanels.filter((_, j) => j !== i),
                        }))
                      }
                      className="text-red-400 hover:text-red-600 text-xs px-1 shrink-0 transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
