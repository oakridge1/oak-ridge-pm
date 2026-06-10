'use client';
import { generateId } from '@/lib/utils/uuid';

import { useState, useMemo, useEffect } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { LabelSelector } from '@/components/estimator/LabelSelector';
import { getRates, applyMarkup } from '@/lib/estimator/constants';
import { BOM, initBomCache } from '@/lib/estimator/bom';
import {
  type CustomAsmLine,
  type ConductorRow,
  type CustomAssemblyDef,
  CONDUCTOR_SIZES,
  lookupConductor,
  calcCustomAsmTotals,
  defToSavedAssembly,
  loadAsmLibrary,
  saveAsmLibrary,
} from '@/lib/estimator/customAssembly';

// ── Format helper ──────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const uid = () => generateId();

const sel =
  'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full';

// ── CustomAssemblyBuilder ──────────────────────────────────────────────────────

export function CustomAssemblyBuilder() {
  const { state, setState } = useEstimatorContext();
  const R = getRates();

  // ── Header state ──────────────────────────────────────────────────────────
  const [name,        setName]        = useState('');
  const [category,    setCategory]    = useState('Misc');
  const [newCatMode,  setNewCatMode]  = useState(false);
  const [newCatName,  setNewCatName]  = useState('');

  // ── Lines + conductors ────────────────────────────────────────────────────
  const [lines,      setLines]      = useState<CustomAsmLine[]>([]);
  const [conductors, setConductors] = useState<ConductorRow[]>([]);

  // ── Add-item row state (follows FixtureBuilderTab pattern) ────────────────
  const [addName,     setAddName]     = useState('');
  const [addQty,      setAddQty]      = useState('1');
  const [addUnit,     setAddUnit]     = useState<'EA' | 'FT'>('EA');
  const [addMat,      setAddMat]      = useState('');
  const [addHrs,      setAddHrs]      = useState('');
  const [addBomId,    setAddBomId]    = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<typeof BOM>([]);

  // ── Feedback ──────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // ── Library panel ─────────────────────────────────────────────────────────
  const [libraryOpen, setLibraryOpen] = useState(true);

  // Merge permanent library defs from localStorage into state on mount
  useEffect(() => {
    const stored = loadAsmLibrary();
    if (stored.length === 0) return;
    setState(s => {
      const known = new Set(s.customAsmDefs.map(d => d.id));
      const fresh = stored.filter(d => !known.has(d.id));
      if (fresh.length === 0) return s;
      return { ...s, customAsmDefs: [...s.customAsmDefs, ...fresh] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Category options: BOM categories + custom categories from library ─────
  const categories = useMemo(() => {
    const cats = new Set<string>(BOM.map(b => b.cat));
    for (const d of state.customAsmDefs) cats.add(d.category);
    return Array.from(cats).sort();
  }, [state.customAsmDefs]);

  // ── Totals (live) ─────────────────────────────────────────────────────────
  const { totalMat, totalHrs } = useMemo(
    () => calcCustomAsmTotals(lines, conductors),
    [lines, conductors],
  );

  // ── Line helpers ──────────────────────────────────────────────────────────

  function updateLine(id: string, changes: Partial<CustomAsmLine>) {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...changes } : l)));
  }

  function removeLine(id: string) {
    setLines(prev => prev.filter(l => l.id !== id));
  }

  function handleAddLine() {
    if (!addName.trim()) return;
    const qty = parseFloat(addQty) || 1;
    const hrsPerUnit = parseFloat(addHrs) || 0;
    setLines(prev => [...prev, {
      id:      uid(),
      name:    addName.trim(),
      unit:    addUnit,
      qty,
      matUnit: parseFloat(addMat) || 0,
      hrs:     hrsPerUnit * qty,
      bomId:   addBomId ?? undefined,
      isNew:   !addBomId,
    }]);
    setAddName(''); setAddQty('1'); setAddUnit('EA');
    setAddMat(''); setAddHrs(''); setAddBomId(null);
    setSuggestions([]);
  }

  // ── Conductor helpers ─────────────────────────────────────────────────────

  function makeConductor(size: string, material: 'Cu' | 'Al'): ConductorRow {
    const found = lookupConductor(size, material);
    return {
      id:       uid(),
      size,
      material,
      feet:     0,
      matUnit:  found?.matUnit ?? 0,
      lhrFt:    found?.lhrFt   ?? 0,
      bomId:    found?.bomId,
    };
  }

  function addConductor() {
    setConductors(prev => [...prev, makeConductor('#12', 'Cu')]);
  }

  function updateConductor(id: string, changes: Partial<ConductorRow>) {
    setConductors(prev => prev.map(c => {
      if (c.id !== id) return c;
      const next = { ...c, ...changes };
      // Re-lookup price when size or material changed
      if (changes.size !== undefined || changes.material !== undefined) {
        const found = lookupConductor(next.size, next.material);
        next.bomId   = found?.bomId;
        next.matUnit = found?.matUnit ?? 0;
        next.lhrFt   = found?.lhrFt   ?? 0;
      }
      return next;
    }));
  }

  function removeConductor(id: string) {
    setConductors(prev => prev.filter(c => c.id !== id));
  }

  // ── Build a def from the current form ─────────────────────────────────────

  function buildDef(permanent: boolean): CustomAssemblyDef {
    return {
      id:         uid(),
      name:       name.trim(),
      category,
      lines,
      conductors,
      totalMat,
      totalHrs,
      permanent,
      createdAt:  new Date().toISOString(),
    };
  }

  function resetForm() {
    setName('');
    setLines([]);
    setConductors([]);
  }

  // ── Add to This Job ───────────────────────────────────────────────────────

  function pushToJob(def: CustomAssemblyDef) {
    const asm = defToSavedAssembly(def);
    setState(s => ({
      ...s,
      savedCustomAsm: [...s.savedCustomAsm, {
        ...asm,
        bidPackage: s.activeBidPackage || undefined,
        area:       s.activeArea       || undefined,
        costCode:   s.activeCostCode   || undefined,
      }],
    }));
  }

  function handleAddToJob() {
    if (!name.trim()) { showToast('⚠ Enter an assembly name first'); return; }
    if (lines.length === 0 && conductors.length === 0) {
      showToast('⚠ Add at least one item or conductor'); return;
    }
    pushToJob(buildDef(false));
    showToast('✓ Added to bid');
    resetForm();
  }

  // ── Save to Library ───────────────────────────────────────────────────────

  async function handleSaveToLibrary() {
    if (!name.trim()) { showToast('⚠ Enter an assembly name first'); return; }
    if (lines.length === 0 && conductors.length === 0) {
      showToast('⚠ Add at least one item or conductor'); return;
    }

    // 1. Write any NEW items back to the BOM
    const newItems = lines.filter(l => l.isNew);
    let updatedLines = lines;
    if (newItems.length > 0) {
      const payload = newItems.map(l => ({
        id:   `cust_${l.id.slice(0, 8)}`,
        cat:  category,
        name: l.name,
        unit: l.unit,
        mat:  l.matUnit,
        lhr:  l.qty > 0 ? l.hrs / l.qty : l.hrs,
      }));
      try {
        const res = await fetch('/api/bom', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        if (res.ok) {
          // Mark lines as no longer new, link to their BOM ids
          updatedLines = lines.map(l => {
            const written = payload.find(p => p.id === `cust_${l.id.slice(0, 8)}`);
            return written ? { ...l, isNew: false, bomId: written.id } : l;
          });
          setLines(updatedLines);
          initBomCache();
        }
      } catch {
        // network failure — save locally anyway, items stay flagged NEW
      }
    }

    // 2. Build the permanent def and persist
    const def: CustomAssemblyDef = {
      ...buildDef(true),
      lines: updatedLines,
    };
    setState(s => ({ ...s, customAsmDefs: [...s.customAsmDefs, def] }));
    saveAsmLibrary([...loadAsmLibrary().filter(d => d.id !== def.id), def]);

    // 3. Also add to this job
    pushToJob(def);
    showToast('✓ Saved to library + added to bid');
    resetForm();
  }

  // ── Library actions ───────────────────────────────────────────────────────

  function handleLibraryAddToBid(def: CustomAssemblyDef) {
    pushToJob(def);
    showToast(`✓ "${def.name}" added to bid`);
  }

  function handleLibraryDelete(def: CustomAssemblyDef) {
    if (!window.confirm(`Delete "${def.name}" from the assembly library?`)) return;
    setState(s => ({
      ...s,
      customAsmDefs: s.customAsmDefs.filter(d => d.id !== def.id),
    }));
    saveAsmLibrary(loadAsmLibrary().filter(d => d.id !== def.id));
  }

  const permanentDefs = state.customAsmDefs.filter(d => d.permanent);
  const hasNewItems   = lines.some(l => l.isNew);

  return (
    <div className="max-w-3xl">
      <LabelSelector />

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
          Custom Assembly Builder
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assembly Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rooftop Disconnect Package"
              className={sel}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            {newCatMode ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  placeholder="New category name"
                  className={sel}
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (newCatName.trim()) setCategory(newCatName.trim());
                    setNewCatMode(false);
                    setNewCatName('');
                  }}
                  className="px-2 py-1 text-xs font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] shrink-0"
                >✓</button>
                <button
                  onClick={() => { setNewCatMode(false); setNewCatName(''); }}
                  className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-500 shrink-0"
                >✕</button>
              </div>
            ) : (
              <select
                value={category}
                onChange={e => {
                  if (e.target.value === '__new__') setNewCatMode(true);
                  else setCategory(e.target.value);
                }}
                className={sel}
              >
                {!categories.includes(category) && (
                  <option value={category}>{category}</option>
                )}
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__new__">＋ Add new category...</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* ── MATERIALS ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
          Materials
        </div>

        <table className="w-full text-xs mb-2">
          <thead>
            <tr className="text-gray-400 font-semibold border-b border-gray-100">
              <th className="text-left pb-1 pr-2">Item</th>
              <th className="text-right pb-1 w-14">Qty</th>
              <th className="text-left pb-1 w-12 pl-1">Unit</th>
              <th className="text-right pb-1 w-20">Mat $</th>
              <th className="text-right pb-1 w-16">Hrs</th>
              <th className="w-6"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map(line => (
              <tr key={line.id} className="border-b border-gray-50 group">
                <td className="py-0.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={line.name}
                      onChange={e => updateLine(line.id, { name: e.target.value })}
                      className="flex-1 text-gray-700 bg-transparent hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] rounded px-1 -mx-1"
                    />
                    {line.isNew && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 whitespace-nowrap shrink-0"
                        title="Not in BOM — will be added on permanent save"
                      >
                        NEW
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-0.5 text-right">
                  <input
                    type="number"
                    min={0}
                    value={line.qty || ''}
                    onChange={e => updateLine(line.id, { qty: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-mono text-gray-600 bg-transparent hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] rounded px-1"
                  />
                </td>
                <td className="py-0.5 pl-1">
                  <select
                    value={line.unit}
                    onChange={e => updateLine(line.id, { unit: e.target.value as 'EA' | 'FT' })}
                    className="bg-transparent text-gray-500 focus:outline-none"
                  >
                    <option value="EA">EA</option>
                    <option value="FT">FT</option>
                  </select>
                </td>
                <td className="py-0.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.matUnit === 0 ? '' : line.matUnit}
                    placeholder="—"
                    onChange={e => updateLine(line.id, { matUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-mono text-gray-600 bg-transparent hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] rounded px-1"
                  />
                </td>
                <td className="py-0.5 text-right">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.hrs === 0 ? '' : line.hrs}
                    placeholder="—"
                    onChange={e => updateLine(line.id, { hrs: parseFloat(e.target.value) || 0 })}
                    className="w-full text-right font-mono text-gray-600 bg-transparent hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] rounded px-1"
                  />
                </td>
                <td className="py-0.5 pl-1">
                  <button
                    onClick={() => removeLine(line.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity leading-none"
                    title="Remove line"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}

            {/* ── Add item row ─────────────────────────────────────────────── */}
            <tr>
              <td colSpan={6} className="pt-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Search BOM or type name..."
                      value={addName}
                      onChange={e => {
                        setAddName(e.target.value);
                        setAddBomId(null);  // typing clears any prior BOM match
                        setSuggestions(
                          e.target.value.length > 1
                            ? BOM.filter(b =>
                                b.name.toLowerCase().includes(e.target.value.toLowerCase())
                              ).slice(0, 6)
                            : []
                        );
                      }}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto">
                        {suggestions.map(b => (
                          <div
                            key={b.id}
                            onClick={() => {
                              setAddName(b.name);
                              setAddUnit(b.unit);
                              setAddMat(String(applyMarkup(b.mat, b.mk)));
                              setAddHrs(String(b.lhr));
                              setAddBomId(b.id);
                              setSuggestions([]);
                            }}
                            className="px-3 py-1.5 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                          >
                            <span>{b.name}</span>
                            <span className="text-gray-400">${b.mat} · {b.lhr}hr</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={e => setAddQty(e.target.value)}
                    placeholder="Qty"
                    className="w-14 border border-gray-300 rounded px-2 py-1 text-xs text-center"
                  />
                  <select
                    value={addUnit}
                    onChange={e => setAddUnit(e.target.value as 'EA' | 'FT')}
                    className="w-14 border border-gray-300 rounded px-1 py-1 text-xs bg-white"
                  >
                    <option value="EA">EA</option>
                    <option value="FT">FT</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Mat $"
                    value={addMat}
                    onChange={e => setAddMat(e.target.value)}
                    className="w-20 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Hrs"
                    value={addHrs}
                    onChange={e => setAddHrs(e.target.value)}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-xs"
                  />
                  <button
                    onClick={handleAddLine}
                    className="px-2 py-1 text-xs font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c]"
                  >
                    + Add
                  </button>
                </div>
                {addName.length > 1 && !addBomId && suggestions.length === 0 && (
                  <p className="text-[11px] text-orange-500 mt-1">
                    Not in BOM — will be added as a NEW item (fill in price &amp; hours)
                  </p>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {hasNewItems && (
          <p className="text-xs text-orange-500">
            ⚠ Items flagged NEW are not in the BOM — they will be written to the BOM
            when you save this assembly to the library.
          </p>
        )}
      </div>

      {/* ── CONDUCTORS ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
          Conductors
        </div>

        {conductors.map(c => (
          <div key={c.id} className="flex items-center gap-2 mb-2">
            <select
              value={c.size}
              onChange={e => updateConductor(c.id, { size: e.target.value })}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-20"
            >
              {CONDUCTOR_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={c.material}
              onChange={e => updateConductor(c.id, { material: e.target.value as 'Cu' | 'Al' })}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-16"
            >
              <option value="Cu">Cu</option>
              <option value="Al">Al</option>
            </select>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={c.feet || ''}
                onChange={e => updateConductor(c.id, { feet: parseFloat(e.target.value) || 0 })}
                placeholder="0"
                className="w-20 border border-gray-300 rounded px-2 py-1.5 text-sm text-right font-mono"
              />
              <span className="text-xs text-gray-500">ft</span>
            </div>
            {c.bomId ? (
              <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                {fmt$(c.matUnit)}/ft
              </span>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-orange-500">$</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={c.matUnit || ''}
                  onChange={e => updateConductor(c.id, { matUnit: parseFloat(e.target.value) || 0 })}
                  placeholder="?/ft"
                  title="No BOM price found for this size/material — enter manually"
                  className="w-20 border border-orange-300 bg-orange-50 rounded px-2 py-1.5 text-sm text-right font-mono"
                />
                <span className="text-xs text-orange-400">/ft</span>
              </div>
            )}
            <button
              onClick={() => removeConductor(c.id)}
              className="text-red-400 hover:text-red-600 text-sm px-1 ml-auto"
              title="Remove conductor"
            >×</button>
          </div>
        ))}

        <button
          onClick={addConductor}
          className="w-full text-xs border border-dashed border-[#1e3a8a] text-[#1e3a8a] rounded py-1.5 hover:bg-blue-50 transition-colors mt-1"
        >
          + Add Conductor
        </button>
      </div>

      {/* ── TOTALS + SAVE ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-sm space-y-1 mb-4">
          <div className="flex justify-between text-gray-600">
            <span>Total Material</span>
            <span className="font-mono">{fmt$(totalMat)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Total Labor</span>
            <span className="font-mono">
              {totalHrs.toFixed(2)} hrs&nbsp;&nbsp;→&nbsp;&nbsp;{fmt$(totalHrs * R.labor)}
            </span>
          </div>
          <div className="flex justify-between font-bold text-[#1e3a8a] border-t-2 border-[#1e3a8a] pt-1.5 mt-1.5">
            <span>Combined</span>
            <span className="font-mono">{fmt$(totalMat + totalHrs * R.labor)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleAddToJob}
            className="px-4 py-2 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] transition-colors"
          >
            + Add to This Job
          </button>
          <button
            onClick={handleSaveToLibrary}
            className="px-4 py-2 text-sm font-semibold rounded border border-[#1e3a8a] text-[#1e3a8a] hover:bg-[#eef4ff] transition-colors"
          >
            ★ Save to Library
          </button>
          {toast && (
            <span className={`self-center text-sm font-semibold ${
              toast.startsWith('⚠') ? 'text-orange-500' : 'text-green-600'
            }`}>
              {toast}
            </span>
          )}
        </div>
      </div>

      {/* ── SAVED ASSEMBLIES (library) ──────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 shadow-sm">
        <button
          onClick={() => setLibraryOpen(o => !o)}
          className="w-full flex items-center justify-between text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3"
        >
          <span>Saved Assemblies ({permanentDefs.length})</span>
          <span className="text-gray-400">{libraryOpen ? '▾' : '▸'}</span>
        </button>

        {libraryOpen && (
          permanentDefs.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">
              No saved assemblies yet — build one above and click “Save to Library”.
            </p>
          ) : (
            permanentDefs.map(def => (
              <div
                key={def.id}
                className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800 truncate block">{def.name}</span>
                  <span className="text-xs text-gray-400">{def.category}</span>
                </div>
                <span className="font-mono text-xs text-gray-500 shrink-0">{fmt$(def.totalMat)}</span>
                <span className="font-mono text-xs text-gray-500 shrink-0">{def.totalHrs.toFixed(2)}h</span>
                <button
                  onClick={() => handleLibraryAddToBid(def)}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] shrink-0 transition-colors"
                >
                  + Add to Bid
                </button>
                <button
                  onClick={() => handleLibraryDelete(def)}
                  className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0"
                >
                  Delete
                </button>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
