'use client';

import { useState, useMemo } from 'react';
import { useEstimatorContext } from '@/lib/estimator/EstimatorContext';
import { getRates, applyMarkup, N5, N6 } from '@/lib/estimator/constants';
import type { AssemblyLine, SavedAssembly } from '@/lib/estimator/constants';
import { getBomItem } from '@/lib/estimator/bom';

// ── Format helper ──────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Assembly definition types ──────────────────────────────────────────────────

interface DeviceAsmDef {
  id:    string;
  grp:   'Device';
  lbl:   string;
  devId: string;
  plId:  string;
  aHr:   number;
  wId:   string;
  wFt:   number;
}

interface FixtureAsmDef {
  id:    string;
  grp:   'Fixture';
  lbl:   string;
  fixId: string;
  iHr:   number;
}

type AsmDef = DeviceAsmDef | FixtureAsmDef;

// ── Assembly definitions ───────────────────────────────────────────────────────

const ASMS: AsmDef[] = [
  // ── DEVICES ──────────────────────────────────────────────────────────────────
  { id:'r20',    grp:'Device',  lbl:'20A Receptacle',           devId:'d1',  plId:'dp1', aHr:N6.r20,      wId:'w1',  wFt:20 },
  { id:'r15',    grp:'Device',  lbl:'15A TR Receptacle',        devId:'d2',  plId:'dp1', aHr:N6.r15,      wId:'w1',  wFt:20 },
  { id:'gfci20', grp:'Device',  lbl:'20A GFCI Receptacle',      devId:'d3',  plId:'dp1', aHr:N6.gf20,     wId:'w1',  wFt:20 },
  { id:'gfci15', grp:'Device',  lbl:'15A TR GFCI Receptacle',   devId:'d4',  plId:'dp1', aHr:N6.gf15,     wId:'w1',  wFt:20 },
  { id:'sw1p',   grp:'Device',  lbl:'Single Pole Switch',       devId:'d5',  plId:'dp2', aHr:N6.sw20,     wId:'w11', wFt:20 },
  { id:'sw3way', grp:'Device',  lbl:'3-Way Switch',             devId:'d7',  plId:'dp2', aHr:N6.sw3,      wId:'w11', wFt:20 },
  { id:'sw4way', grp:'Device',  lbl:'4-Way Switch',             devId:'d8',  plId:'dp2', aHr:N6.sw4,      wId:'w11', wFt:20 },
  { id:'dim',    grp:'Device',  lbl:'Dimmer (AYCL)',             devId:'d9',  plId:'dp2', aHr:N6.dim,      wId:'w11', wFt:20 },
  { id:'dim010', grp:'Device',  lbl:'0-10V Dimmer (Lutron)',     devId:'d14', plId:'dp2', aHr:N6.dim010,   wId:'w11', wFt:20 },
  { id:'occ1',   grp:'Device',  lbl:'Occupancy Sensor Ceiling',  devId:'d15', plId:'dp2', aHr:N6.occ_ceil, wId:'w1',  wFt:20 },
  { id:'usb1',   grp:'Device',  lbl:'USB Receptacle',           devId:'d16', plId:'dp1', aHr:0.90,        wId:'w1',  wFt:20 },

  // ── FIXTURES ─────────────────────────────────────────────────────────────────
  { id:'tb24',     grp:'Fixture', lbl:'2×4 LED Lay-In T-Bar',       fixId:'lc1',  iHr:N5.tbar24_led   },
  { id:'tb22',     grp:'Fixture', lbl:'2×2 LED Lay-In T-Bar',       fixId:'lc2',  iHr:N5.tbar22_led   },
  { id:'st48',     grp:'Fixture', lbl:'4ft LED Strip Surface',       fixId:'lc5',  iHr:N5.strip48_led  },
  { id:'st96',     grp:'Fixture', lbl:'8ft LED Strip Surface',       fixId:'lc6',  iHr:N5.strip96_led  },
  { id:'vt48',     grp:'Fixture', lbl:'4ft Vapor Tight / Wrap',      fixId:'lc5',  iHr:N5.vap48_led    },
  { id:'vt96',     grp:'Fixture', lbl:'8ft Vapor Tight / Wrap',      fixId:'lc6',  iHr:N5.vap96_led    },
  { id:'hbay',     grp:'Fixture', lbl:'High Bay LED Round (UFO)',     fixId:'lc8',  iHr:N5.highbay_ufo  },
  { id:'hbay_lin', grp:'Fixture', lbl:'Linear High Bay LED',          fixId:'lc8',  iHr:N5.highbay_lin  },
  { id:'lowbay',   grp:'Fixture', lbl:'Low Bay LED',                  fixId:'lc8',  iHr:N5.lowbay_led   },
  { id:'pendant',  grp:'Fixture', lbl:'Pendant / Hanging Fixture',    fixId:'lc9',  iHr:N5.pendant_led  },
  { id:'ewp',      grp:'Fixture', lbl:'LED Wall Pack',                fixId:'lc10', iHr:N5.wallpack_led },
  { id:'sconce',   grp:'Fixture', lbl:'Wall Mount Indoor Sconce',     fixId:'lc9',  iHr:N5.sconce_led   },
  { id:'ch48',     grp:'Fixture', lbl:'Chain-Hung Industrial 48"',    fixId:'lc7',  iHr:N5.chain48_led  },
  { id:'ch96',     grp:'Fixture', lbl:'Chain-Hung Industrial 96"',    fixId:'lc7',  iHr:N5.chain96_led  },
  { id:'exit',     grp:'Fixture', lbl:'Exit / EBU Combo',             fixId:'lc12', iHr:N5.exit_surf    },
  { id:'emrg',     grp:'Fixture', lbl:'Emergency Light Only',         fixId:'lc13', iHr:N5.emerg_dual   },
  { id:'fan36',    grp:'Fixture', lbl:'Ceiling Fan 36"',              fixId:'lc14', iHr:N5.fan36        },
  { id:'fan48',    grp:'Fixture', lbl:'Ceiling Fan 48"',              fixId:'lc15', iHr:N5.fan48        },
  { id:'fan55',    grp:'Fixture', lbl:'Ceiling Fan 55"',              fixId:'lc15', iHr:N5.fan55        },
  { id:'fan60',    grp:'Fixture', lbl:'Ceiling Fan 60"',              fixId:'lc15', iHr:N5.fan60        },
];

