'use client';

import { useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { calcGear, GEAR_DEF, type GearParams } from '@/lib/estimator/calc';
import { getRates } from '@/lib/estimator/constants';

// ── Format helpers ─────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Gear groups (display-order dropdown with optgroups) ────────────────────────

const GEAR_GROUPS = [
  { grp: 'Panels', types: [
    { v: 'panel',          l: 'Commercial Panel (MLO or MB)'  },
    { v: 'panel_lighting', l: 'Lighting Panel 120/277V'       },
  ]},
  { grp: 'Transformers', types: [
    { v: 'xfmr',     l: 'Dry Type 3-Phase'            },
    { v: 'xfmr_1p',  l: 'Single Phase Distribution'   },
    { v: 'xfmr_iso', l: 'Isolation Transformer'       },
    { v: 'xfmr_bb',  l: 'Buck-Boost Transformer'      },
  ]},
  { grp: 'Disconnects', types: [
    { v: 'disc_nf',    l: 'Non-Fusible Disconnect'    },
    { v: 'disc_f',     l: 'Fusible Disconnect'        },
    { v: 'disc_ac',    l: 'A/C Unit Disconnect'       },
    { v: 'disc_motor', l: 'Motor Disconnect'          },
  ]},
  { grp: 'Meters', types: [
    { v: 'meter',      l: 'Meter Socket'              },
    { v: 'meter_bank', l: 'Meter Bank'                },
    { v: 'meter_main', l: 'Meter-Main Combo'          },
    { v: 'ct_cab',     l: 'CT Cabinet'                },
  ]},
  { grp: 'Specialty Gear', types: [
    { v: 'mdp',    l: 'Main Distribution Panel (MDP)'        },
    { v: 'swgr',   l: 'Switchgear'                           },
    { v: 'mcc',    l: 'Motor Control Center (MCC)'           },
    { v: 'ats',    l: 'Automatic Transfer Switch (ATS)'      },
    { v: 'bypass', l: 'Bypass Isolation Switch'              },
    { v: 'vfd',    l: 'Variable Frequency Drive (VFD)'       },
    { v: 'soft',   l: 'Soft Starter'                         },
    { v: 'ctrl',   l: 'Relay / Control Panel'                },
  ]},
];

const MOUNT_MAT_OPTIONS = [
  { v: 0,    l: 'None ($0)' },
  { v: 75,   l: '$75'       },
  { v: 150,  l: '$150'      },
  { v: 250,  l: '$250'      },
  { v: 375,  l: '$375'      },
  { v: 500,  l: '$500'      },
  { v: 750,  l: '$750'      },
  { v: 1000, l: '$1,000'    },
  { v: 2000, l: '$2,000'    },
  { v: 3500, l: '$3,500'    },
  { v: 5000, l: '$5,000'    },
];

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.00 },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

// ── GearBuilderTab ─────────────────────────────────────────────────────────────

