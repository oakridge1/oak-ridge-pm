'use client';

import { useState, useEffect, useRef } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import {
  getLightingSchedule,
  addLightingItem,
  updateLightingItem,
  deleteLightingItem,
} from '@/app/(app)/jobs/[id]/tabs/schedule-actions';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupplierContact {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  pickupOnly: boolean;
  contacts: SupplierContact[];
}

interface ScheduleItem {
  id:          string;
  typeLabel:   string;
  description: string;
  qty:         number;
  quotedPrice: number | null;
  markup:      number;
  quoteStatus: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── LightingScheduleTab ───────────────────────────────────────────────────────

export function LightingScheduleTab() {
  const { state } = useEstimatorContext();

  // ── Item state ────────────────────────────────────────────────────────────
  const [items,          setItems]          = useState<ScheduleItem[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showAddForm,    setShowAddForm]    = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [editingId,      setEditingId]      = useState<string | null>(null);

  // ── Add form ──────────────────────────────────────────────────────────────
  const [newType, setNewType] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // ── Quote modal ───────────────────────────────────────────────────────────
  const [suppliers,       setSuppliers]       = useState<Supplier[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [ccEmails,        setCcEmails]        = useState<string[]>([]);
  const [quoteNotes,      setQuoteNotes]      = useState('');
  const [attachments,     setAttachments]     = useState<File[]>([]);
  const [sending,         setSending]         = useState(false);
  const [sendResult,      setSendResult]      = useState<string | null>(null);

  const drawingInputRef = useRef<HTMLInputElement>(null);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.jobId) return;
    setLoading(true);
    getLightingSchedule(state.jobId)
      .then(data => {
        setItems(data.map(d => ({
          id:          d.id,
          typeLabel:   d.typeLabel   ?? '',
          description: d.description ?? '',
          qty:         d.qty,
          quotedPrice: d.quotedPrice ?? null,
          markup:      d.markup,
          quoteStatus: d.quoteStatus ?? 'PENDING',
        })));
      })
      .catch(() => {/* network error — keep empty */})
      .finally(() => setLoading(false));

    fetch('/api/admin/suppliers')
      .then(r => r.json())
      .then(setSuppliers)
      .catch(console.error);
  }, [state.jobId]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalQuotedCost = items.reduce((sum, item) => {
    if (!item.quotedPrice || !item.qty) return sum;
    return sum + item.quotedPrice * item.qty * (1 + item.markup);
  }, 0);
  const itemsWithQty = items.filter(i => i.qty > 0);
  const itemsQuoted  = items.filter(i => i.quotedPrice !== null && i.quotedPrice > 0);
  const quoteSuppliers = suppliers.filter(s => !s.pickupOnly && s.email);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!newType.trim() || !newDesc.trim() || !state.jobId) return;
    try {
      const item = await addLightingItem(state.jobId, {
        typeLabel:   newType.trim(),
        description: newDesc.trim(),
        qty:         0,
      });
      setItems(prev => [...prev, {
        id:          item.id,
        typeLabel:   item.typeLabel   ?? newType.trim(),
        description: item.description ?? newDesc.trim(),
        qty:         item.qty,
        quotedPrice: item.quotedPrice ?? null,
        markup:      item.markup,
        quoteStatus: 'PENDING',
      }]);
      setNewType('');
      setNewDesc('');
      // Keep form open for rapid entry
    } catch {
      alert('Failed to add fixture. Is this job saved to the PM system?');
    }
  }

  async function handleQtyBlur(id: string, qty: number) {
    await updateLightingItem(id, { qty }).catch(console.error);
  }

  async function handlePriceBlur(id: string, raw: string) {
    const v = parseFloat(raw);
    const quotedPrice = isNaN(v) || v <= 0 ? null : v;
    const quoteStatus = quotedPrice ? 'RECEIVED' : (items.find(i => i.id === id)?.quoteStatus ?? 'PENDING');
    setItems(prev => prev.map(i => i.id === id ? { ...i, quotedPrice, quoteStatus } : i));
    await updateLightingItem(id, { quotedPrice, quoteStatus }).catch(console.error);
  }

  async function handleMarkupBlur(id: string, raw: string) {
    const pct    = parseFloat(raw);
    const markup = isNaN(pct) ? 0.05 : Math.max(0, pct) / 100;
    setItems(prev => prev.map(i => i.id === id ? { ...i, markup } : i));
    await updateLightingItem(id, { markup }).catch(console.error);
  }

  async function handleLabelBlur(id: string, field: 'typeLabel' | 'description', value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    await updateLightingItem(id, { [field]: value }).catch(console.error);
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this fixture type?')) return;
    await deleteLightingItem(id).catch(console.error);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function toggleVendor(name: string) {
    setSelectedVendors(prev =>
      prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]
    );
  }

  function toggleCcEmail(email: string) {
    setCcEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  }

  async function handleSendQuotes() {
    if (attachments.length === 0) {
      const proceed = window.confirm(
        'No drawings attached.\n\n' +
        'Vendors may not be able to quote accurately without the project drawings.\n\n' +
        'Send quote request without drawings?'
      );
      if (!proceed) return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const quoteItems = itemsWithQty.map(i => ({
        typeLabel:   i.typeLabel,
        description: i.description,
        qty:         i.qty,
      }));

      for (const vendorName of selectedVendors) {
        const supplier = suppliers.find(s => s.name === vendorName);
        if (!supplier?.email) continue;

        const fd = new FormData();
        fd.append('jobId',       state.jobId);
        fd.append('jobNumber',   state.jobNumber);
        fd.append('jobName',     state.jobName);
        fd.append('vendorName',  vendorName);
        fd.append('vendorEmail', supplier.email);
        fd.append('items',       JSON.stringify(quoteItems));
        fd.append('notes',       quoteNotes);
        fd.append('ccEmails',    JSON.stringify(ccEmails));
        attachments.forEach(file => fd.append('drawings', file));

        await fetch('/api/jobs/lighting-quote', { method: 'POST', body: fd });
      }

      setSendResult(
        `✓ Quote request sent to ${selectedVendors.length} vendor${selectedVendors.length !== 1 ? 's' : ''}`
      );
      setShowQuoteModal(false);
      setSelectedVendors([]);
      setAttachments([]);
      setQuoteNotes('');

      // Refresh to show QUOTED status
      const fresh = await getLightingSchedule(state.jobId);
      setItems(fresh.map(d => ({
        id:          d.id,
        typeLabel:   d.typeLabel   ?? '',
        description: d.description ?? '',
        qty:         d.qty,
        quotedPrice: d.quotedPrice ?? null,
        markup:      d.markup,
        quoteStatus: d.quoteStatus ?? 'PENDING',
      })));
    } catch (err) {
      setSendResult('✗ Failed to send — check console');
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="max-w-6xl">

      {/* ── HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#1a3a5c]">Lighting Schedule</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {items.length} fixture types
            {' · '}{itemsWithQty.length} with counts
            {' · '}{itemsQuoted.length} quoted
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="px-4 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors"
          >
            + Add Fixture Type
          </button>
          <button
            onClick={() => { setShowQuoteModal(true); setSendResult(null); }}
            disabled={itemsWithQty.length === 0}
            className="px-4 py-2 text-sm font-semibold rounded border-2 border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            📧 Request Quotes
          </button>
        </div>
      </div>

      {/* ── QUOTED TOTAL BAR ─────────────────────────────────────────────────── */}
      {itemsQuoted.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between text-sm">
          <span className="text-green-700">Quoted total (with markup)</span>
          <span className="font-bold text-lg font-mono text-green-800">{fmt$(totalQuotedCost)}</span>
        </div>
      )}

      {/* ── SEND RESULT BANNER ───────────────────────────────────────────────── */}
      {sendResult && (
        <div className={`rounded-lg px-4 py-2.5 mb-4 text-sm font-medium flex items-center justify-between ${
          sendResult.startsWith('✓')
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          <span>{sendResult}</span>
          <button onClick={() => setSendResult(null)} className="opacity-50 hover:opacity-100 ml-4">✕</button>
        </div>
      )}

      {/* ── ADD FIXTURE FORM ─────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-bold text-[#1a3a5c] mb-3">Add Fixture Type</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600">Type Label *</label>
              <input
                type="text"
                value={newType}
                onChange={e => setNewType(e.target.value)}
                placeholder="e.g. Type A"
                className="border border-gray-300 rounded px-3 py-2 text-sm w-28 focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs font-semibold text-gray-600">Name as on Plans *</label>
              <input
                type="text"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="e.g. 2x4 LED Emergency w/ Battery"
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full focus:outline-none focus:border-blue-400"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newType.trim() || !newDesc.trim()}
              className="px-4 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewType(''); setNewDesc(''); }}
              className="px-3 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ──────────────────────────────────────────────────────── */}
      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500 text-sm font-medium mb-1">No fixture types added yet.</p>
          <p className="text-gray-400 text-xs mb-5">
            Add fixture types from the drawing schedule, then count them on the PDF drawings.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors"
          >
            + Add First Fixture Type
          </button>
        </div>
      ) : (

        /* ── FIXTURE TABLE ─────────────────────────────────────────────────── */
        <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 w-28">Type</th>
                  <th className="text-left px-4 py-3">Name as on Plans</th>
                  <th className="text-center px-3 py-3 w-20">Count</th>
                  <th className="text-right px-3 py-3 w-32">Quoted / Unit</th>
                  <th className="text-center px-3 py-3 w-20">Markup</th>
                  <th className="text-right px-4 py-3 w-32">Extended Cost</th>
                  <th className="text-center px-3 py-3 w-24">Status</th>
                  <th className="text-center px-3 py-3 w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => {
                  const extended = item.quotedPrice && item.qty
                    ? item.quotedPrice * item.qty * (1 + item.markup)
                    : null;
                  const isEditing = editingId === item.id;
                  const statusCls =
                    item.quotedPrice   ? 'bg-green-100 text-green-700' :
                    item.quoteStatus === 'QUOTED' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500';
                  const statusLabel =
                    item.quotedPrice   ? '✓ Priced' :
                    item.quoteStatus === 'QUOTED' ? 'Quote Sent' :
                    'Pending';

                  return (
                    <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>

                      {/* TYPE LABEL */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={item.typeLabel}
                            onBlur={e => handleLabelBlur(item.id, 'typeLabel', e.target.value.trim())}
                            className="w-full border border-blue-300 rounded px-2 py-1 text-sm font-bold text-[#1a3a5c] focus:outline-none focus:ring-1 focus:ring-blue-400"
                            autoFocus
                          />
                        ) : (
                          <span className="font-bold text-[#1a3a5c]">{item.typeLabel}</span>
                        )}
                      </td>

                      {/* DESCRIPTION */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input
                            type="text"
                            defaultValue={item.description}
                            onBlur={e => handleLabelBlur(item.id, 'description', e.target.value.trim())}
                            className="w-full border border-blue-300 rounded px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        ) : (
                          <span className="text-gray-600">{item.description}</span>
                        )}
                      </td>

                      {/* COUNT */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          value={item.qty}
                          min={0}
                          step={1}
                          onChange={e => {
                            const v = Math.max(0, parseInt(e.target.value) || 0);
                            setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty: v } : i));
                          }}
                          onBlur={e => handleQtyBlur(item.id, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 text-center border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-400"
                        />
                      </td>

                      {/* QUOTED PRICE */}
                      <td className="px-3 py-2.5 text-right">
                        {isEditing || item.quotedPrice !== null ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-gray-400 text-xs">$</span>
                            <input
                              type="number"
                              defaultValue={item.quotedPrice ?? ''}
                              placeholder="0.00"
                              min={0}
                              step={0.01}
                              onBlur={e => handlePriceBlur(item.id, e.target.value)}
                              className="w-20 text-right border border-gray-200 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-blue-400"
                            />
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">— Pending</span>
                        )}
                      </td>

                      {/* MARKUP */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <input
                            type="number"
                            defaultValue={Math.round(item.markup * 100)}
                            min={0}
                            max={100}
                            step={1}
                            onBlur={e => handleMarkupBlur(item.id, e.target.value)}
                            className="w-14 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                          />
                          <span className="text-gray-400 text-xs">%</span>
                        </div>
                      </td>

                      {/* EXTENDED COST */}
                      <td className="px-4 py-2.5 text-right font-mono font-bold">
                        {extended !== null
                          ? <span className="text-[#1a3a5c]">{fmt$(extended)}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* STATUS */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${statusCls}`}>
                          {statusLabel}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingId(isEditing ? null : item.id)}
                            title={isEditing ? 'Done editing' : 'Edit'}
                            className={`p-1 rounded text-sm transition-colors ${
                              isEditing
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            title="Delete"
                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors text-sm"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* TABLE FOOTER */}
              {itemsQuoted.length > 0 && (
                <tfoot>
                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                    <td colSpan={5} className="px-4 py-3 text-sm font-bold text-[#1a3a5c]">
                      Total Lighting Cost (with markup)
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#1a3a5c]">
                      {fmt$(totalQuotedCost)}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── QUOTE REQUEST MODAL ──────────────────────────────────────────────── */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-[#1a3a5c]">
                Send Lighting Fixture Quote Request
              </h2>
              <button
                onClick={() => setShowQuoteModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Section 1: Fixture summary */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  Fixture Summary (qty &gt; 0 only)
                </h3>
                {itemsWithQty.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    No fixtures with counts. Enter counts in the schedule first.
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr className="text-gray-500 font-semibold">
                          <th className="text-left px-3 py-2 w-24">Type</th>
                          <th className="text-left px-3 py-2">Name</th>
                          <th className="text-center px-3 py-2 w-16">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {itemsWithQty.map(i => (
                          <tr key={i.id}>
                            <td className="px-3 py-2 font-bold text-[#1a3a5c]">{i.typeLabel}</td>
                            <td className="px-3 py-2 text-gray-600">{i.description}</td>
                            <td className="px-3 py-2 text-center font-mono font-bold">{i.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section 2: Drawings */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  Project Drawings
                </h3>
                <input
                  type="file"
                  accept=".pdf,.dwg,.dwf"
                  multiple
                  ref={drawingInputRef}
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    setAttachments(prev => {
                      const existing = new Set(prev.map(f => f.name));
                      return [...prev, ...files.filter(f => !existing.has(f.name))];
                    });
                    e.target.value = '';
                  }}
                />
                {attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {attachments.map(f => (
                      <span
                        key={f.name}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                      >
                        📎 {f.name}
                        <button
                          onClick={() => setAttachments(prev => prev.filter(a => a.name !== f.name))}
                          className="ml-0.5 text-gray-400 hover:text-gray-700 leading-none"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-3 text-xs text-amber-700">
                    ⚠ No drawings attached. Vendors may not be able to quote accurately.
                  </div>
                )}
                <button
                  onClick={() => drawingInputRef.current?.click()}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Attach Drawings
                </button>
              </div>

              {/* Section 3: Vendors */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                  Send To
                </h3>
                {quoteSuppliers.length === 0 ? (
                  <p className="text-sm text-gray-400">
                    No suppliers with email addresses configured.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {quoteSuppliers.map(s => (
                      <div key={s.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={selectedVendors.includes(s.name)}
                            onChange={() => toggleVendor(s.name)}
                            className="accent-[#1a3a5c] w-4 h-4 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-gray-800">{s.name}</span>
                            {s.email && (
                              <span className="ml-2 text-xs text-gray-400 truncate">{s.email}</span>
                            )}
                          </div>
                        </label>

                        {/* Contact CC options (shown when vendor selected) */}
                        {selectedVendors.includes(s.name) && s.contacts.length > 0 && (
                          <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                            <p className="text-xs text-gray-400 mb-2 mt-1 uppercase tracking-wide">CC contacts:</p>
                            <div className="flex flex-wrap gap-3">
                              {s.contacts.map(c => (
                                <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={ccEmails.includes(c.email)}
                                    onChange={() => toggleCcEmail(c.email)}
                                    className="accent-[#1a3a5c]"
                                  />
                                  <span className="text-gray-700">{c.name}</span>
                                  <span className="text-gray-400">({c.email})</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    Notes for Vendors
                  </label>
                  <textarea
                    value={quoteNotes}
                    onChange={e => setQuoteNotes(e.target.value)}
                    placeholder="Any special instructions for vendors…"
                    rows={3}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendQuotes}
                disabled={selectedVendors.length === 0 || sending}
                className="px-5 py-2 text-sm font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {sending
                  ? '⏳ Sending…'
                  : `Send to ${selectedVendors.length} Vendor${selectedVendors.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
