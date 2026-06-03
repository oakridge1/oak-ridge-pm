'use client';

import { useState } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { computeTotals } from '@/lib/estimator/counterState';
import type { CounterState } from '@/lib/estimator/counterState';

// ── Item constants ─────────────────────────────────────────────────────────────
// These mirror the private constants in TakeoffTab.tsx.
// If TakeoffTab constants change, update here too.

const ITEM_LABELS: Record<string, string> = {
  // Devices
  recept_20a: '20A Receptacle',       recept_15a_tr: '15A TR Receptacle',
  gfci_20a: '20A GFCI',              gfci_15a_tr: '15A TR GFCI',
  recept_30a: '30A Receptacle',       recept_50a: '50A Receptacle',
  recept_240v: '240V Receptacle',     recept_twist: 'Twist-Lock Receptacle',
  usb_recept: 'USB Receptacle',
  switch_sp: 'Single Pole Switch',    switch_3way: '3-Way Switch',
  switch_4way: '4-Way Switch',        dimmer: 'Dimmer',
  dimmer_010v: '0-10V Dimmer (Lutron)',
  occ_sensor_ceil: 'Occ Sensor Ceiling', occ_sensor_pir: 'Occ Sensor Wall PIR',
  photocell: 'Photocell',             wp_cover: 'WP In-Use Cover',
  floor_box: 'Floor Box',
  // Fixtures
  fixture_2x4: '2×4 LED Lay-In',     fixture_2x2: '2×2 LED Lay-In',
  fixture_strip: '4ft LED Strip',     fixture_strip_8: '8ft LED Strip',
  fixture_wrap_4: '4ft Vapor Tight',  fixture_wrap_8: '8ft Vapor Tight',
  fixture_rec_new: 'Recessed Can - New', fixture_rec_rem: 'Recessed Can - Remodel',
  fixture_rec_retro: 'Recessed Can - Retrofit',
  fixture_wall: 'Wall Mount Indoor',  fixture_wall_out: 'Wall Mount Outdoor',
  fixture_canopy: 'Canopy / Soffit',  fixture_highbay: 'High Bay LED (UFO)',
  fixture_highbay_lin: 'Linear High Bay', fixture_lowbay: 'Low Bay LED',
  fixture_pendant: 'Pendant / Hanging',
  fixture_track_rail: 'Track Rail (ft)', fixture_track_head: 'Track Head',
  fixture_wallpack: 'LED Wall Pack',  fixture_exit_ebu: 'Exit / EBU Combo',
  fixture_exit_only: 'Exit Sign Only', fixture_emrg: 'Emergency Light Only',
  fixture_fan36: 'Ceiling Fan 36"',   fixture_fan48: 'Ceiling Fan 48"',
  fixture_fan55: 'Ceiling Fan 55"',   fixture_fan60: 'Ceiling Fan 60"',
  fixture_chain48: 'Chain-Hung Industrial 48"',
  fixture_chain96: 'Chain-Hung Industrial 96"',
  // Data / LV
  data_1port: '1-Port Data',          data_2port: '2-Port Data',
  data_3port: '3-Port Data',          data_4port: '4-Port Data',
  camera_indoor: 'Security Camera Indoor',
  camera_outdoor: 'Security Camera Outdoor',
  access_reader: 'Access Control Reader', intercom: 'Intercom Station',
  av_outlet: 'TV/AV Outlet',          speaker: 'Speaker Rough-In',
  doorbell: 'Doorbell / Call Button',
  // Fire Alarm
  fa_smoke: 'Smoke Detector',         fa_heat: 'Heat Detector',
  fa_smoke_co: 'Smoke/CO Combo',      fa_pull: 'Pull Station',
  fa_horn_strobe: 'Horn/Strobe',      fa_strobe: 'Strobe Only',
  fa_lf_sounder: 'LF Sounder',        fa_beacon: 'Beacon',
  fa_ctrl_mod: 'Control Module',      fa_monitor_mod: 'Monitor Module',
  fa_duct_smoke: 'Duct Smoke',        fa_beam: 'Beam Detector',
  fa_relay: 'FA Relay',               fa_panel_sm: 'FA Panel Small',
  fa_panel_md: 'FA Panel Medium',     fa_panel_lg: 'FA Panel Large',
  fa_annun: 'FA Annunciator',         fa_radio: 'Radio Box',
  // Gear
  panel_comm: 'Commercial Panel',     panel_ltg: 'Lighting Panel',
  lc_100a: 'Load Center 100A',        lc_200a: 'Load Center 200A',
  xfmr: 'Transformer',               meter_socket: 'Meter Socket',
  meter_bank: 'Meter Bank',           meter_main: 'Meter-Main Combo',
  ct_cab: 'CT Cabinet',              disconnect: 'Disconnect',
  disc_ac: 'A/C Disconnect',         disc_motor: 'Motor Disconnect',
  gear_mdp: 'MDP',                    gear_swgr: 'Switchgear',
  gear_mcc: 'MCC',                    gear_ats: 'ATS',
  gear_bypass: 'Bypass Switch',       gear_vfd: 'VFD',
  gear_soft: 'Soft Starter',          gear_ctrl: 'Relay / Control Panel',
  // Boxes & Rough
  box_4sq_deep: '4" Square Box',      box_2gang: '2-Gang Box',
  box_3gang: '3-Gang Box',            box_wp: 'WP Box',
  box_jbox: 'Junction Box',
  can_sm: 'Pull Can Small',           can_md: 'Pull Can Medium',
  can_lg: 'Pull Can Large',           can_xl: 'Pull Can XL',
  // Conduit (footage)
  emt_12: '1/2" EMT',   emt_34: '3/4" EMT',   emt_1: '1" EMT',
  emt_114: '1-1/4" EMT', emt_112: '1-1/2" EMT', emt_2: '2" EMT',
  emt_212: '2-1/2" EMT', emt_3: '3" EMT',      emt_312: '3-1/2" EMT',
  emt_4: '4" EMT',
  pvc_12: '1/2" PVC 40', pvc_34: '3/4" PVC 40', pvc_1: '1" PVC 40',
  pvc_112: '1-1/2" PVC', pvc_2: '2" PVC',      pvc_3: '3" PVC',
  pvc_4: '4" PVC',
  rgd_12: '1/2" Rigid',  rgd_34: '3/4" Rigid', rgd_1: '1" Rigid',
  rgd_2: '2" Rigid',     rgd_3: '3" Rigid',     rgd_4: '4" Rigid',
  imc_12: '1/2" IMC',   imc_34: '3/4" IMC',   imc_1: '1" IMC',
  imc_2: '2" IMC',
  flex_12: '1/2" Flex',  flex_34: '3/4" Flex',
  lt_12: '1/2" LT',      lt_34: '3/4" LT',
  nmb_142: '14/2 NM-B',  nmb_143: '14/3 NM-B',
  nmb_122: '12/2 NM-B',  nmb_123: '12/3 NM-B',
  nmb_102: '10/2 NM-B',  nmb_103: '10/3 NM-B',
  // MC Cable (footage)
  mc_142: '14/2 MC',    mc_122: '12/2 MC',    mc_123: '12/3 MC',
  mc_102: '10/2 MC',    mc_103: '10/3 MC',
  mc_83: '8/3 MC',      mc_63: '6/3 MC',      mc_43: '4/3 MC',
  mc_23: '2/3 MC',      mc_10: '1/0 MC',
  // Racks
  rack_12w: 'Strut Rack 12" Wall',    rack_18w: 'Strut Rack 18" Wall',
  rack_24w: 'Strut Rack 24" Wall',    rack_48w: 'Strut Rack 48" Wall',
  rack_60w: 'Strut Rack 60" Wall',
  rack_12h: 'Strut Rack 12" Hang',    rack_18h: 'Strut Rack 18" Hang',
  rack_24h: 'Strut Rack 24" Hang',    rack_48h: 'Strut Rack 48" Hang',
  rack_60h: 'Strut Rack 60" Hang',
  ct_12: 'Cable Tray 12" (ft)',       ct_18: 'Cable Tray 18" (ft)',
  ct_24: 'Cable Tray 24" (ft)',
};