export function GearBuilderTab() {
  const {
    state, updateGearState,
    addGear, removeAssembly,
  } = useEstimatorContext();

  const gearState = state.gearState;
  const R = getRates();

  // ── Derived flags ──────────────────────────────────────────────────────
  const isDisc    = gearState.gearType.startsWith('disc_');
  const isFusedD  = gearState.gearType === 'disc_f';
  const isXfmr    = gearState.gearType.startsWith('xfmr');

  // ── Live preview ───────────────────────────────────────────────────────
  const preview = useMemo(() => {
    const gearType = gearState.gearType as keyof typeof GEAR_DEF;
    if (!GEAR_DEF[gearType]) return null;
    const p: GearParams = {
      gearType,
      qty:    gearState.qty,
      nema3r: gearState.nema3r,
      fused:  gearState.fuseInstall,    // proper mapping: fuseInstall → fused
      diff:   gearState.diff,
    };
    return calcGear(p);
  }, [gearState]);

  // ── Add handler ────────────────────────────────────────────────────────
  function handleAdd() {
    addGear();
  }

  return (
    <div className="max-w-3xl">

      {/* ── BUILDER FORM ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
          Gear Builder
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">

          {/* Gear type */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Gear Type</label>
            <select
              value={gearState.gearType}
              onChange={e => updateGearState({ gearType: e.target.value })}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
            >
              {GEAR_GROUPS.map(({ grp, types }) => (
                <optgroup key={grp} label={grp}>
                  {types.map(t => (
                    <option key={t.v} value={t.v}>{t.l}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* KVA (xfmr only) */}
          {isXfmr && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">KVA Rating</label>
              <input
                type="text"
                placeholder="e.g. 45 KVA"
                value={gearState.kva}
                onChange={e => updateGearState({ kva: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
              />
            </div>
          )}

          {/* Description / note */}
          <div className={isXfmr ? '' : 'sm:col-span-2'}>
            <label className="block text-xs text-gray-500 mb-1">Description / Note</label>
            <input
              type="text"
              placeholder="e.g. Main panel — Building A"
              value={gearState.desc}
              onChange={e => updateGearState({ desc: e.target.value })}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
            />
          </div>

          {/* Mount materials */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mount Materials</label>
            <select
              value={gearState.mountMat}
              onChange={e => updateGearState({ mountMat: parseInt(e.target.value, 10) })}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
            >
              {MOUNT_MAT_OPTIONS.map(o => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
          </div>

          {/* QTY */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={gearState.qty}
              onChange={e => updateGearState({ qty: parseInt(e.target.value, 10) || 1 })}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-24 text-right font-mono"
            />
          </div>
        </div>

        {/* NEMA 3R (disc types only) */}
        {isDisc && (
          <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
            <input
              type="checkbox"
              checked={gearState.nema3r}
              onChange={e => updateGearState({ nema3r: e.target.checked })}
              className="w-4 h-4 accent-[#1a3a5c]"
            />
            <span className="text-sm text-gray-700">
              NEMA 3R outdoor enclosure
              <span className="ml-1 text-xs text-gray-400">(+0.50 hrs)</span>
            </span>
          </label>
        )}

        {/* Fuse install (disc_f only) */}
        {isFusedD && (
          <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
            <input
              type="checkbox"
              checked={gearState.fuseInstall}
              onChange={e => updateGearState({ fuseInstall: e.target.checked })}
              className="w-4 h-4 accent-[#1a3a5c]"
            />
            <span className="text-sm text-gray-700">
              Fuse install labor
              <span className="ml-1 text-xs text-gray-400">(+0.25 hrs, fuses per quote)</span>
            </span>
          </label>
        )}

        {/* Difficulty */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Difficulty</p>
          <div className="flex gap-2 flex-wrap">
            {DIFF_OPTIONS.map(d => (
              <button
                key={d.value}
                onClick={() => updateGearState({ diff: d.value })}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  gearState.diff === d.value
                    ? 'bg-[#1a3a5c] text-white border-[#1a3a5c]'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#1a3a5c]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleAdd}
          className="px-4 py-2 text-sm font-semibold rounded bg-[#1a3a5c] text-white hover:bg-[#2e5a8c] transition-colors"
        >
          + Add to Bid
        </button>
      </div>

      {/* ── LIVE PREVIEW ────────────────────────────────────────────────────── */}
      {preview && (
        <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
            Preview — {preview.label}
          </div>
          <table className="w-full text-xs mb-2">
            <thead>
              <tr className="text-gray-400 font-semibold border-b border-gray-100">
                <th className="text-left pb-1 pr-2">Item</th>
                <th className="text-right pb-1 w-10">Qty</th>
                <th className="text-left pb-1 w-10 pl-1">Unit</th>
                <th className="text-right pb-1 w-24">Mat $</th>
                <th className="text-right pb-1 w-16">Hrs</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.map((line, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-0.5 pr-2 text-gray-700">{line.name}</td>
                  <td className="py-0.5 text-right text-gray-500">{line.qty}</td>
                  <td className="py-0.5 text-gray-500 pl-1">{line.unit}</td>
                  <td className="py-0.5 text-right font-mono text-gray-600">
                    {line.mat > 0 ? fmt$(line.mat) : '—'}
                  </td>
                  <td className="py-0.5 text-right font-mono text-gray-600">
                    {line.lab > 0 ? (line.lab / R.labor).toFixed(2) + 'h' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-[#1a3a5c]">
                <td className="py-1 text-gray-700" colSpan={3}>Total</td>
                <td className="py-1 text-right font-mono">{fmt$(preview.mat)}</td>
                <td className="py-1 text-right font-mono">
                  {(preview.lab / R.labor).toFixed(2)}h
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="text-xs text-gray-400">
            Combined: {fmt$(preview.mat + preview.lab)}
          </div>
        </div>
      )}

      {/* ── SAVED GEAR LIST ──────────────────────────────────────────────────── */}
      {state.savedGear.length > 0 && (
        <div className="bg-white rounded border border-gray-200 p-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
            Added to Bid ({state.savedGear.length})
          </div>
          {state.savedGear.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0"
            >
              <span className="flex-1 text-sm text-gray-800 truncate">{item.label}</span>
              <span className="font-mono text-xs text-gray-500 shrink-0">{fmt$(item.mat)}</span>
              <span className="font-mono text-xs text-gray-500 shrink-0">
                {(item.lab / R.labor).toFixed(2)}h
              </span>
              <button
                onClick={() => removeAssembly('savedGear', idx)}
                className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors shrink-0"
              >
                × Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