const WHIP_OPTIONS = [
  { v: 0,  l: 'No whip' },
  { v: 10, l: '10ft'    },
  { v: 15, l: '15ft'    },
  { v: 20, l: '20ft'    },
  { v: 25, l: '25ft'    },
  { v: 35, l: '35ft'    },
];

const DIFF_OPTIONS = [
  { label: 'Normal',      value: 1.00 },
  { label: 'Difficult',   value: 1.25 },
  { label: 'V.Difficult', value: 1.55 },
];

// Fixtures that require a wall/surface box
const NEEDS_BOX_IDS = new Set(['sconce', 'ewp', 'exit', 'emrg', 'pendant']);

// ── Core assembly builder ──────────────────────────────────────────────────────

function buildFixtureAsm(
  asm:     AsmDef,
  whipFt:  number,
  qty:     number,
  twoGang: boolean,
  romex:   boolean,
  diff:    number,
): SavedAssembly {
  const R = getRates();
  const lines: AssemblyLine[] = [];
  let mat = 0, lab = 0;

  function addI(id: string, q: number, label?: string) {
    if (q <= 0) return;
    try {
      const item = getBomItem(id);
      const m = applyMarkup(item.mat * q, item.mk);
      const l = item.lhr * q * R.labor;
      mat += m; lab += l;
      lines.push({ name: label ?? item.name, qty: q, unit: item.unit, mat: m, lab: l });
    } catch {
      // BOM item missing — add a zero-cost placeholder
      lines.push({ name: label ?? `[${id}]`, qty: q, unit: 'EA', mat: 0, lab: 0 });
    }
  }

  const q = twoGang ? qty * 2 : qty;  // effective device quantity

  if (asm.grp === 'Device') {
    // ── Whip cable ────────────────────────────────────────────────────
    if (whipFt > 0) {
      const cableId = romex ? 'rm2' : asm.wId;
      addI(cableId, whipFt * qty,
        `${romex ? '12/2 NM-B' : '12/2 MC'} whip (${whipFt}ft x${qty})`);
      if (!romex) {
        addI('mc1', qty, 'MC connector x2');
      } else {
        const staples = Math.ceil(whipFt / 4) * qty + 2 * qty;
        addI('rm4', staples, `NM-B staples (${staples})`);
      }
    }
    // ── Box hardware ──────────────────────────────────────────────────
    if (romex) {
      addI('b7',  qty, 'nail-on box');
    } else {
      addI('b1',  qty, '4" square deep box');
      addI('bs1', qty, 'C23 bracket');
      addI('mr1', qty, 'SG mud ring');
      addI('bs2', 2 * qty, 'CJ6 x2');
    }
    // ── Device + plate + hardware ─────────────────────────────────────
    addI(asm.devId, q, asm.lbl);
    if (twoGang) addI('dp3', qty,  '2-gang plate');
    else         addI(asm.plId, qty, 'cover plate');
    addI('wc1', 4 * qty, 'wire nuts x4');
    addI('gr1',     qty, 'ground screw');
    // ── Device install labor ──────────────────────────────────────────
    const labCost = asm.aHr * q * diff * R.labor;
    lab += labCost;
    lines.push({ name: 'Device install labor', qty: q, unit: 'EA', mat: 0, lab: labCost });

  } else {
    // ── Fixture ───────────────────────────────────────────────────────
    addI(asm.fixId, qty, `${asm.lbl} — PER QUOTE`);
    // Whip cable
    if (whipFt > 0) {
      addI('w1',  whipFt * qty, `12/2 MC whip (${whipFt}ft x${qty})`);
      addI('mc1', 2 * qty,      'MC connector x2');
    }
    // Box hardware (wall / surface-mount fixtures only)
    if (NEEDS_BOX_IDS.has(asm.id)) {
      addI('b1',  qty, '4" square deep box');
      addI('bs1', qty, 'C23 bracket');
      addI('mr1', qty, 'SG mud ring');
      addI('bs2', 2 * qty, 'CJ6 x2');
    }
    // Fixture install labor
    const fixLabCost = asm.iHr * qty * diff * R.labor;
    lab += fixLabCost;
    lines.push({
      name: `Fixture install labor (${asm.iHr}hr x${qty})`,
      qty, unit: 'EA', mat: 0, lab: fixLabCost,
    });
  }

  return {
    label: `${asm.lbl} x${q}` + (romex ? ' [Romex]' : ''),
    mat,
    lab,
    lines,
  };
}