const FOOTAGE_ITEMS = new Set([
  'fixture_track_rail',
  'emt_12','emt_34','emt_1','emt_114','emt_112','emt_2',
  'emt_212','emt_3','emt_312','emt_4',
  'pvc_12','pvc_34','pvc_1','pvc_112','pvc_2','pvc_3','pvc_4',
  'rgd_12','rgd_34','rgd_1','rgd_2','rgd_3','rgd_4',
  'imc_12','imc_34','imc_1','imc_2',
  'flex_12','flex_34','lt_12','lt_34',
  'nmb_142','nmb_143','nmb_122','nmb_123','nmb_102','nmb_103',
  'mc_142','mc_122','mc_123','mc_102','mc_103',
  'mc_83','mc_63','mc_43','mc_23','mc_10',
  'ct_12','ct_18','ct_24',
]);

const CATEGORY_LABELS: Record<string, string> = {
  devices:  'Devices',
  fixtures: 'Fixtures',
  data_lv:  'Data / LV',
  fa:       'Fire Alarm',
  gear:     'Gear',
  rough:    'Boxes & Rough',
  conduit:  'Conduit',
  mc:       'MC Cable',
  racks:    'Racks',
};

const ITEM_CATEGORY: Record<string, string> = {
  recept_20a:'devices', recept_15a_tr:'devices', gfci_20a:'devices',
  gfci_15a_tr:'devices', recept_30a:'devices', recept_50a:'devices',
  recept_240v:'devices', recept_twist:'devices', usb_recept:'devices',
  switch_sp:'devices', switch_3way:'devices', switch_4way:'devices',
  dimmer:'devices', dimmer_010v:'devices', occ_sensor_ceil:'devices',
  occ_sensor_pir:'devices', photocell:'devices', wp_cover:'devices',
  floor_box:'devices',
  fixture_2x4:'fixtures', fixture_2x2:'fixtures', fixture_strip:'fixtures',
  fixture_strip_8:'fixtures', fixture_wrap_4:'fixtures', fixture_wrap_8:'fixtures',
  fixture_rec_new:'fixtures', fixture_rec_rem:'fixtures',
  fixture_rec_retro:'fixtures', fixture_wall:'fixtures',
  fixture_wall_out:'fixtures', fixture_canopy:'fixtures',
  fixture_highbay:'fixtures', fixture_highbay_lin:'fixtures',
  fixture_lowbay:'fixtures', fixture_pendant:'fixtures',
  fixture_track_rail:'fixtures', fixture_track_head:'fixtures',
  fixture_wallpack:'fixtures', fixture_exit_ebu:'fixtures',
  fixture_exit_only:'fixtures', fixture_emrg:'fixtures',
  fixture_fan36:'fixtures', fixture_fan48:'fixtures',
  fixture_fan55:'fixtures', fixture_fan60:'fixtures',
  fixture_chain48:'fixtures', fixture_chain96:'fixtures',
  data_1port:'data_lv', data_2port:'data_lv', data_3port:'data_lv',
  data_4port:'data_lv', camera_indoor:'data_lv', camera_outdoor:'data_lv',
  access_reader:'data_lv', intercom:'data_lv', av_outlet:'data_lv',
  speaker:'data_lv', doorbell:'data_lv',
  fa_smoke:'fa', fa_heat:'fa', fa_smoke_co:'fa', fa_pull:'fa',
  fa_horn_strobe:'fa', fa_strobe:'fa', fa_lf_sounder:'fa', fa_beacon:'fa',
  fa_ctrl_mod:'fa', fa_monitor_mod:'fa', fa_duct_smoke:'fa', fa_beam:'fa',
  fa_relay:'fa', fa_panel_sm:'fa', fa_panel_md:'fa', fa_panel_lg:'fa',
  fa_annun:'fa', fa_radio:'fa',
  panel_comm:'gear', panel_ltg:'gear', lc_100a:'gear', lc_200a:'gear',
  xfmr:'gear', meter_socket:'gear', meter_bank:'gear', meter_main:'gear',
  ct_cab:'gear', disconnect:'gear', disc_ac:'gear', disc_motor:'gear',
  gear_mdp:'gear', gear_swgr:'gear', gear_mcc:'gear', gear_ats:'gear',
  gear_bypass:'gear', gear_vfd:'gear', gear_soft:'gear', gear_ctrl:'gear',
  box_4sq_deep:'rough', box_2gang:'rough', box_3gang:'rough',
  box_wp:'rough', box_jbox:'rough',
  can_sm:'rough', can_md:'rough', can_lg:'rough', can_xl:'rough',
  emt_12:'conduit', emt_34:'conduit', emt_1:'conduit', emt_114:'conduit',
  emt_112:'conduit', emt_2:'conduit', emt_212:'conduit', emt_3:'conduit',
  emt_312:'conduit', emt_4:'conduit',
  pvc_12:'conduit', pvc_34:'conduit', pvc_1:'conduit', pvc_112:'conduit',
  pvc_2:'conduit', pvc_3:'conduit', pvc_4:'conduit',
  rgd_12:'conduit', rgd_34:'conduit', rgd_1:'conduit',
  rgd_2:'conduit', rgd_3:'conduit', rgd_4:'conduit',
  imc_12:'conduit', imc_34:'conduit', imc_1:'conduit', imc_2:'conduit',
  flex_12:'conduit', flex_34:'conduit', lt_12:'conduit', lt_34:'conduit',
  nmb_142:'conduit', nmb_143:'conduit', nmb_122:'conduit',
  nmb_123:'conduit', nmb_102:'conduit', nmb_103:'conduit',
  mc_142:'mc', mc_122:'mc', mc_123:'mc', mc_102:'mc', mc_103:'mc',
  mc_83:'mc', mc_63:'mc', mc_43:'mc', mc_23:'mc', mc_10:'mc',
  rack_12w:'racks', rack_18w:'racks', rack_24w:'racks',
  rack_48w:'racks', rack_60w:'racks',
  rack_12h:'racks', rack_18h:'racks', rack_24h:'racks',
  rack_48h:'racks', rack_60h:'racks',
  ct_12:'racks', ct_18:'racks', ct_24:'racks',
};

