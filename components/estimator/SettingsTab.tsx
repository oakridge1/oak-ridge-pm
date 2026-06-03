'use client';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { DEFAULTS } from '@/lib/estimator/constants';
import type { RateConfig } from '@/lib/estimator/constants';
import { BOM } from '@/lib/estimator/bom';

// ── Format helper ──────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

// ── Customer type ─────────────────────────────────────────────────────────────

interface SavedCustomer {
  id:          string;
  company:     string;
  contactName: string;
  phone:       string;
  email:       string;
  type:        'GC' | 'Owner' | 'Other';
}

// ── Rate field definitions ─────────────────────────────────────────────────────

interface RateField {
  key:       keyof RateConfig;
  label:     string;
  isPercent: boolean;
  step:      string;
  min:       number;
}

const RATE_FIELDS: RateField[] = [
  { key: 'labor',    label: 'Labor Rate ($/hr)',        isPercent: false, step: '0.50',  min: 0    },
  { key: 'bulk',     label: 'Bulk Material Markup (%)', isPercent: true,  step: '0.5',   min: 0    },
  { key: 'light',    label: 'Light/Gear Markup (%)',    isPercent: true,  step: '0.5',   min: 0    },
  { key: 'permit',   label: 'Permit Markup (%)',        isPercent: true,  step: '0.5',   min: 0    },
  { key: 'sub',      label: 'Sub Markup (%)',           isPercent: true,  step: '0.5',   min: 0    },
  { key: 'overhead', label: 'Overhead on Labor (%)',    isPercent: true,  step: '0.5',   min: 0    },
  { key: 'profit',   label: 'Profit on Subtotal (%)',   isPercent: true,  step: '0.5',   min: 0    },
];

const BOM_PAGE = 50;

// ── Shared className constants ─────────────────────────────────────────────────

const CLS = {
  sectionCard:  'bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm',
  sectionTitle: 'text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3',
  fieldRow:     'flex items-center justify-between py-2 border-b border-gray-100 last:border-0',
  label:        'text-sm text-gray-700',
  inputAmt:     'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-28 text-right font-mono',
  inputText:    'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white flex-1 min-w-[200px]',
};

// ── SettingsTab ────────────────────────────────────────────────────────────────

