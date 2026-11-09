// Plain node tests: Data builder quantity (N identical outlets).
// Run: node scripts/test-data-qty.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);

const { calcData } = await import('../lib/estimator/calc.ts');

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const A = { ports: 2, emtDrop: false, support: 'J-Hook Small', feet: 100, makeup: 10, patchPanel: 'none', diff: 1.0 };
const B = { ports: 4, emtDrop: true, support: 'J-Hook Large', feet: 63, makeup: 5, patchPanel: 'medium', diff: 1.25 };

// Output of calcData BEFORE the qty change (captured from main), default rates.
const GOLD = {
  A: {
    label: '2-port Cat6 — 100ft — J-Hook Small', mat: 227.55227599999998, lab: 238.21,
    lines: [
      ['Cat6 (220ft)', 220, 71.61, 91.3], ['Cat6 keystone x4', 4, 33.0708, 49.8],
      ['2-port keystone plate', 1, 2.15915, 6.225], ['J-hook sm (27)', 27, 117.18, 56.025],
      ['CJ6 x3 (flush mount)', 3, 2.1583905, 3.735], ['SG mud ring', 1, 1.3739355, 6.225],
      ['Cat6 termination labor (2 ports × 0.15hr)', 2, 0, 12.45], ['Data location base labor', 1, 0, 12.45],
    ],
  },
  B: {
    label: '4-port Cat6 — 63ft — J-Hook Large', mat: 575.8970595000001, lab: 368.105,
    lines: [
      ['Cat6 (280ft)', 280, 91.14, 116.2], ['Cat6 keystone x8', 8, 66.1416, 99.6],
      ['keystone plate', 1, 2.98375, 6.225], ['J-hook lg (18)', 18, 136.71, 37.35],
      ['1/2" EMT 10ft (stub)', 1, 4.942175, 9.545], ['1/2" EMT connector x2', 2, 0.878199, 6.64],
      ['1/2" strap x2', 2, 0.4774, 3.32], ['SG mud ring', 1, 1.3739355, 6.225],
      ['EMT stub field bend labor', 1, 0, 5.1875], ['patch panel', 1, 271.25, 31.125],
      ['Cat6 termination labor (4 ports × 0.15hr)', 4, 0, 31.125], ['Data location base labor', 1, 0, 15.5625],
    ],
  },
};

function sameAsGold(asm, g) {
  assert.equal(asm.label, g.label);
  close(asm.mat, g.mat, 'mat'); close(asm.lab, g.lab, 'lab');
  assert.equal(asm.lines.length, g.lines.length);
  g.lines.forEach(([name, qty, mat, lab], i) => {
    const l = asm.lines[i];
    assert.equal(l.name, name); assert.equal(l.qty, qty);
    close(l.mat, mat, `${name} mat`); close(l.lab, lab, `${name} lab`);
  });
}

await test('qty absent and qty=1 match the old output exactly (parts, footage, labor, patch panel)', () => {
  for (const [p, g] of [[A, GOLD.A], [B, GOLD.B]]) {
    sameAsGold(calcData({ ...p }), g);
    sameAsGold(calcData({ ...p, qty: 1 }), g);
  }
});

await test('bad qty (0, negative, NaN) behaves like 1', () => {
  for (const q of [0, -3, NaN, undefined]) sameAsGold(calcData({ ...A, qty: q }), GOLD.A);
});

await test('qty=3 multiplies every part and all labor by 3', () => {
  const a = calcData({ ...B, qty: 3 });
  const g = GOLD.B.lines;
  assert.equal(a.lines.length, g.length);
  // pair up by position (same order as the old output)
  g.forEach(([name, qty, mat, lab], i) => {
    const l = a.lines[i];
    if (name === 'patch panel') { assert.equal(l.name, 'patch panel'); assert.equal(l.qty, 1); close(l.mat, mat, 'pp mat'); close(l.lab, lab, 'pp lab'); return; }
    close(l.qty, qty * 3, `${name} qty`);
    close(l.mat, mat * 3, `${name} mat`);
    close(l.lab, lab * 3, `${name} lab`);
  });
});

await test('qty=3: footage stays one run (feet input and run length not x3); cable = 3 identical runs', () => {
  const a = calcData({ ...A, qty: 3 });
  assert.match(a.label, /100ft/);            // per-outlet footage, not 300ft
  assert.ok(!/300ft/.test(a.label));
  const cable = a.lines[0];
  assert.equal(cable.qty, 220 * 3);          // each run still rounded to 10ft (220), then x3
  assert.match(cable.name, /220ft × 3 = 660ft/);
  // support count is per run x3 (27 per run)
  assert.equal(a.lines.find((l) => l.name.startsWith('J-hook')).qty, 27 * 3);
});

await test('qty=3: patch panel stays once per assembly', () => {
  const a = calcData({ ...B, qty: 3 });
  const pp = a.lines.filter((l) => l.name === 'patch panel');
  assert.equal(pp.length, 1);
  assert.equal(pp[0].qty, 1);
  close(pp[0].mat, 271.25, 'pp mat');
});

await test('qty>1 label shows x N; qty=1 label has no suffix', () => {
  assert.ok(calcData({ ...A, qty: 4 }).label.endsWith(' × 4'));
  assert.ok(!calcData({ ...A, qty: 1 }).label.includes('×'));
});

await test('totals: qty=3 assembly = 3x qty=1 minus 2x the patch panel', () => {
  const one = calcData({ ...B, qty: 1 }), three = calcData({ ...B, qty: 3 });
  const pp = one.lines.find((l) => l.name === 'patch panel');
  close(three.mat, 3 * one.mat - 2 * pp.mat, 'mat');
  close(three.lab, 3 * one.lab - 2 * pp.lab, 'lab');
});

await test('wiring: takeoff Build for data passes the takeoff qty; builder has a Quantity input; default qty is 1', async () => {
  const { readFile } = await import('node:fs/promises');
  const rd = (p) => readFile(new URL(p, import.meta.url), 'utf8');
  const take = await rd('../components/estimator/TakeoffTab.tsx');
  assert.match(take, /updateDataState\(\{ ports: ITEM_BUILD\[id\]\.ports as \(1 \| 2 \| 3 \| 4\), qty: Math\.max\(1, Math\.round\(qty\)\) \}\)/);
  // same expression with qty 4 -> 4
  assert.equal(Math.max(1, Math.round(4)), 4);
  const builder = await rd('../components/estimator/DataBuilder.tsx');
  assert.match(builder, /Quantity/);
  assert.match(builder, /updateDataState\(\{ qty:/);
  const state = await rd('../lib/estimator/state.ts');
  assert.match(state, /DEFAULT_DATA[\s\S]{0,200}qty: 1/);
});

console.log(`\n${n} tests passed`);
