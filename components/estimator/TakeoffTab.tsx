'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { useEffect, useRef, useState } from 'react';
import {
  ITEM_LABELS, ITEM_CATEGORY, FOOTAGE_ITEMS,
  CATEGORY_LABELS, CAT_ORDER,
} from '@/lib/estimator/takeoffConstants';

// ── Takeoff → builder mappings ────────────────────────────────────────────────

const FA_TAKEOFF_MAP: Record<string, string> = {
  fa_smoke:       'fad2',
  fa_heat:        'fad3',
  fa_smoke_co:    'fad4',
  fa_pull:        'fad1',
  fa_horn_strobe: 'fad5',
  fa_strobe:      'fad6',
  fa_lf_sounder:  'fad7',
  fa_beacon:      'fad8',
  fa_ctrl_mod:    'fad9',
  fa_monitor_mod: 'fad9',
  fa_duct_smoke:  'fad10',
  fa_annun:       'fad11',
  fa_panel_sm:    'fad12',
  fa_panel_md:    'fad13',
  fa_panel_lg:    'fad14',
  fa_radio:       'fad15',
};

const LV_TAKEOFF_MAP: Record<string, string> = {
  camera_indoor:  'camera',
  camera_outdoor: 'camera',
  access_reader:  'reader',
  intercom:       'intercom',
  av_outlet:      'av',
  speaker:        'speaker',
  doorbell:       'doorbell',
};

const DATA_TAKEOFF_MAP: Record<string, number> = {
  data_1port: 1,
  data_2port: 2,
  data_3port: 3,
  data_4port: 4,
};

// Takeoff key → FixtureBuilderTab ASMS id (every id verified against ASMS)
const FIXTURE_TAKEOFF_MAP: Record<string, string> = {
  // Devices
  recept_20a:          'r20',
  recept_15a_tr:       'r15',
  gfci_20a:            'gfci20',
  gfci_15a_tr:         'gfci15',
  switch_sp:           'sw1p',
  switch_4way:         'sw4way',
  dimmer:              'dim',
  dimmer_010v:         'dim010',
  occ_sensor:          'occ1',
  // Fixtures
  fixture_2x4:         'tb24',
  fixture_2x2:         'tb22',
  fixture_strip:       'st48',
  fixture_strip_8:     'st96',
  fixture_wrap_4:      'vt48',
  fixture_wrap_8:      'vt96',
  fixture_highbay:     'hbay',
  fixture_highbay_lin: 'hbay_lin',
  fixture_lowbay:      'lowbay',
  fixture_pendant:     'pendant',
  fixture_wall:        'sconce',
  fixture_wallpack:    'ewp',
  fixture_chain48:     'ch48',
  fixture_chain96:     'ch96',
  fixture_exit_ebu:    'exit',
  fixture_emrg:        'emrg',
  fixture_fan36:       'fan36',
  fixture_fan48:       'fan48',
  fixture_fan55:       'fan55',
  fixture_fan60:       'fan60',
};

// 3-way switch is a footage item (traveler ft) — prefills the ThreeWayBuilder
const THREEWAY_TAKEOFF_KEYS = new Set(['switch_3way']);

// ── TakeoffTab ─────────────────────────────────────────────────────────────────