export function SettingsTab() {
  const {
    state, setState, updateSettings,
    priceOverrides, setPriceOverride, clearPriceOverride,
  } = useEstimatorContext();

  const [bomSearch, setBomSearch] = useState('');

  // ── Customer library state ──────────────────────────────────────────────
  const [customers, setCustomers] = useState<SavedCustomer[]>(() => {
    try { return JSON.parse(localStorage.getItem('ore_customers') ?? '[]'); }
    catch { return []; }
  });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch,    setCustomerSearch]    = useState('');
  const [editingCustomer,   setEditingCustomer]   = useState<SavedCustomer | null>(null);

  // ── Customer helpers ────────────────────────────────────────────────────
  function saveCustomers(list: SavedCustomer[]) {
    setCustomers(list);
    localStorage.setItem('ore_customers', JSON.stringify(list));
  }

  function saveCustomer(c: SavedCustomer) {
    const idx = customers.findIndex(x => x.id === c.id);
    if (idx >= 0) {
      const updated = [...customers];
      updated[idx] = c;
      saveCustomers(updated);
    } else {
      saveCustomers([...customers, c]);
    }
    setEditingCustomer(null);
  }

  function deleteCustomer(id: string) {
    if (!window.confirm('Delete this customer?')) return;
    saveCustomers(customers.filter(c => c.id !== id));
  }

  function applyCustomer(c: SavedCustomer) {
    if (c.type === 'GC') {
      setState(s => ({
        ...s,
        jobInfo: {
          ...s.jobInfo,
          gcCompany:     c.company,
          gcContactName: c.contactName,
          gcPhone:       c.phone,
          gcEmail:       c.email,
        },
      }));
    } else if (c.type === 'Owner') {
      setState(s => ({
        ...s,
        jobInfo: {
          ...s.jobInfo,
          ownerName:  c.company,
          ownerPhone: c.phone,
          ownerEmail: c.email,
        },
      }));
    }
    setShowCustomerModal(false);
  }

  // ── BOM price editor filter ─────────────────────────────────────────────
  const allFiltered = BOM.filter(item => {
    if (!bomSearch) return true;
    const q = bomSearch.toLowerCase();
    return item.id.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  });
  const filteredBom = allFiltered.slice(0, BOM_PAGE);
  const totalFiltered = allFiltered.length;

  // ── Rate field helpers ──────────────────────────────────────────────────
  function getDisplayValue(field: RateField): string {
    const raw = state.settings[field.key] as number;
    return field.isPercent
      ? (raw * 100).toFixed(1)
      : raw.toFixed(2);
  }

  function handleRateChange(field: RateField, rawInput: string) {
    const parsed = parseFloat(rawInput);
    if (isNaN(parsed)) return;
    const storeVal = field.isPercent ? parsed / 100 : parsed;
    updateSettings({ [field.key]: storeVal } as Partial<RateConfig>);
  }

  return (
    <div className="max-w-2xl">

      {/* ── JOB INFORMATION ──────────────────────────────────────────────────── */}
      <div className={CLS.sectionCard}>
        <div className={CLS.sectionTitle}>Job Information</div>

        {/* Basic Info */}
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mt-0 mb-2">Basic Info</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Job Name *</label>
            <input
              key={state.jobId + '-jobName'}
              type="text"
              defaultValue={state.jobName}
              onBlur={e => setState(s => ({ ...s, jobName: e.target.value }))}
              placeholder="e.g. Main Street Office"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Job Number *</label>
            <input
              key={state.jobId + '-jobNumber'}
              type="text"
              defaultValue={state.jobNumber}
              onBlur={e => setState(s => ({ ...s, jobNumber: e.target.value }))}
              placeholder="e.g. 2024-042"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
        </div>

        {/* Site Address */}
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mt-4 mb-2">Site Address</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Street Address</label>
            <input
              key={state.jobId + '-address'}
              type="text"
              defaultValue={state.jobInfo.address}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, address: e.target.value } }))}
              placeholder="123 Main St"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">City</label>
            <input
              key={state.jobId + '-city'}
              type="text"
              defaultValue={state.jobInfo.city}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, city: e.target.value } }))}
              placeholder="Oak Ridge"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">State</label>
              <input
                key={state.jobId + '-state'}
                type="text"
                defaultValue={state.jobInfo.state}
                onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, state: e.target.value } }))}
                placeholder="TN"
                maxLength={2}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full uppercase"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ZIP</label>
              <input
                key={state.jobId + '-zip'}
                type="text"
                defaultValue={state.jobInfo.zip}
                onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, zip: e.target.value } }))}
                placeholder="37830"
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
              />
            </div>
          </div>
        </div>

        {/* General Contractor */}
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mt-4 mb-2">General Contractor</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">GC Company</label>
            <input
              key={state.jobId + '-gcCompany'}
              type="text"
              defaultValue={state.jobInfo.gcCompany}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, gcCompany: e.target.value } }))}
              placeholder="ABC Construction"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">GC Contact</label>
            <input
              key={state.jobId + '-gcContactName'}
              type="text"
              defaultValue={state.jobInfo.gcContactName}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, gcContactName: e.target.value } }))}
              placeholder="John Smith"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">GC Phone</label>
            <input
              key={state.jobId + '-gcPhone'}
              type="text"
              defaultValue={state.jobInfo.gcPhone}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, gcPhone: e.target.value } }))}
              placeholder="(865) 555-0100"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">GC Email</label>
            <input
              key={state.jobId + '-gcEmail'}
              type="email"
              defaultValue={state.jobInfo.gcEmail}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, gcEmail: e.target.value } }))}
              placeholder="jsmith@abcconstruction.com"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingCustomer({
              id: crypto.randomUUID(),
              company:     state.jobInfo.gcCompany     || '',
              contactName: state.jobInfo.gcContactName || '',
              phone:       state.jobInfo.gcPhone       || '',
              email:       state.jobInfo.gcEmail       || '',
              type: 'GC',
            });
            setShowCustomerModal(true);
          }}
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"
        >⭐ Save GC as customer</button>

        {/* Owner */}
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mt-4 mb-2">Owner</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Owner Name</label>
            <input
              key={state.jobId + '-ownerName'}
              type="text"
              defaultValue={state.jobInfo.ownerName}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, ownerName: e.target.value } }))}
              placeholder="Property Owner LLC"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Owner Phone</label>
            <input
              key={state.jobId + '-ownerPhone'}
              type="text"
              defaultValue={state.jobInfo.ownerPhone}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, ownerPhone: e.target.value } }))}
              placeholder="(865) 555-0200"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Owner Email</label>
            <input
              key={state.jobId + '-ownerEmail'}
              type="email"
              defaultValue={state.jobInfo.ownerEmail}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, ownerEmail: e.target.value } }))}
              placeholder="owner@example.com"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setEditingCustomer({
              id: crypto.randomUUID(),
              company:     state.jobInfo.ownerName  || '',
              contactName: '',
              phone:       state.jobInfo.ownerPhone || '',
              email:       state.jobInfo.ownerEmail || '',
              type: 'Owner',
            });
            setShowCustomerModal(true);
          }}
          className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 mt-1"
        >⭐ Save Owner as customer</button>

        {/* Schedule & Permits */}
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mt-4 mb-2">Schedule &amp; Permits</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contract Start</label>
            <input
              key={state.jobId + '-contractStartDate'}
              type="date"
              defaultValue={state.jobInfo.contractStartDate}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, contractStartDate: e.target.value } }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Completion Date</label>
            <input
              key={state.jobId + '-completionDate'}
              type="date"
              defaultValue={state.jobInfo.completionDate}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, completionDate: e.target.value } }))}
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Permit Number</label>
            <input
              key={state.jobId + '-permitNumber'}
              type="text"
              defaultValue={state.jobInfo.permitNumber}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, permitNumber: e.target.value } }))}
              placeholder="ELEC-2024-001"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Inspection Contact</label>
            <input
              key={state.jobId + '-inspectionContact'}
              type="text"
              defaultValue={state.jobInfo.inspectionContact}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, inspectionContact: e.target.value } }))}
              placeholder="Inspector Name"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Inspection Phone</label>
            <input
              key={state.jobId + '-inspectionPhone'}
              type="text"
              defaultValue={state.jobInfo.inspectionPhone}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, inspectionPhone: e.target.value } }))}
              placeholder="(865) 555-0300"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Contract Value ($)</label>
            <input
              key={state.jobId + '-contractValue'}
              type="number"
              min={0}
              step="0.01"
              defaultValue={state.jobInfo.contractValue || ''}
              onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, contractValue: parseFloat(e.target.value) || 0 } }))}
              placeholder="0.00"
              className="border border-gray-300 rounded px-3 py-2 text-sm w-full font-mono"
            />
          </div>
        </div>

        {/* Scope of Work */}
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mt-4 mb-2">Scope of Work</p>
        <textarea
          key={state.jobId + '-scopeOfWork'}
          rows={4}
          defaultValue={state.jobInfo.scopeOfWork}
          onBlur={e => setState(s => ({ ...s, jobInfo: { ...s.jobInfo, scopeOfWork: e.target.value } }))}
          placeholder="Describe the scope of work..."
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
        />
      </div>

      {/* ── CUSTOMERS ────────────────────────────────────────────────────────── */}
      <div className={CLS.sectionCard}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={CLS.sectionTitle} style={{ marginBottom: 0, borderBottom: 'none' }}>Customers</h3>
          <button
            onClick={() => {
              setEditingCustomer({ id: crypto.randomUUID(), company: '', contactName: '', phone: '', email: '', type: 'GC' });
              setShowCustomerModal(true);
            }}
            className="px-3 py-1 text-xs font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c]"
          >+ New Customer</button>
        </div>
        <div className={CLS.sectionTitle} />

        <input
          type="text"
          placeholder="Search customers..."
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm mb-3"
        />

        {customers.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No saved customers yet. Add your first one above.
          </div>
        ) : (
          <div className="space-y-1">
            {customers
              .filter(c =>
                !customerSearch ||
                c.company.toLowerCase().includes(customerSearch.toLowerCase()) ||
                c.contactName.toLowerCase().includes(customerSearch.toLowerCase())
              )
              .map(c => (
                <div key={c.id} className="flex items-center gap-2 py-2 px-3 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800 truncate">{c.company}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {c.contactName}{c.phone ? ` · ${c.phone}` : ''}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap ${
                    c.type === 'GC'    ? 'bg-blue-100 text-blue-700'
                    : c.type === 'Owner' ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                  }`}>{c.type}</span>
                  <button onClick={() => applyCustomer(c)} className="text-xs px-2 py-1 rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] whitespace-nowrap">Apply</button>
                  <button onClick={() => { setEditingCustomer(c); setShowCustomerModal(true); }} className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 whitespace-nowrap">Edit</button>
                  <button onClick={() => deleteCustomer(c.id)} className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 whitespace-nowrap">✕</button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── RATE SETTINGS ────────────────────────────────────────────────────── */}
      <div className={CLS.sectionCard}>
        <div className={CLS.sectionTitle}>Rate Settings</div>

        {RATE_FIELDS.map(field => (
          <div key={field.key} className={CLS.fieldRow}>
            <span className={CLS.label}>{field.label}</span>
            <div className="flex items-center gap-2">
              {field.isPercent && (
                <span className="text-xs text-gray-400">%</span>
              )}
              {!field.isPercent && (
                <span className="text-xs text-gray-400">$</span>
              )}
              <input
                type="number"
                min={field.min}
                step={field.step}
                value={getDisplayValue(field)}
                onChange={e => handleRateChange(field, e.target.value)}
                className={CLS.inputAmt}
              />
            </div>
          </div>
        ))}

        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            NECA base · Oak Ridge defaults
          </span>
          <button
            onClick={() => updateSettings({ ...DEFAULTS })}
            className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            ↺ Reset to Defaults
          </button>
        </div>
      </div>

      {/* ── BOM PRICE EDITOR ─────────────────────────────────────────────────── */}
      <div className={CLS.sectionCard + ' max-w-full'}>
        <div className={CLS.sectionTitle}>BOM Price Editor</div>
        <p className="text-xs text-gray-500 mb-3">
          Override individual item prices. Changes apply immediately to all new assemblies.
        </p>

        <input
          type="text"
          placeholder="Search by ID or name…"
          value={bomSearch}
          onChange={e => setBomSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm w-full mb-3"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 font-semibold border-b border-gray-200">
                <th className="text-left pb-1.5 pr-2 w-20">ID</th>
                <th className="text-left pb-1.5 pr-2 w-32">Category</th>
                <th className="text-left pb-1.5 pr-2">Name</th>
                <th className="text-center pb-1.5 w-10">Unit</th>
                <th className="text-right pb-1.5 w-20">Base $</th>
                <th className="text-right pb-1.5 w-36">Override $</th>
              </tr>
            </thead>
            <tbody>
              {filteredBom.map((item, i) => {
                const overridden = priceOverrides[item.id] !== undefined;
                const dispVal    = overridden
                  ? (priceOverrides[item.id] as number)
                  : item.mat;
                return (
                  <tr key={item.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="py-1 pr-2 font-mono text-gray-400 whitespace-nowrap">
                      {item.id}
                    </td>
                    <td className="py-1 pr-2 text-gray-500 whitespace-nowrap">{item.cat}</td>
                    <td className="py-1 pr-2 text-gray-800">{item.name}</td>
                    <td className="py-1 text-center text-gray-500">{item.unit}</td>
                    <td className="py-1 text-right font-mono text-gray-500">
                      {fmt$(item.mat)}
                    </td>
                    <td className="py-1 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          key={`${item.id}-${priceOverrides[item.id] ?? 'def'}`}
                          type="number"
                          step="0.0001"
                          min={0}
                          defaultValue={dispVal.toFixed(4)}
                          onBlur={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && Math.abs(v - item.mat) > 0.0001) {
                              setPriceOverride(item.id, v);
                            } else {
                              clearPriceOverride(item.id);
                            }
                          }}
                          className={`border rounded px-1.5 py-0.5 text-xs text-right font-mono w-24 focus:outline-none ${
                            overridden
                              ? 'bg-blue-50 border-blue-300 focus:border-blue-400'
                              : 'border-gray-300 bg-white focus:border-blue-300'
                          }`}
                        />
                        {overridden && (
                          <button
                            onClick={() => clearPriceOverride(item.id)}
                            title="Clear override"
                            className="text-blue-400 hover:text-blue-600 font-bold text-sm leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-xs text-gray-400">
          Showing {filteredBom.length} of {totalFiltered} items
          {totalFiltered > BOM_PAGE && ` — refine search to see more`}
        </p>
      </div>

      {/* ── CUSTOMER EDIT MODAL ───────────────────────────────────────────────── */}
      {showCustomerModal && editingCustomer && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCustomerModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#1a3a5c]">
                {customers.some(c => c.id === editingCustomer.id) ? 'Edit Customer' : 'New Customer'}
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >✕</button>
            </div>

            {/* Type toggle */}
            <div className="flex gap-1 mb-4">
              {(['GC', 'Owner', 'Other'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditingCustomer({ ...editingCustomer, type: t })}
                  className={`flex-1 py-1.5 text-sm font-semibold rounded transition-colors ${
                    editingCustomer.type === t
                      ? 'bg-[#1a3a5c] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >{t}</button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {editingCustomer.type === 'Owner' ? 'Owner / Company Name' : 'Company'}
                </label>
                <input
                  type="text"
                  value={editingCustomer.company}
                  onChange={e => setEditingCustomer({ ...editingCustomer, company: e.target.value })}
                  placeholder="Company or name"
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={editingCustomer.contactName}
                  onChange={e => setEditingCustomer({ ...editingCustomer, contactName: e.target.value })}
                  placeholder="First Last"
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editingCustomer.phone}
                  onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                  placeholder="(865) 555-0100"
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={editingCustomer.email}
                  onChange={e => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                  placeholder="contact@example.com"
                  className="border border-gray-300 rounded px-3 py-2 text-sm w-full"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowCustomerModal(false)}
                className="flex-1 py-2 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
              >Cancel</button>
              <button
                onClick={() => saveCustomer(editingCustomer)}
                disabled={!editingCustomer.company.trim()}
                className="flex-1 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] disabled:opacity-40"
              >Save Customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
