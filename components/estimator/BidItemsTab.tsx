'use client';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates, applyMarkup, type SavedAssembly } from '@/lib/estimator/constants';
import { BOM, type BomItem } from '@/lib/estimator/bom';
import type { EstimatorState } from '@/lib/estimator/state';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { LabelSelector } from '@/components/estimator/LabelSelector';

// ── Key type (subset of EstimatorState that holds SavedAssembly[]) ─────────────

type AsmKey = keyof Pick<EstimatorState,
  | 'savedRuns' | 'savedRacks' | 'savedMCHR'      | 'savedThreeWay'
  | 'savedData' | 'savedFA'   | 'savedCans'        | 'savedGear'
  | 'savedCustomDev' | 'savedTM' | 'savedLV'       | 'savedCustomAsm'
  | 'savedHAR' | 'savedFloorBox' | 'asms'          | 'savedPanels'>;

// ── Group definitions (in display order) ──────────────────────────────────────

const GROUPS: Array<{ key: AsmKey; label: string }> = [
  { key: 'savedRuns',      label: 'Conduit Runs'                },
  { key: 'savedRacks',     label: 'Strut Racks'                 },
  { key: 'savedMCHR',      label: 'MC Home Runs'                },
  { key: 'savedThreeWay',  label: 'Three-Way Circuits'          },
  { key: 'savedData',      label: 'Data Locations'              },
  { key: 'savedFA',        label: 'Fire Alarm'                  },
  { key: 'savedCans',      label: 'Pull/Splice Cans'            },
  { key: 'savedPanels',    label: 'Panel Load Centers'          },
  { key: 'savedGear',      label: 'Commercial Gear'             },
  { key: 'savedCustomDev', label: 'Custom Devices'              },
  { key: 'savedTM',        label: 'Time & Materials'            },
  { key: 'savedLV',        label: 'Low Voltage'                 },
  { key: 'savedCustomAsm', label: 'Custom Assemblies'           },
  { key: 'savedHAR',       label: 'High-Amp Receptacles'        },
  { key: 'savedFloorBox',  label: 'Floor Boxes'                 },
  { key: 'asms',           label: 'Device / Fixture Assemblies' },
];

// ── Format helpers ─────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// ── Inline-edit cell style ─────────────────────────────────────────────────────

const CELL =
  'border border-transparent bg-transparent rounded px-1 py-0.5 text-xs' +
  ' focus:border-blue-300 focus:bg-white focus:outline-none w-full';

// ── AssemblyRow (internal) ────────────────────────────────────────────────────

