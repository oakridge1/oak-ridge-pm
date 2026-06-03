'use client';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { DEFAULTS } from '@/lib/estimator/constants';
import type { RateConfig } from '@/lib/estimator/constants';
import { BOM } from '@/lib/estimator/bom';

// ── Format helper ──────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

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

        <div className={CLS.fieldRow}>
          <span className={CLS.label}>Job Name</span>
          <input
            type="text"
            value={state.jobName}
            onChange={e => setState(s => ({ ...s, jobName: e.target.value }))}
            className={CLS.inputText}
            placeholder="e.g. Main Street Office"
          />
        </div>

        <div className={CLS.fieldRow}>
          <span className={CLS.label}>Job Number</span>
          <input
            type="text"
            value={state.jobNumber}
            onChange={e => setState(s => ({ ...s, jobNumber: e.target.value }))}
            className={CLS.inputText}
            placeholder="e.g. 2024-042"
          />
        </div>
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
    </div>
  );
}