export function TakeoffTab() {
  const { state, setState, setTab, setActiveLabel, addLabel, updateFAState, updateLVState, updateDataState, updateFixtureState, updateThreeWayState } = useEstimatorContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [syncPayload, setSyncPayload] = useState<{
    source: string;
    jobName: string;
    totals: Record<string, number>;
    timestamp: number;
    areas: Array<{ areaName: string; counts: Record<string, number> }>;
    activeBidPackage?: string;
    activeArea?:       string;
    activeCostCode?:   string;
  } | null>(null);
  const [labelConfirmPayload, setLabelConfirmPayload] = useState<{
    bidPackage: string;
    area:       string;
    costCode:   string;
  } | null>(null);

  useEffect(() => {
    function checkSync() {
      try {
        const raw = localStorage.getItem('ore_estimator_sync');
        if (!raw) return;
        const payload = JSON.parse(raw);
        if (!payload.timestamp) return;
        const lastSync = parseInt(
          localStorage.getItem('ore_estimator_sync_last') ?? '0'
        );
        if (payload.timestamp <= lastSync) return;
        setSyncPayload(payload);
      } catch {}
    }
    checkSync();
    const interval = setInterval(checkSync, 3000);
    return () => clearInterval(interval);
  }, []);

  // BroadcastChannel — instant sync path (localStorage poll above stays as fallback)
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('ore_tools');
    channel.onmessage = (e) => {
      if (e.data?.type === 'SYNC_COUNTS') {
        setSyncPayload(e.data.payload);
      }
      // LABELS_CHANGED / JOB_CONTEXT originate from the estimator — no action here
    };
    return () => channel.close();
  }, []);

  const counts  = state.takeoffCounts;
  const hasData = Object.keys(counts).length > 0;

  // ── Import handler ─────────────────────────────────────────────────────────

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json = JSON.parse(ev.target?.result as string) as any;
        if (!json.totals || typeof json.totals !== 'object') {
          setImportError('Invalid file — missing totals object.');
          return;
        }
        setState(s => ({
          ...s,
          takeoffCounts: json.totals as Record<string, number>,
          takeoffAreas:  Array.isArray(json.areas) ? json.areas : [],
          takeoffSource:
            `Counter export — ${json.exportDate ?? 'unknown date'}` +
            (json.jobName ? ` (${json.jobName as string})` : ''),
          jobName:
            s.jobName === 'New Job' || s.jobName === ''
              ? (json.jobName as string | undefined) ?? s.jobName
              : s.jobName,
        }));
        setImportError(null);
      } catch {
        setImportError('Failed to parse file — is it a valid counter JSON?');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Clear handler ──────────────────────────────────────────────────────────

  function handleClear() {
    if (!window.confirm('Clear all takeoff counts? This cannot be undone.')) return;
    setState(s => ({
      ...s,
      takeoffCounts: {},
      takeoffAreas:  [],
      takeoffSource: '',
    }));
  }

  // ── Inline edit handlers ───────────────────────────────────────────────────

  function updateCount(itemId: string, value: number) {
    setState(s => ({
      ...s,
      takeoffCounts: { ...s.takeoffCounts, [itemId]: value },
    }));
  }

  function removeCount(itemId: string) {
    setState(s => {
      const next = { ...s.takeoffCounts };
      delete next[itemId];
      return { ...s, takeoffCounts: next };
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── SYNC BANNER ───────────────────────────────────────────────────── */}
      {syncPayload && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg px-4 py-3">
          <span className="text-green-600 text-lg">⇄</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-800">
              New counts available from{' '}
              {syncPayload.source === 'pdf-takeoff' ? 'PDF Takeoff tool' : 'Counter tool'}
              {syncPayload.jobName ? ` — ${syncPayload.jobName}` : ''}
            </div>
            <div className="text-xs text-green-600">
              {Object.keys(syncPayload.totals).length} items ready to import
            </div>
          </div>
          <button
            onClick={() => {
              setState(s => ({
                ...s,
                takeoffCounts: syncPayload.totals,
                takeoffAreas:  syncPayload.areas ?? [],
                takeoffSource: `${syncPayload.source === 'pdf-takeoff' ? 'PDF Takeoff' : 'Counter'} — ${syncPayload.jobName || syncPayload.source}`,
                jobName: (s.jobName === 'New Job' || s.jobName === '')
                  ? (syncPayload.jobName || s.jobName) : s.jobName,
              }));
              localStorage.setItem('ore_estimator_sync_last', String(syncPayload.timestamp));
              // Labels carried in the SYNC payload → offer to apply them
              const incomingLabels = {
                bidPackage: syncPayload.activeBidPackage ?? '',
                area:       syncPayload.activeArea       ?? '',
                costCode:   syncPayload.activeCostCode   ?? '',
              };
              if (incomingLabels.bidPackage || incomingLabels.area || incomingLabels.costCode) {
                setLabelConfirmPayload(incomingLabels);
              }
              setSyncPayload(null);
            }}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
          >
            Import Now
          </button>
          <button
            onClick={() => {
              localStorage.setItem('ore_estimator_sync_last', String(syncPayload.timestamp));
              setSyncPayload(null);
            }}
            className="text-green-500 hover:text-green-700 text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── LABEL CONFIRMATION BANNER ─────────────────────────────────────── */}
      {labelConfirmPayload && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg px-4 py-3">
          <span className="text-green-600 text-lg">⬡</span>
          <div className="flex-1">
            <div className="text-sm font-semibold text-green-800">
              Takeoff labeled:{' '}
              {[labelConfirmPayload.bidPackage, labelConfirmPayload.area, labelConfirmPayload.costCode]
                .filter(Boolean).join(' / ')}
            </div>
            <div className="text-xs text-green-600">
              Apply these as the active labels for new assemblies?
            </div>
          </div>
          <button
            onClick={() => {
              if (labelConfirmPayload.bidPackage) {
                addLabel('bidPackage', labelConfirmPayload.bidPackage);
                setActiveLabel('bidPackage', labelConfirmPayload.bidPackage);
              }
              if (labelConfirmPayload.area) {
                addLabel('area', labelConfirmPayload.area);
                setActiveLabel('area', labelConfirmPayload.area);
              }
              if (labelConfirmPayload.costCode) {
                addLabel('costCode', labelConfirmPayload.costCode);
                setActiveLabel('costCode', labelConfirmPayload.costCode);
              }
              setLabelConfirmPayload(null);
            }}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-green-600 text-white hover:bg-green-700 whitespace-nowrap"
          >
            Apply These Labels
          </button>
          <button
            onClick={() => setLabelConfirmPayload(null)}
            className="px-3 py-1.5 text-sm rounded border border-green-300 text-green-700 hover:bg-green-100 whitespace-nowrap"
          >
            Keep Current
          </button>
        </div>
      )}

      {/* ── HEADER BAR ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#eef4ff] border border-[#c0d4f0] rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#1e3a8a]">
            Takeoff Counts
          </div>
          {state.takeoffSource ? (
            <div className="text-xs text-gray-500 mt-0.5">
              Source: {state.takeoffSource}
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-0.5">
              Import counts from the handheld counter tool
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 text-sm font-semibold rounded bg-[#1e3a8a] text-white hover:bg-[#2e5a8c] flex items-center gap-1 transition-colors"
          >
            ⬆ Import Counter JSON
          </button>
          {hasData && (
            <button
              onClick={handleClear}
              className="px-3 py-1.5 text-sm rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
            >
              Clear
            </button>
          )}
          <input
            type="file"
            accept=".json"
            ref={fileRef}
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </div>

      {importError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {importError}
        </div>
      )}

      {/* ── EMPTY STATE ───────────────────────────────────────────────────── */}
      {!hasData && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📋</div>
          <div className="text-sm font-medium text-gray-500 mb-1">
            No takeoff counts yet
          </div>
          <div className="text-xs">
            Export a JSON from the handheld counter tool and import it here to see your counts.
          </div>
        </div>
      )}

      {/* ── COUNTS TABLE — grouped by category ───────────────────────────── */}
      {hasData && (() => {
        // Group counts by category
        const grouped: Record<string, Array<{ id: string; qty: number }>> = {};
        for (const [id, qty] of Object.entries(counts)) {
          if (!qty) continue;
          const cat = ITEM_CATEGORY[id] ?? 'other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({ id, qty });
        }

        return [...CAT_ORDER, 'other'].map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;

          return (
            <div key={cat} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="bg-[#eef4ff] px-4 py-2 flex justify-between items-center border-b border-[#d0dff0]">
                <span className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                  {cat === 'fa' && (
                    <button
                      onClick={() => setTab('assemblies')}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-[#1e3a8a] text-white hover:bg-red-700 whitespace-nowrap transition-colors">
                      → FA Builder
                    </button>
                  )}
                  {cat === 'data_lv' && (
                    <button
                      onClick={() => setTab('assemblies')}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-teal-600 text-white hover:bg-teal-700 whitespace-nowrap transition-colors">
                      → Data/LV Builders
                    </button>
                  )}
                  {(cat === 'devices' || cat === 'fixtures') && (
                    <button
                      onClick={() => setTab('fixtures')}
                      className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap transition-colors">
                      → Fixture Builder
                    </button>
                  )}
                </div>
              </div>

              {/* Items table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                    <th className="text-left px-4 py-2 font-semibold">Item</th>
                    <th className="text-right px-4 py-2 font-semibold w-32">Qty / Footage</th>
                    <th className="text-center px-4 py-2 font-semibold w-16">Unit</th>
                    <th className="w-24"></th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(({ id, qty }) => (
                    <tr
                      key={id}
                      className="border-b border-gray-50 hover:bg-blue-50 transition-colors group"
                    >
                      <td className="px-4 py-2 text-gray-800">
                        {ITEM_LABELS[id] ?? id}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {editingId === id ? (
                          <input
                            type="number"
                            defaultValue={qty}
                            autoFocus
                            className="w-24 text-right border border-blue-400 rounded px-2 py-0.5 text-sm font-mono focus:outline-none"
                            onBlur={e => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v > 0) updateCount(id, v);
                              else removeCount(id);
                              setEditingId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                        ) : (
                          <span
                            className="font-mono text-gray-700 cursor-pointer hover:text-[#1e3a8a] hover:underline"
                            onClick={() => setEditingId(id)}
                            title="Click to edit"
                          >
                            {qty.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center text-xs text-gray-400">
                        {FOOTAGE_ITEMS.has(id) ? 'ft' : 'ea'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {cat === 'fa' && id in FA_TAKEOFF_MAP && (
                          <button
                            onClick={() => { updateFAState({ deviceId: FA_TAKEOFF_MAP[id], qty }); setTab('assemblies'); }}
                            title="Load into FA Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-red-700 text-white hover:bg-red-800 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {cat === 'data_lv' && id in LV_TAKEOFF_MAP && (
                          <button
                            onClick={() => { updateLVState({ deviceType: LV_TAKEOFF_MAP[id], qty }); setTab('assemblies'); }}
                            title="Load into LV Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-teal-600 text-white hover:bg-teal-700 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {cat === 'data_lv' && id in DATA_TAKEOFF_MAP && (
                          <button
                            onClick={() => { updateDataState({ ports: DATA_TAKEOFF_MAP[id] as (1 | 2 | 3 | 4) }); setTab('assemblies'); }}
                            title="Load into Data Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {(cat === 'devices' || cat === 'fixtures') && id in FIXTURE_TAKEOFF_MAP && (
                          <button
                            onClick={() => { updateFixtureState({ selectedId: FIXTURE_TAKEOFF_MAP[id], qty: Math.max(1, Math.round(qty)) }); setTab('fixtures'); }}
                            title="Load into Fixture Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                        {THREEWAY_TAKEOFF_KEYS.has(id) && (
                          <button
                            onClick={() => { updateThreeWayState({ travelerFt: qty }); setTab('assemblies'); }}
                            title="Load traveler footage into 3-Way Builder"
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 text-xs font-semibold rounded bg-orange-500 text-white hover:bg-orange-600 whitespace-nowrap">
                            → Build
                          </button>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => removeCount(id)}
                          className="text-red-400 hover:text-red-600 text-xs px-1"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        });
      })()}

      {/* ── AREA BREAKDOWN ────────────────────────────────────────────────── */}
      {hasData && state.takeoffAreas.length > 1 && (
        <div className="bg-white rounded border border-gray-200 shadow-sm p-4">
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#1e3a8a] border-b border-gray-200 pb-1 mb-3">
            By Area
          </h3>
          <div className="space-y-2">
            {state.takeoffAreas.map((area, i) => {
              const areaTotal = Object.keys(area.counts).length;
              if (areaTotal === 0) return null;
              return (
                <div
                  key={i}
                  className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">{area.areaName}</span>
                  <span className="text-xs text-gray-400">
                    {areaTotal} item type{areaTotal !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SUMMARY BAR ───────────────────────────────────────────────────── */}
      {hasData && (
        <div className="bg-[#1e3a8a] text-white rounded-lg px-4 py-3 flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-blue-200 text-xs">Total line items</div>
            <div className="font-bold">{Object.keys(counts).length}</div>
          </div>
          <div>
            <div className="text-blue-200 text-xs">Total units / footage</div>
            <div className="font-bold">
              {Object.values(counts).reduce((s, v) => s + v, 0).toLocaleString()}
            </div>
          </div>
          {state.takeoffAreas.length > 0 && (
            <div>
              <div className="text-blue-200 text-xs">Areas counted</div>
              <div className="font-bold">{state.takeoffAreas.length}</div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