function AssemblyRow({
  item, idx, groupKey, laborRate,
}: {
  item:      SavedAssembly;
  idx:       number;
  groupKey:  AsmKey;
  laborRate: number;
}) {
  const {
    removeAssembly, updateAssemblyLine,
    addAssemblyLine, removeAssemblyLine, setState,
    saveAssemblyToJob, saveAssemblyToMaster,
  } = useEstimatorContext();

  const [expanded,     setExpanded]     = useState(false);
  const [activeTab,    setActiveTab]    = useState<'summary' | 'byproducts'>('summary');
  const [addLineName,  setAddLineName]  = useState('');
  const [addLineMat,   setAddLineMat]   = useState('');
  const [addLineHrs,   setAddLineHrs]   = useState('');
  const [suggestions,  setSuggestions]  = useState<BomItem[]>([]);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const fmtH = (dollars: number) => (dollars / laborRate).toFixed(2) + 'h';
  const hasMissingPrice = item.lines.some(l => l.mat > 0 && l.mat < 0.10);

  function showSaveFeedback(msg: string) {
    setSaveFeedback(msg);
    setTimeout(() => setSaveFeedback(null), 2500);
  }

  function handleReset() {
    if (!window.confirm(
      'Clear the edited flag?\n\nNote: to fully restore original line items, ' +
      'remove this assembly and re-add it from the builder.'
    )) return;
    // Known limitation: clears the _edited flag only — does not restore original lines.
    // Proper snapshot-restore is future work.
    setState(s => {
      const arr = [...(s[groupKey] as SavedAssembly[])];
      arr[idx] = { ...arr[idx], _edited: false };
      return { ...s, [groupKey]: arr } as EstimatorState;
    });
  }

  return (
    <div className={`border-b border-gray-100 last:border-b-0${item._edited ? ' bg-orange-50/20' : ''}`}>

      {/* ── Collapsed header row ─────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50/40 select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-gray-400 shrink-0">
          {expanded
            ? <ChevronDown  className="w-3.5 h-3.5" />
            : <ChevronRight className="w-3.5 h-3.5" />}
        </span>

        <span className="flex-1 text-sm text-gray-800 truncate min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="truncate">{item.label}</span>
          {item._edited && (
            <span className="ml-1.5 text-[10px] text-orange-500 font-bold shrink-0" title="Manually edited">
              ✎
            </span>
          )}
          {item.bidPackage && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">
              {item.bidPackage}
            </span>
          )}
          {item.area && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium shrink-0">
              {item.area}
            </span>
          )}
          {item.costCode && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium shrink-0">
              {item.costCode}
            </span>
          )}
        </span>

        {hasMissingPrice && (
          <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 border border-yellow-300 font-semibold whitespace-nowrap">
            ⚠ Price needed
          </span>
        )}

        <span className="font-mono text-xs text-gray-400 shrink-0 hidden sm:block">
          {fmt$(item.mat)}
        </span>
        <span className="font-mono text-xs text-gray-400 shrink-0 w-14 text-right hidden sm:block">
          {fmtH(item.lab)}
        </span>
        <span className="font-mono text-sm font-bold text-[#1a3a5c] shrink-0 w-24 text-right">
          {fmt$(item.mat + item.lab)}
        </span>

        <button
          title="Remove assembly"
          onClick={e => { e.stopPropagation(); removeAssembly(groupKey, idx); }}
          className="shrink-0 text-red-400 hover:text-red-600 p-0.5 rounded transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Expanded content ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="bg-[#fafbfc] px-6 py-3">

          {/* Tab bar */}
          <div className="flex border-b border-gray-200 mb-3 mt-1">
            {(['summary', 'byproducts'] as const).map(tab => (
              <button
                key={tab}
                onClick={e => { e.stopPropagation(); setActiveTab(tab); }}
                className={`px-4 py-2 text-xs font-semibold capitalize border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-[#1a3a5c] text-[#1a3a5c]'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'byproducts' ? 'Byproducts' : 'Summary'}
                {tab === 'byproducts' && item._edited && (
                  <span className="ml-1 text-orange-400">✎</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Summary tab ──────────────────────────────────────────────── */}
          {activeTab === 'summary' && (
            <div className="space-y-1.5 py-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Material</span>
                <span className="font-mono">{fmt$(item.mat)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Labor</span>
                <span className="font-mono">{fmtH(item.lab)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1.5 mt-0.5">
                <span className="text-gray-700">Combined</span>
                <span className="font-mono text-[#1a3a5c]">{fmt$(item.mat + item.lab)}</span>
              </div>
            </div>
          )}

          {/* ── Byproducts tab ───────────────────────────────────────────── */}
          {activeTab === 'byproducts' && (
            <>
              {/* Line items table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 font-semibold border-b border-gray-200">
                    <th className="text-left pb-1 pr-2">Item</th>
                    <th className="text-right pb-1 w-8">Qty</th>
                    <th className="text-left pb-1 w-10 pl-1">Unit</th>
                    <th className="text-right pb-1 w-24">Mat $</th>
                    <th className="text-right pb-1 w-16">Hrs</th>
                    <th className="w-6" />
                  </tr>
                </thead>

                <tbody>
                  {item.lines.map((line, li) => {
                    // Section-header sentinel lines
                    if (line.name.startsWith('──')) {
                      return (
                        <tr key={li} className="bg-blue-50/50">
                          <td colSpan={6} className="py-1 px-1 text-blue-700 font-bold">
                            {line.name}
                          </td>
                        </tr>
                      );
                    }

                    const isMissingPrice = line.mat > 0 && line.mat < 0.10;
                    // Red border: line has no mat AND no lab — a descriptive placeholder
                    // the user added without filling in any costs.
                    const isNonBom = line.mat === 0 && line.lab === 0;

                    return (
                      <tr
                        key={li}
                        className={[
                          'border-b border-gray-100 hover:bg-blue-50',
                          isMissingPrice ? 'bg-yellow-50 border-l-2 border-yellow-400' : '',
                          isNonBom       ? 'border-l-2 border-red-400'                 : '',
                        ].join(' ')}
                      >
                        {/* Name — inline editable */}
                        <td className="py-0.5 pr-2">
                          <input
                            key={`n-${li}-${line.name}`}
                            type="text"
                            defaultValue={line.name}
                            onBlur={e =>
                              updateAssemblyLine(groupKey, idx, li, 'name', e.target.value)
                            }
                            className={CELL}
                          />
                        </td>
                        <td className="py-0.5 text-right text-gray-500 w-8 shrink-0">
                          {line.qty}
                        </td>
                        <td className="py-0.5 text-gray-500 w-10 pl-1 shrink-0">
                          {line.unit}
                        </td>
                        {/* Mat $ — inline editable */}
                        <td className="py-0.5 w-24">
                          {isMissingPrice ? (
                            <div className="flex items-center gap-1">
                              <input
                                key={`m-${li}-${line.mat}`}
                                type="number"
                                step="0.01"
                                defaultValue={line.mat.toFixed(2)}
                                onBlur={e =>
                                  updateAssemblyLine(
                                    groupKey, idx, li, 'mat',
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                className={`${CELL} text-right font-mono border-yellow-400 bg-yellow-50`}
                              />
                              <span className="text-yellow-500 text-xs whitespace-nowrap" title="Enter quoted price">
                                ⚠ quote
                              </span>
                            </div>
                          ) : (
                            <input
                              key={`m-${li}-${line.mat}`}
                              type="number"
                              step="0.01"
                              defaultValue={line.mat.toFixed(2)}
                              onBlur={e =>
                                updateAssemblyLine(
                                  groupKey, idx, li, 'mat',
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className={`${CELL} text-right font-mono`}
                            />
                          )}
                        </td>
                        {/* Hrs — inline editable (displayed as hours, saved as dollars) */}
                        <td className="py-0.5 w-16">
                          <input
                            key={`h-${li}-${line.lab}`}
                            type="number"
                            step="0.01"
                            defaultValue={(line.lab / laborRate).toFixed(2)}
                            onBlur={e =>
                              updateAssemblyLine(
                                groupKey, idx, li, 'lab',
                                (parseFloat(e.target.value) || 0) * laborRate,
                              )
                            }
                            className={`${CELL} text-right font-mono`}
                          />
                        </td>
                        {/* Delete line */}
                        <td className="py-0.5 text-right">
                          <button
                            onClick={() => removeAssemblyLine(groupKey, idx, li)}
                            title="Remove line"
                            className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="font-bold border-t-2 border-[#1a3a5c]">
                    <td className="py-1 text-gray-700" colSpan={3}>Total</td>
                    <td className="text-right py-1 font-mono text-gray-800">
                      {fmt$(item.mat)}
                    </td>
                    <td className="text-right py-1 font-mono text-gray-800">
                      {fmtH(item.lab)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>

              {/* ── Add line ──────────────────────────────────────────────── */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                <input
                  type="text"
                  placeholder="Search BOM or type item name..."
                  value={addLineName}
                  onChange={e => {
                    setAddLineName(e.target.value);
                    setSuggestions(
                      BOM.filter(b =>
                        b.name.toLowerCase().includes(e.target.value.toLowerCase())
                      ).slice(0, 6)
                    );
                  }}
                  className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
                />
                <input
                  type="number"
                  placeholder="Mat $"
                  value={addLineMat}
                  onChange={e => setAddLineMat(e.target.value)}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
                />
                <input
                  type="number"
                  placeholder="Hrs"
                  value={addLineHrs}
                  onChange={e => setAddLineHrs(e.target.value)}
                  className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#1a3a5c]"
                />
                <button
                  onClick={() => {
                    const R = getRates();
                    addAssemblyLine(
                      groupKey, idx,
                      addLineName.trim() || 'New Line',
                      parseFloat(addLineMat) || 0,
                      (parseFloat(addLineHrs) || 0) * R.labor,
                    );
                    setAddLineName('');
                    setAddLineMat('');
                    setAddLineHrs('');
                    setSuggestions([]);
                  }}
                  className="shrink-0 border border-[#1a3a5c] text-[#1a3a5c] rounded px-2 py-1 text-xs font-medium hover:bg-[#1a3a5c] hover:text-white transition-colors"
                >
                  + Add
                </button>
              </div>

              {/* BOM suggestions dropdown */}
              {suggestions.length > 0 && (
                <div className="border border-gray-200 rounded mt-1 shadow-sm bg-white max-h-40 overflow-y-auto">
                  {suggestions.map(b => (
                    <div
                      key={b.id}
                      onClick={() => {
                        setAddLineName(b.name);
                        setAddLineMat(applyMarkup(b.mat, b.mk).toFixed(2));
                        setAddLineHrs(String(b.lhr));
                        setSuggestions([]);
                      }}
                      className="px-3 py-2 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                    >
                      <span className="text-gray-700">{b.name}</span>
                      <span className="text-gray-400">${b.mat.toFixed(2)} · {b.lhr}hr</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Save / Reset (only when edited) ──────────────────────── */}
              {item._edited && (
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500 self-center">Save changes:</span>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      showSaveFeedback('Assembly updated');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    This Assembly
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      saveAssemblyToJob(groupKey, idx);
                      showSaveFeedback('Saved to this job');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-[#1a3a5c] text-[#1a3a5c] hover:bg-blue-50"
                  >
                    This Job
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      saveAssemblyToMaster(groupKey, idx);
                      showSaveFeedback('Saved to master');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c]"
                  >
                    Master
                  </button>

                  <button
                    onClick={handleReset}
                    title="Clear edits — remove and re-add from builder to fully restore"
                    className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-500 hover:bg-gray-100 ml-auto"
                  >
                    ↺ Reset
                  </button>

                  {saveFeedback && (
                    <span className="text-xs text-green-600 self-center">✓ {saveFeedback}</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── BidItemsTab (exported) ────────────────────────────────────────────────────

export function BidItemsTab() {
  const { state, setTab } = useEstimatorContext();
  const R = getRates();

  const fmtH = (dollars: number) => (dollars / R.labor).toFixed(2) + 'h';

  const allItems = GROUPS.flatMap(g => (state[g.key] as SavedAssembly[]) ?? []);
  const totalMat = allItems.reduce((s, i) => s + i.mat, 0);
  const totalLab = allItems.reduce((s, i) => s + i.lab, 0);
  const missingPriceCount = allItems.filter(item =>
    item.lines.some(l => l.mat > 0 && l.mat < 0.10)
  ).length;

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (allItems.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-16">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-base mb-1">No assemblies added yet.</p>
          <p className="text-gray-400 text-sm mb-6">
            Go to Assembly Library to start building your estimate.
          </p>
          <button
            onClick={() => setTab('assemblies')}
            className="bg-[#002D72] text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
          >
            Go to Assembly Library
          </button>
        </div>
      </div>
    );
  }

  // ── Populated state ──────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl">
      <LabelSelector />

      {/* Summary bar */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800 mb-3 flex flex-wrap gap-x-6 gap-y-1">
        <span><strong>Items:</strong> {allItems.length}</span>
        <span><strong>Mat:</strong> {fmt$(totalMat)}</span>
        <span><strong>Labor:</strong> {fmtH(totalLab)}</span>
        <span><strong>Combined:</strong> {fmt$(totalMat + totalLab)}</span>
      </div>

      {missingPriceCount > 0 && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2 text-sm text-yellow-800 mb-4">
          <span className="text-lg">⚠</span>
          <span>
            <strong>{missingPriceCount} assembl{missingPriceCount !== 1 ? 'ies' : 'y'}</strong>
            {' '}contain per-quote placeholders.
            Expand the highlighted rows to enter quoted prices.
            These affect your grand total.
          </span>
        </div>
      )}

      {/* Groups */}
      {GROUPS.map(({ key, label }) => {
        const arr = (state[key] as SavedAssembly[]) ?? [];
        if (arr.length === 0) return null;
        const groupTotal = arr.reduce((s, i) => s + i.mat + i.lab, 0);

        return (
          <div key={key} className="mb-2">
            {/* Group header */}
            <div className="bg-[#eef4ff] px-4 py-2 text-xs font-bold text-[#1a3a5c] border-b border-[#d0dff0] flex justify-between items-center mt-3 rounded-t">
              <span>{label} ({arr.length})</span>
              <span className="font-mono">{fmt$(groupTotal)} total</span>
            </div>

            {/* Group body */}
            <div className="border border-[#d0dff0] border-t-0 rounded-b overflow-hidden">
              {arr.map((item, idx) => (
                <AssemblyRow
                  key={idx}
                  item={item}
                  idx={idx}
                  groupKey={key}
                  laborRate={R.labor}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
