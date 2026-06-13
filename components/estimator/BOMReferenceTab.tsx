'use client';
import { fmt$ } from '@/lib/estimator/format';

import { useState, useMemo, useEffect } from 'react';
import { getRates, applyMarkup } from '@/lib/estimator/constants';
import type { SavedAssembly } from '@/lib/estimator/constants';
import type { BomItem } from '@/lib/estimator/bom';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';

// ── Format helper ──────────────────────────────────────────────────────────────


const PAGE_SIZE = 100;

// ── BOMReferenceTab ────────────────────────────────────────────────────────────

export function BOMReferenceTab({ isAdmin = false }: { isAdmin?: boolean }) {
  const R = getRates();
  const { state, addPrebuiltAssembly } = useEstimatorContext();

  const [items,      setItems]      = useState<BomItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('All Categories');
  const [unitFilter, setUnitFilter] = useState<'All' | 'EA' | 'FT'>('All');
  const [gcOnly,     setGcOnly]     = useState(false);
  const [page,       setPage]       = useState(0);

  // ── Add Item form (admin) ──────────────────────────────────────────────────
  const [newItem, setNewItem] = useState({
    id: '', name: '', cat: '', unit: 'EA', mat: 0, lhr: 0,
  });
  const [addingItem, setAddingItem] = useState(false);
  const [addError,   setAddError]   = useState('');

  // ── Quick Add to bid ───────────────────────────────────────────────────────
  const [quickAddId,      setQuickAddId]      = useState<string | null>(null);
  const [quickAddQty,     setQuickAddQty]     = useState(1);
  const [quickAddSuccess, setQuickAddSuccess] = useState<string | null>(null);

  // ── Inline edit (admin) ────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRow,   setEditRow]   = useState<{
    name: string; cat: string; unit: string; mat: number; lhr: number;
  } | null>(null);

  const handleSaveBomEdit = async (id: string) => {
    if (!editRow) return;
    try {
      const res = await fetch('/api/bom', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...editRow }),
      });
      if (!res.ok) throw new Error();
      const updated = await fetch('/api/bom');
      setItems(await updated.json());
      setEditingId(null);
      setEditRow(null);
    } catch {
      alert('Failed to save changes.');
    }
  };

  const handleDeleteBomItem = async (id: string) => {
    if (!window.confirm(`Delete BOM item "${id}"? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/bom', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      const updated = await fetch('/api/bom');
      setItems(await updated.json());
    } catch {
      alert('Failed to delete item.');
    }
  };

  const handleAddBomItem = async () => {
    if (!newItem.id.trim() || !newItem.name.trim() || !newItem.cat.trim()) {
      setAddError('ID, Name and Category are required.');
      return;
    }
    setAddingItem(true);
    setAddError('');
    try {
      const res = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newItem, id: newItem.id.trim() }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const updated = await fetch('/api/bom');
      setItems(await updated.json());
      setNewItem({ id: '', name: '', cat: '', unit: 'EA', mat: 0, lhr: 0 });
    } catch {
      setAddError('Failed to add item. Check that the ID is unique.');
    } finally {
      setAddingItem(false);
    }
  };

  const handleQuickAdd = (item: BomItem) => {
    const qty       = Math.max(1, quickAddQty);
    const matTotal  = applyMarkup(item.mat * qty, item.mk);
    const labTotal  = item.lhr * qty * R.labor;
    const asm: SavedAssembly = {
      label: `${item.name} x${qty}`,
      mat:   matTotal,
      lab:   labTotal,
      lines: [{ name: item.name, qty, unit: item.unit, mat: matTotal, lab: labTotal }],
      bidPackage: state.activeBidPackage || undefined,
      area:       state.activeArea       || undefined,
      costCode:   state.activeCostCode   || undefined,
    };
    addPrebuiltAssembly(asm);
    setQuickAddId(null);
    setQuickAddQty(1);
    setQuickAddSuccess(item.id);
    setTimeout(() => setQuickAddSuccess(null), 2000);
  };

  useEffect(() => {
    fetch('/api/bom')
      .then(r => r.json())
      .then((data: BomItem[]) => setItems(data))
      .catch(() => {/* keep empty */})
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() =>
    ['All Categories', ...Array.from(new Set(items.map(b => b.cat)))],
  [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter(item => {
      if (q && !item.id.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q)) return false;
      if (catFilter !== 'All Categories' && item.cat !== catFilter) return false;
      if (unitFilter !== 'All' && item.unit !== unitFilter) return false;
      if (gcOnly && !item.gc) return false;
      return true;
    });
  }, [items, search, catFilter, unitFilter, gcOnly]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function resetPage() { setPage(0); }

  const bulkPct  = (R.bulk  * 100).toFixed(1) + '%';
  const lightPct = (R.light * 100).toFixed(1) + '%';

  if (loading) {
    return (
      <div className="max-w-6xl flex items-center justify-center py-16 text-gray-400 text-sm">
        Loading BOM…
      </div>
    );
  }

  return (
    <div className="max-w-6xl">

      {/* Add BOM Item (admin only) */}
      {isAdmin && (
        <div className="border border-[#1e3a8a] rounded-lg p-4 mb-4 bg-blue-50">
          <h3 className="font-semibold text-sm text-[#1e3a8a] mb-3">+ Add BOM Item</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Item ID *</label>
              <input
                value={newItem.id}
                onChange={e => setNewItem(p => ({ ...p, id: e.target.value }))}
                placeholder="e.g. w_600cu"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name *</label>
              <input
                value={newItem.name}
                onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. 600kcmil THHN Cu"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category *</label>
              <input
                value={newItem.cat}
                onChange={e => setNewItem(p => ({ ...p, cat: e.target.value }))}
                placeholder="e.g. Wire & Cable"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unit *</label>
              <select
                value={newItem.unit}
                onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              >
                <option value="EA">EA</option>
                <option value="FT">FT</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Base $ *</label>
              <input
                type="number"
                step="0.01"
                value={newItem.mat}
                onChange={e => setNewItem(p => ({ ...p, mat: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Labor hrs *</label>
              <input
                type="number"
                step="0.001"
                value={newItem.lhr}
                onChange={e => setNewItem(p => ({ ...p, lhr: parseFloat(e.target.value) || 0 }))}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
          <p className="text-xs text-gray-500 mt-2">
            New items default to bulk markup, not GC-stocked. Use the Excel upload in Settings for those.
          </p>
          <button
            onClick={handleAddBomItem}
            disabled={addingItem}
            className="mt-3 px-4 py-2 bg-[#1e3a8a] text-white text-sm font-semibold rounded-lg hover:bg-blue-800 disabled:opacity-50"
          >
            {addingItem ? 'Saving...' : '+ Add to BOM'}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by ID or name…"
          value={search}
          onChange={e => { setSearch(e.target.value); resetPage(); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select
          value={catFilter}
          onChange={e => { setCatFilter(e.target.value); resetPage(); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select
          value={unitFilter}
          onChange={e => { setUnitFilter(e.target.value as 'All' | 'EA' | 'FT'); resetPage(); }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="All">All Units</option>
          <option value="EA">EA</option>
          <option value="FT">FT</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={gcOnly}
            onChange={e => { setGcOnly(e.target.checked); resetPage(); }}
            className="accent-[#1e3a8a]"
          />
          GC stocked only
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-white border-b border-gray-200 sticky top-0 z-10">
              <tr className="text-gray-500 font-semibold">
                <th className="text-left px-3 py-2 w-24">ID</th>
                <th className="text-left px-3 py-2 w-36">Category</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-center px-2 py-2 w-12">Unit</th>
                <th className="text-right px-3 py-2 w-20">Base $</th>
                <th className="text-center px-2 py-2 w-16">Markup</th>
                <th className="text-right px-3 py-2 w-24">Marked-Up $</th>
                <th className="text-right px-3 py-2 w-16">Labor hrs</th>
                <th className="text-center px-2 py-2 w-8">GC</th>
                <th className="text-left px-3 py-2 w-28">Add to Bid</th>
                {isAdmin && (
                  <th className="text-left px-3 py-2 w-32 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
                const mkLabel = item.mk === 'bulk'
                  ? bulkPct
                  : item.mk === 'light' ? lightPct : '—';

                if (isAdmin && editingId === item.id && editRow) {
                  return (
                    <tr key={item.id} className="bg-blue-50">
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono">{item.id}</td>
                      <td className="px-3 py-2">
                        <input value={editRow.cat}
                          onChange={e => setEditRow(p => ({ ...p!, cat: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-1 py-0.5 text-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={editRow.name}
                          onChange={e => setEditRow(p => ({ ...p!, name: e.target.value }))}
                          className="w-full border border-gray-300 rounded px-1 py-0.5 text-sm" />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select value={editRow.unit}
                          onChange={e => setEditRow(p => ({ ...p!, unit: e.target.value }))}
                          className="border border-gray-300 rounded px-1 py-0.5 text-sm bg-white">
                          <option value="EA">EA</option>
                          <option value="FT">FT</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.01" value={editRow.mat}
                          onChange={e => setEditRow(p => ({ ...p!, mat: parseFloat(e.target.value) || 0 }))}
                          className="w-20 border border-gray-300 rounded px-1 py-0.5 text-sm text-right" />
                      </td>
                      <td colSpan={3} />
                      <td className="px-3 py-2 text-right">
                        <input type="number" step="0.001" value={editRow.lhr}
                          onChange={e => setEditRow(p => ({ ...p!, lhr: parseFloat(e.target.value) || 0 }))}
                          className="w-20 border border-gray-300 rounded px-1 py-0.5 text-sm text-right" />
                      </td>
                      <td />
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => handleSaveBomEdit(item.id)}
                            className="px-2 py-1 text-xs bg-[#1e3a8a] text-white rounded hover:bg-blue-800">
                            Save
                          </button>
                          <button onClick={() => { setEditingId(null); setEditRow(null); }}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 font-mono text-gray-400 whitespace-nowrap">{item.id}</td>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{item.cat}</td>
                    <td className="px-3 py-1.5 text-gray-800">{item.name}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{item.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-500">{fmt$(item.mat)}</td>
                    <td className="px-2 py-1.5 text-center text-gray-400">{mkLabel}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium text-[#1e3a8a]">
                      {fmt$(applyMarkup(item.mat, item.mk))}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-500">
                      {item.lhr > 0 ? item.lhr.toFixed(3) + 'h' : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center text-green-600">
                      {item.gc ? '✓' : ''}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {quickAddSuccess === item.id ? (
                        <span className="text-green-600 text-xs font-semibold">✓ Added</span>
                      ) : quickAddId === item.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            value={quickAddQty}
                            onChange={e => setQuickAddQty(parseInt(e.target.value) || 1)}
                            className="w-14 border border-gray-300 rounded px-1 py-0.5 text-sm text-center"
                            autoFocus
                          />
                          <button
                            onClick={() => handleQuickAdd(item)}
                            className="px-2 py-0.5 bg-[#1e3a8a] text-white text-xs rounded hover:bg-blue-800"
                          >✓</button>
                          <button
                            onClick={() => { setQuickAddId(null); setQuickAddQty(1); }}
                            className="px-2 py-0.5 text-gray-400 text-xs hover:text-red-500"
                          >✕</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setQuickAddId(item.id); setQuickAddQty(1); }}
                          className="px-2 py-1 text-xs border border-[#1e3a8a] text-[#1e3a8a] rounded hover:bg-blue-50"
                        >+ Bid</button>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingId(item.id);
                              setEditRow({ name: item.name, cat: item.cat, unit: item.unit, mat: item.mat, lhr: item.lhr });
                            }}
                            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                          >Edit</button>
                          <button
                            onClick={() => handleDeleteBomItem(item.id)}
                            className="px-2 py-1 text-xs border border-red-200 text-red-500 rounded hover:bg-red-50"
                          >Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 11 : 10} className="px-3 py-8 text-center text-gray-400">
                    No items match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Showing {pageItems.length} of {filtered.length} items</span>
        {totalPages > 1 && (
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              ← Prev
            </button>
            <span>Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-40 hover:bg-gray-100 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
