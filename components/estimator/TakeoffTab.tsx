'use client';

import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { useRef, useState } from 'react';

// ── Label map ──────────────────────────────────────────────────────────────────

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

// Items measured in linear feet rather than unit count
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

// Category group display labels
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

// Map item ids → category key
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

const CAT_ORDER = [
  'devices','fixtures','data_lv','fa',
  'gear','rough','conduit','mc','racks','other',
];

// ── TakeoffTab ─────────────────────────────────────────────────────────────────

export function TakeoffTab() {
  const { state, setState } = useEstimatorContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingId,   setEditingId]   = useState<string | null>(null);

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

      {/* ── HEADER BAR ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between bg-[#eef4ff] border border-[#c0d4f0] rounded-lg px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-[#1a3a5c]">
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
            className="px-3 py-1.5 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] flex items-center gap-1 transition-colors"
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

        return CAT_ORDER.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;

          return (
            <div key={cat} className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
              {/* Group header */}
              <div className="bg-[#eef4ff] px-4 py-2 flex justify-between items-center border-b border-[#d0dff0]">
                <span className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c]">
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span className="text-xs text-gray-500">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Items table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400">
                    <th className="text-left px-4 py-2 font-semibold">Item</th>
                    <th className="text-right px-4 py-2 font-semibold w-32">Qty / Footage</th>
                    <th className="text-center px-4 py-2 font-semibold w-16">Unit</th>
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
                            className="font-mono text-gray-700 cursor-pointer hover:text-[#1a3a5c] hover:underline"
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
          <h3 className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
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
        <div className="bg-[#1a3a5c] text-white rounded-lg px-4 py-3 flex flex-wrap gap-6 text-sm">
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