// ── Category → item ids lookup (built at module load) ─────────────────────────

const CAT_ORDER = [
  'devices', 'fixtures', 'data_lv', 'fa',
  'gear', 'rough', 'conduit', 'mc', 'racks',
];

const CAT_ITEMS: Record<string, string[]> = {};
Object.entries(ITEM_CATEGORY).forEach(([id, cat]) => {
  if (!CAT_ITEMS[cat]) CAT_ITEMS[cat] = [];
  CAT_ITEMS[cat].push(id);
});

// ── CounterTool ────────────────────────────────────────────────────────────────

export function CounterTool() {
  const { state, setState } = useEstimatorContext();
  const counter = state.counter;

  const [activeTab,   setActiveTab]   = useState(CAT_ORDER[0]);
  const [showAreas,   setShowAreas]   = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [showSummary, setShowSummary] = useState(false);

  const currentArea = counter.areas[counter.currentAreaIdx];

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function patchCounter(patch: Partial<CounterState>) {
    setState(s => ({ ...s, counter: { ...s.counter, ...patch } }));
  }

  function getCount(itemId: string): number {
    return currentArea?.counts[itemId] ?? 0;
  }

  function increment(itemId: string, delta: number) {
    setState(s => {
      const areas = s.counter.areas.map((a, i) => {
        if (i !== s.counter.currentAreaIdx) return a;
        const cur  = a.counts[itemId] ?? 0;
        const next = Math.max(0, cur + delta);
        return { ...a, counts: { ...a.counts, [itemId]: next } };
      });
      return {
        ...s,
        counter:       { ...s.counter, areas },
        takeoffCounts: computeTotals(areas),
        takeoffSource: 'Counter tool — live sync',
      };
    });
  }

  function resetItem(itemId: string) {
    increment(itemId, -(getCount(itemId)));
  }

  function addArea() {
    const name = newAreaName.trim() || `Area ${counter.areas.length + 1}`;
    patchCounter({
      areas:          [...counter.areas, { name, counts: {} }],
      currentAreaIdx: counter.areas.length,
    });
    setNewAreaName('');
  }

  function switchArea(idx: number) {
    patchCounter({ currentAreaIdx: idx });
  }

  function clearArea() {
    if (!window.confirm(`Clear all counts in "${currentArea?.name ?? 'this area'}"?`)) return;
    setState(s => {
      const areas = s.counter.areas.map((a, i) =>
        i === s.counter.currentAreaIdx ? { ...a, counts: {} } : a
      );
      return {
        ...s,
        counter:       { ...s.counter, areas },
        takeoffCounts: computeTotals(areas),
      };
    });
  }

  function deleteArea(idx: number) {
    if (counter.areas.length <= 1) return;
    setState(s => {
      const areas   = s.counter.areas.filter((_, i) => i !== idx);
      let newIdx    = s.counter.currentAreaIdx;
      if (idx < newIdx)      newIdx--;
      else if (idx === newIdx) newIdx = Math.max(0, newIdx - 1);
      return {
        ...s,
        counter:       { ...s.counter, areas, currentAreaIdx: newIdx },
        takeoffCounts: computeTotals(areas),
        takeoffSource: 'Counter tool — live sync',
      };
    });
  }

  function exportJSON() {
    const totals = computeTotals(counter.areas);
    const out = {
      jobName:    state.jobName || 'Untitled',
      exportDate: new Date().toISOString().slice(0, 10),
      areas: counter.areas.map(a => ({
        areaName: a.name,
        counts:   Object.fromEntries(
          Object.entries(a.counts).filter(([, v]) => v > 0)
        ),
      })),
      totals,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${state.jobName || 'takeoff'}-counter.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Bottom bar totals ─────────────────────────────────────────────────────────

  const tabItems     = CAT_ITEMS[activeTab] ?? [];
  const tabItemCount = tabItems.filter(id => getCount(id) > 0).length;
  const tabUnitCount = tabItems.reduce((sum, id) => sum + getCount(id), 0);
  const allTotals    = computeTotals(counter.areas);
  const overallCount = Object.values(allTotals).filter(v => v > 0).length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="bg-[#1a3a5c] text-white px-4 py-3 space-y-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-blue-200">
            OAK RIDGE / TAKEOFF
          </span>
          <span className="text-xs text-blue-300 truncate ml-2 max-w-[160px]">
            {state.jobName || '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-200 flex-1 truncate">
            AREA: {currentArea?.name ?? 'No area'}
          </span>
          <button
            onClick={() => setShowAreas(true)}
            className="px-2 py-1 text-xs rounded border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            AREAS
          </button>
          <button
            onClick={() => setShowSummary(true)}
            className="px-2 py-1 text-xs rounded border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            SUMMARY
          </button>
          <button
            onClick={exportJSON}
            className="px-2 py-1 text-xs rounded border border-white/40 text-white hover:bg-white/10 transition-colors"
          >
            EXPORT
          </button>
        </div>
      </div>

      {/* ── TAB BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex overflow-x-auto bg-[#0f2235] border-b border-[#2a4a6c] shrink-0">
        {CAT_ORDER.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={
              activeTab === cat
                ? 'px-4 py-3 text-xs font-bold text-white whitespace-nowrap border-b-2 border-orange-400'
                : 'px-4 py-3 text-xs font-bold text-blue-300 whitespace-nowrap hover:text-white transition-colors'
            }
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* ── ITEM CARDS ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-100">
        {(CAT_ITEMS[activeTab] ?? []).map(id => {
          const count     = getCount(id);
          const isFootage = FOOTAGE_ITEMS.has(id);
          const delta     = isFootage ? 5 : 1;

          return (
            <div
              key={id}
              className="bg-white rounded-xl shadow-sm flex items-center gap-3 px-4 py-3"
            >
              {/* Item name */}
              <span className="flex-1 text-sm font-medium text-gray-800">
                {ITEM_LABELS[id] ?? id}
                {isFootage && (
                  <span className="text-gray-400 ml-1 text-xs">(ft)</span>
                )}
              </span>

              {/* Reset ✕ — only when count > 0 */}
              {count > 0 && (
                <button
                  onClick={() => resetItem(id)}
                  className="text-gray-300 hover:text-red-400 text-xs px-1 transition-colors"
                >
                  ✕
                </button>
              )}

              {/* − */}
              <button
                onClick={() => increment(id, -delta)}
                disabled={count === 0}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center disabled:opacity-30 transition-colors"
              >
                −
              </button>

              {/* Count */}
              <span
                className={`w-10 text-center text-lg font-mono ${
                  count > 0 ? 'font-bold text-[#1a3a5c]' : 'text-gray-300'
                }`}
              >
                {count}
              </span>

              {/* + */}
              <button
                onClick={() => increment(id, delta)}
                className="w-9 h-9 rounded-full bg-[#1a3a5c] hover:bg-[#2e5a8c] text-white font-bold text-lg flex items-center justify-center transition-colors"
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {/* ── BOTTOM BAR ──────────────────────────────────────────────────────── */}
      <div className="bg-[#1a3a5c] text-white px-4 py-2 flex items-center justify-between text-xs shrink-0">
        <span>
          TOTAL THIS TAB: {tabItemCount} item{tabItemCount !== 1 ? 's' : ''} /{' '}
          {tabUnitCount.toLocaleString()} units
        </span>
        <span>OVERALL: {overallCount} item{overallCount !== 1 ? 's' : ''}</span>
      </div>

      {/* ── AREAS SLIDE-OVER ─────────────────────────────────────────────────── */}
      {showAreas && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowAreas(false)}
          />
          <div className="fixed right-0 top-0 h-full w-80 bg-white z-[70] shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-bold text-gray-800">Areas</span>
              <button
                onClick={() => setShowAreas(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Add area form */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newAreaName}
                  onChange={e => setNewAreaName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addArea()}
                  placeholder="New area name..."
                  className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={addArea}
                  className="px-3 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors"
                >
                  ADD
                </button>
              </div>

              {/* Areas list */}
              <div className="space-y-2">
                {counter.areas.map((area, idx) => {
                  const isCurrent  = idx === counter.currentAreaIdx;
                  const itemTypes  = Object.values(area.counts).filter(v => v > 0).length;
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg p-3 flex items-center gap-2 border ${
                        isCurrent
                          ? 'bg-[#eef4ff] border-[#c0d4f0]'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <button
                        className="flex-1 text-left min-w-0"
                        onClick={() => { switchArea(idx); setShowAreas(false); }}
                      >
                        <div className={`text-sm font-semibold flex items-center gap-2 ${isCurrent ? 'text-[#1a3a5c]' : 'text-gray-800'}`}>
                          <span className="truncate">{area.name}</span>
                          {isCurrent && (
                            <span className="shrink-0 text-xs bg-[#1a3a5c] text-white rounded-full px-2 py-0.5 font-medium leading-none">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {itemTypes} item type{itemTypes !== 1 ? 's' : ''}
                        </div>
                      </button>
                      <div className="flex gap-1 shrink-0">
                        {isCurrent && (
                          <button
                            onClick={clearArea}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                        {!isCurrent && counter.areas.length > 1 && (
                          <button
                            onClick={() => deleteArea(idx)}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowAreas(false)}
                className="w-full py-2 text-sm font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── SUMMARY SLIDE-OVER ───────────────────────────────────────────────── */}
      {showSummary && (() => {
        const totals  = computeTotals(counter.areas);
        const nonZero = Object.entries(totals).filter(([, v]) => v > 0);
        const synced  = state.takeoffSource?.includes('Counter tool');

        // Group by category
        const grouped: Record<string, Array<{ id: string; qty: number }>> = {};
        for (const [id, qty] of nonZero) {
          const cat = ITEM_CATEGORY[id] ?? 'other';
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push({ id, qty });
        }

        return (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[60]"
              onClick={() => setShowSummary(false)}
            />
            <div className="fixed right-0 top-0 h-full w-80 bg-white z-[70] shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="font-bold text-gray-800">Summary</span>
                <button
                  onClick={() => setShowSummary(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {synced && (
                  <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 mb-4">
                    Synced to Takeoff tab ✓
                  </div>
                )}

                {nonZero.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    No counts yet. Tap + on items to start.
                  </div>
                ) : (
                  <div className="space-y-5">
                    {CAT_ORDER.map(cat => {
                      const items = grouped[cat];
                      if (!items || items.length === 0) return null;
                      return (
                        <div key={cat}>
                          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] mb-2">
                            {CATEGORY_LABELS[cat] ?? cat}
                          </div>
                          <div className="space-y-1">
                            {items.map(({ id, qty }) => (
                              <div
                                key={id}
                                className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0"
                              >
                                <span className="text-gray-700 truncate pr-2">
                                  {ITEM_LABELS[id] ?? id}
                                </span>
                                <span className="font-mono font-bold text-[#1a3a5c] shrink-0">
                                  {qty.toLocaleString()}{' '}
                                  <span className="font-normal text-gray-400 text-xs">
                                    {FOOTAGE_ITEMS.has(id) ? 'ft' : 'ea'}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={() => setShowSummary(false)}
                  className="w-full py-2 text-sm font-semibold rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </>
        );
      })()}

    </div>
  );
}
