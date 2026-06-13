'use client';

import { useState, useEffect, useRef } from 'react';
import { getRates, applyMarkup, type SavedAssembly, type AssemblyLine } from '@/lib/estimator/constants';
import { BOM, type BomItem } from '@/lib/estimator/bom';

// ── EditablePreview ─────────────────────────────────────────────────────────────
// Replaces the read-only preview table in calc-driven builders. Seeds editable
// line items from the live calc result, lets the user tweak/add/remove lines,
// and preserves manual edits until reset or (if isEdited) an acknowledged param
// change. "Save as Default" persists the edited lines to localStorage per builder.

interface EditablePreviewProps {
  assembly:      SavedAssembly | null;
  onAdd:         (asm: SavedAssembly) => void;
  storageKey:    string;            // e.g. 'rl_default_fa'
  addLabel?:     string;            // default "+ Add to Bid"
  onSaveDefault?: (asm: SavedAssembly) => void;
}

const CELL =
  'border border-transparent bg-transparent rounded px-1 py-0.5 text-xs' +
  ' focus:border-blue-300 focus:bg-white focus:outline-none w-full';

export function EditablePreview({
  assembly, onAdd, storageKey, addLabel = '+ Add to Bid', onSaveDefault,
}: EditablePreviewProps) {
  const R = getRates();

  const [editedLines, setEditedLines]       = useState<AssemblyLine[]>([]);
  const [isEdited, setIsEdited]             = useState(false);
  const [showParamWarning, setShowParamWarning] = useState(false);
  const [addLineName, setAddLineName]       = useState('');
  const [addLineMat,  setAddLineMat]        = useState('');
  const [addLineHrs,  setAddLineHrs]        = useState('');
  const [suggestions, setSuggestions]       = useState<BomItem[]>([]);
  const [savedMsg, setSavedMsg]             = useState<string | null>(null);

  const initRef = useRef(false);
  const prevSig = useRef<string>('');

  // ── Initial seed (once): prefer saved default, else the calc result ──────────
  useEffect(() => {
    if (initRef.current || !assembly) return;
    initRef.current = true;
    prevSig.current = JSON.stringify(assembly.lines);
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setEditedLines(JSON.parse(saved) as AssemblyLine[]);
        setIsEdited(true);
        return;
      } catch { /* fall through to calc seed */ }
    }
    setEditedLines([...assembly.lines]);
  }, [assembly, storageKey]);

  // ── Param change after init: reseed if untouched, else warn ──────────────────
  useEffect(() => {
    if (!initRef.current || !assembly) return;
    const sig = JSON.stringify(assembly.lines);
    if (sig === prevSig.current) return;
    prevSig.current = sig;
    if (isEdited) {
      setShowParamWarning(true);
    } else {
      setEditedLines([...assembly.lines]);
    }
  }, [assembly, isEdited]);

  if (!assembly) return null;

  const totalMat = editedLines.reduce((s, l) => s + (l.mat ?? 0), 0);
  const totalLab = editedLines.reduce((s, l) => s + (l.lab ?? 0), 0);

  function updateLine(i: number, field: 'name' | 'mat' | 'lab', value: string | number) {
    setEditedLines(prev => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
    setIsEdited(true);
  }
  function removeLine(i: number) {
    setEditedLines(prev => prev.filter((_, idx) => idx !== i));
    setIsEdited(true);
  }
  function handleAddLine() {
    setEditedLines(prev => [...prev, {
      name: addLineName.trim() || 'New Line',
      qty:  1,
      unit: 'EA',
      mat:  parseFloat(addLineMat) || 0,
      lab:  (parseFloat(addLineHrs) || 0) * R.labor,
    }]);
    setIsEdited(true);
    setAddLineName(''); setAddLineMat(''); setAddLineHrs(''); setSuggestions([]);
  }

  function buildAsm(): SavedAssembly {
    return {
      ...assembly!,
      lines:   editedLines,
      mat:     totalMat,
      lab:     totalLab,
      _edited: isEdited || undefined,
    };
  }

  function handleReset() {
    setEditedLines([...assembly!.lines]);
    setIsEdited(false);
    setShowParamWarning(false);
    prevSig.current = JSON.stringify(assembly!.lines);
  }

  function handleSaveDefault() {
    const asm = buildAsm();
    try { localStorage.setItem(storageKey, JSON.stringify(editedLines)); } catch { /* quota */ }
    onSaveDefault?.(asm);
    onAdd(asm);
    setSavedMsg('Saved as default for this assembly type');
    setTimeout(() => setSavedMsg(null), 2500);
  }

  return (
    <div className="border-t border-gray-100 pt-3">
      <p className="text-xs font-medium text-gray-500 mb-2">
        Preview: {assembly.label}
        {isEdited && <span className="ml-1.5 text-orange-500 font-bold" title="Manually edited">✎</span>}
      </p>

      {/* Param-change warning */}
      {showParamWarning && (
        <div className="flex flex-wrap items-center gap-2 bg-yellow-50 border border-yellow-300 rounded-lg px-3 py-2 mb-2 text-xs text-yellow-800">
          <span className="flex-1">Builder params changed. Reset preview to recalculate?</span>
          <button
            onClick={() => setShowParamWarning(false)}
            className="px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold"
          >Keep My Edits</button>
          <button
            onClick={handleReset}
            className="px-2 py-1 rounded bg-[#1e3a8a] text-white hover:bg-[#003d99] font-semibold"
          >Reset &amp; Recalculate</button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left py-1 font-medium pr-2">Item</th>
              <th className="text-right py-1 font-medium w-10">Qty</th>
              <th className="text-right py-1 font-medium w-10">Unit</th>
              <th className="text-right py-1 font-medium w-20">Mat $</th>
              <th className="text-right py-1 font-medium w-16">Hrs</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {editedLines.map((line, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-blue-50/40">
                <td className="py-0.5 pr-2">
                  <input
                    key={`n-${i}-${line.name}`}
                    type="text"
                    defaultValue={line.name}
                    onBlur={e => updateLine(i, 'name', e.target.value)}
                    className={CELL}
                  />
                </td>
                <td className="text-right py-0.5 text-gray-500 w-10">{line.qty}</td>
                <td className="text-right py-0.5 text-gray-400 w-10">{line.unit}</td>
                <td className="py-0.5 w-20">
                  <input
                    key={`m-${i}-${line.mat}`}
                    type="number"
                    step="0.01"
                    defaultValue={line.mat.toFixed(2)}
                    onBlur={e => updateLine(i, 'mat', parseFloat(e.target.value) || 0)}
                    className={`${CELL} text-right font-mono`}
                  />
                </td>
                <td className="py-0.5 w-16">
                  <input
                    key={`h-${i}-${line.lab}`}
                    type="number"
                    step="0.01"
                    defaultValue={(line.lab / R.labor).toFixed(2)}
                    onBlur={e => updateLine(i, 'lab', (parseFloat(e.target.value) || 0) * R.labor)}
                    className={`${CELL} text-right font-mono`}
                  />
                </td>
                <td className="py-0.5 text-right">
                  <button
                    onClick={() => removeLine(i)}
                    title="Remove line"
                    className="text-red-400 hover:text-red-600 text-xs px-0.5"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-gray-800 border-t border-gray-200">
              <td className="py-1" colSpan={3}>Total</td>
              <td className="text-right py-1 font-mono">${totalMat.toFixed(2)}</td>
              <td className="text-right py-1 font-mono">{(totalLab / R.labor).toFixed(2)} h</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add line */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <div className="flex-1 min-w-0 relative">
          <input
            type="text"
            placeholder="Search BOM or type item name..."
            value={addLineName}
            onChange={e => {
              setAddLineName(e.target.value);
              setSuggestions(
                e.target.value.length > 1
                  ? BOM.filter(b => b.name.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 6)
                  : []
              );
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 border border-gray-200 rounded mt-1 shadow-lg bg-white max-h-40 overflow-y-auto">
              {suggestions.map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setAddLineName(b.name);
                    setAddLineMat(applyMarkup(b.mat, b.mk).toFixed(2));
                    setAddLineHrs(String(b.lhr));
                    setSuggestions([]);
                  }}
                  className="px-3 py-1.5 text-xs hover:bg-blue-50 cursor-pointer flex justify-between"
                >
                  <span className="text-gray-700">{b.name}</span>
                  <span className="text-gray-400">${b.mat.toFixed(2)} · {b.lhr}hr</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <input
          type="number" placeholder="Mat $" value={addLineMat}
          onChange={e => setAddLineMat(e.target.value)}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
        />
        <input
          type="number" placeholder="Hrs" value={addLineHrs}
          onChange={e => setAddLineHrs(e.target.value)}
          className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#1e3a8a]"
        />
        <button
          onClick={handleAddLine}
          className="shrink-0 border border-[#1e3a8a] text-[#1e3a8a] rounded px-2 py-1 text-xs font-medium hover:bg-[#1e3a8a] hover:text-white transition-colors"
        >+ Add</button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => { onAdd(buildAsm()); setIsEdited(false); }}
          className="bg-[#1e3a8a] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
        >{addLabel}</button>
        <button
          onClick={handleSaveDefault}
          className="border border-[#1e3a8a] text-[#1e3a8a] px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
        >Save as Default</button>
        {isEdited && (
          <button
            onClick={handleReset}
            title="Discard edits and recalculate from params"
            className="border border-gray-300 text-gray-500 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors ml-auto"
          >↺ Reset</button>
        )}
        {savedMsg && <span className="text-xs text-green-600">✓ {savedMsg}</span>}
      </div>
    </div>
  );
}
