// Plain node tests for lib/estimator/adders.ts (needs Node 22.6+ type stripping).
// Run: node scripts/test-adders.mjs
import assert from 'node:assert/strict';
import { computeAdders, cleanAmount } from '../lib/estimator/adders.ts';

const R = { bulk: 0.085, overhead: 0.10, profit: 0.12 };
const base = { matTotal: 10000, effectiveLaborTotal: 5000, subtotal: 17000 };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const row = (p, k) => p.rows.find((r) => r.key === k);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('zero / empty inputs add nothing', () => {
  for (const inputs of [{}, { fittingsPct: 0, nonProdPct: 0, liftQty: 0, liftRate: 0, tempPower: 0 }, { fittingsPct: '', liftQty: '', tempPower: '' }]) {
    const p = computeAdders(base, inputs, R);
    assert.equal(p.totalAdd, 0);
    assert.equal(p.totalGrandChange, 0);
    assert.equal(p.newSubtotal, base.subtotal);
    assert.equal(p.rows.length, 4);
  }
});

test('fittings alone: % of material, then profit only', () => {
  const p = computeAdders(base, { fittingsPct: 3 }, R);
  close(row(p, 'fittings').wouldAdd, 300, 'add');
  close(row(p, 'fittings').grandChange, 300 * 1.12, 'grand');
  close(p.totalAdd, 300, 'total');
});

test('non-productive alone: % of effective labor, then overhead, then profit', () => {
  const p = computeAdders(base, { nonProdPct: 10 }, R);
  close(row(p, 'nonProd').wouldAdd, 500 * 1.10, 'add');
  close(row(p, 'nonProd').grandChange, 500 * 1.10 * 1.12, 'grand');
});

test('lift alone: qty x rate x 1.085 bulk markup, then profit; unit is a label only', () => {
  const a = computeAdders(base, { liftQty: 2, liftRate: 800, liftUnit: 'weeks' }, R);
  const b = computeAdders(base, { liftQty: 2, liftRate: 800, liftUnit: 'days' }, R);
  close(row(a, 'lift').wouldAdd, 1600 * 1.085, 'add');
  close(row(a, 'lift').grandChange, 1600 * 1.085 * 1.12, 'grand');
  assert.deepEqual(a, b);
});

test('temp power alone: lump sum, then profit only (no markup)', () => {
  const p = computeAdders(base, { tempPower: 1500 }, R);
  close(row(p, 'tempPower').wouldAdd, 1500, 'add');
  close(row(p, 'tempPower').grandChange, 1500 * 1.12, 'grand');
});

test('all together: totals are the sums; new subtotal = subtotal + adds', () => {
  const p = computeAdders(base, { fittingsPct: 2, nonProdPct: 5, liftQty: 3, liftRate: 200, tempPower: 1000 }, R);
  const add = 200 + 250 * 1.10 + 600 * 1.085 + 1000;
  close(p.totalAdd, add, 'totalAdd');
  close(p.totalGrandChange, add * 1.12, 'grand');
  close(p.newSubtotal, 17000 + add, 'newSubtotal');
});

test('design fee on the displayed grand total scales the change', () => {
  const p = computeAdders(base, { tempPower: 1000 }, { ...R, designFeePct: 5 });
  close(p.totalGrandChange, 1000 * 1.12 * 1.05, 'grand');
  close(p.totalAdd, 1000, 'add unchanged');
});

test('bad inputs count as 0: blank, text, negative, NaN, Infinity, null', () => {
  for (const bad of ['', '  ', 'abc', '-5', -5, NaN, Infinity, null, undefined]) {
    assert.equal(cleanAmount(bad), 0, `input ${String(bad)}`);
  }
  const p = computeAdders(base, { fittingsPct: 'abc', nonProdPct: -10, liftQty: -2, liftRate: 100, tempPower: NaN }, R);
  assert.equal(p.totalAdd, 0);
  assert.equal(p.totalGrandChange, 0);
});

test('a bad lift qty or rate zeroes only the lift row', () => {
  const p = computeAdders(base, { fittingsPct: 1, liftQty: 'x', liftRate: 500 }, R);
  assert.equal(row(p, 'lift').wouldAdd, 0);
  close(row(p, 'fittings').wouldAdd, 100, 'fittings still counts');
});

test('numeric strings from form fields work', () => {
  const p = computeAdders(base, { fittingsPct: '2.5', tempPower: ' 400 ' }, R);
  close(row(p, 'fittings').wouldAdd, 250, 'fittings');
  close(row(p, 'tempPower').wouldAdd, 400, 'temp');
});

test('does not change its inputs', () => {
  const b = { ...base }; const i = { fittingsPct: 3, liftQty: 1, liftRate: 1 }; const r = { ...R };
  const snap = JSON.stringify([b, i, r]);
  computeAdders(b, i, r);
  assert.equal(JSON.stringify([b, i, r]), snap);
});

test('missing or non-finite base values are treated as 0', () => {
  const p = computeAdders({ matTotal: NaN, effectiveLaborTotal: undefined, subtotal: NaN }, { fittingsPct: 5, nonProdPct: 5, tempPower: 100 }, R);
  close(p.totalAdd, 100, 'only temp power');
  assert.equal(p.newSubtotal, 100);
});

console.log(`\n${n} tests passed`);