// ── FixtureBuilderTab ──────────────────────────────────────────────────────────

export function FixtureBuilderTab() {
  const { state, setState } = useEstimatorContext();
  const R = getRates();

  // Local form state
  const [selectedId, setSelectedId] = useState<string>('r20');
  const [whipFt,     setWhipFt]     = useState<number>(20);
  const [qty,        setQty]        = useState<number>(1);
  const [twoGang,    setTwoGang]    = useState<boolean>(false);
  const [romex,      setRomex]      = useState<boolean>(false);
  const [diff,       setDiff]       = useState<number>(1.00);

  const selectedAsm = ASMS.find(a => a.id === selectedId) ?? ASMS[0];
  const isDevice    = selectedAsm.grp === 'Device';

  // When the assembly type changes, reset toggles and update whip default
  function handleAsmChange(id: string) {
    setSelectedId(id);
    const asm = ASMS.find(a => a.id === id);
    if (!asm) return;
    setTwoGang(false);
    setRomex(false);
    if (asm.grp === 'Device') {
      setWhipFt(asm.wFt);
    } else {
      setWhipFt(0);
    }
  }

  // Live preview
  const preview = useMemo(
    () => buildFixtureAsm(selectedAsm, whipFt, qty, twoGang, romex, diff),
    [selectedAsm, whipFt, qty, twoGang, romex, diff],
  );

  // Add to bid
  function handleAdd() {
    const asm = buildFixtureAsm(selectedAsm, whipFt, qty, twoGang, romex, diff);
    setState(s => ({ ...s, asms: [...s.asms, asm] }));
  }

  return (
    <div className="max-w-3xl">

      {/* ── BUILDER FORM ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-4 shadow-sm">
        <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
          Fixture &amp; Device Builder
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">

          {/* Assembly selector */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Assembly Type</label>
            <select
              value={selectedId}
              onChange={e => handleAsmChange(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
            >
              <optgroup label="Devices">
                {ASMS.filter(a => a.grp === 'Device').map(a => (
                  <option key={a.id} value={a.id}>{a.lbl}</option>
                ))}
              </optgroup>
              <optgroup label="Fixtures">
                {ASMS.filter(a => a.grp === 'Fixture').map(a => (
                  <option key={a.id} value={a.id}>{a.lbl}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Whip length */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Whip Length</label>
            <select
              value={whipFt}
              onChange={e => setWhipFt(parseInt(e.target.value, 10))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full"
            >
              {WHIP_OPTIONS.map(o => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white w-full text-right font-mono"
            />
          </div>
        </div>

        {/* Device-only toggles */}
        {isDevice && (
          <div className="flex flex-wrap gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={twoGang}
                onChange={e => setTwoGang(e.target.checked)}
                className="w-4 h-4 accent-[#1a3a5c]"
              />
              <span className="text-sm text-gray-700">
                2-gang
                <span className="ml-1 text-xs text-gray-400">(doubles device qty)</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={romex}
                onChange={e => setRomex(e.target.checked)}
                className="w-4 h-4 accent-[#1a3a5c]"
              />
              <span className="text-sm text-gray-700">
                Romex / residential
                <span className="ml-1 text-xs text-gray-400">(NM-B cable + nail-on box)</span>
              </span>
            </label>
          </div>
        )}

        {/* Difficulty */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Difficulty</p>
          <div className="flex gap-2 flex-wrap">
            {DIFF_OPTIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setDiff(d.value)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  diff === d.value
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

      {/* ── SAVED FIXTURES/DEVICES LIST ──────────────────────────────────────── */}
      {state.asms.length > 0 && (
        <div className="bg-white rounded border border-gray-200 p-4 shadow-sm">
          <div className="text-xs font-bold tracking-widest uppercase text-[#1a3a5c] border-b border-gray-200 pb-1 mb-3">
            Added to Bid ({state.asms.length})
          </div>
          {state.asms.map((item, idx) => (
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
                onClick={() => setState(s => ({
                  ...s, asms: s.asms.filter((_, i) => i !== idx),
                }))}
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
