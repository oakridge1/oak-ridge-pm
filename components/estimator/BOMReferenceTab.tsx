'use client';

import { useState, useMemo, useEffect } from 'react';
import { getRates, applyMarkup } from '@/lib/estimator/constants';
import type { BomItem } from '@/lib/estimator/bom';

// ── Format helper ──────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PAGE_SIZE = 100;

// ── BOMReferenceTab ────────────────────────────────────────────────────────────

export function BOMReferenceTab() {
  const R = getRates();

  const [items,      setItems]      = useState<BomItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('All Categories');
  const [unitFilter, setUnitFilter] = useState<'All' | 'EA' | 'FT'>('All');
  const [gcOnly,     setGcOnly]     = useState(false);
  const [page,       setPage]       = useState(0);

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
            className="accent-[#1a3a5c]"
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
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, i) => {
                const mkLabel = item.mk === 'bulk'
                  ? bulkPct
                  : item.mk === 'light' ? lightPct : '—';
                return (
                  <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 font-mono text-gray-400 whitespace-nowrap">{item.id}</td>
                    <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{item.cat}</td>
                    <td className="px-3 py-1.5 text-gray-800">{item.name}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{item.unit}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-500">{fmt$(item.mat)}</td>
                    <td className="px-2 py-1.5 text-center text-gray-400">{mkLabel}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium text-[#1a3a5c]">
                      {fmt$(applyMarkup(item.mat, item.mk))}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-500">
                      {item.lhr > 0 ? item.lhr.toFixed(3) + 'h' : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center text-green-600">
                      {item.gc ? '✓' : ''}
                    </td>
                  </tr>
                );
              })}
              {pageItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
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
