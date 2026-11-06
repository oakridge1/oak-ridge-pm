// Plain node tests for lib/estimator/dropsPreview.ts (needs Node 22.6+ type stripping).
// Run: node scripts/test-drops-preview.mjs
import assert from 'node:assert/strict';
import {
  computeDropsPreview, dropTotals, includedWhipFtEach, assemblyDeviceQty, findMatchingAssembly,
  parseRidgeTally, NO_MATCH_REASON, NO_WHIP_REASON,
} from '../lib/estimator/dropsPreview.ts';

const whip = (ft, qty, unit = 'FT') => ({ name: `12/2 MC whip (${ft}ft x${qty})`, qty: ft * qty, unit, mat: 1, lab: 0 });
const other = (name, qty = 1, unit = 'EA') => ({ name, qty, unit, mat: 1, lab: 0 });
const asm = (label, lines, extra = {}) => ({ label, mat: 1, lab: 1, lines, ...extra });
const row = (p, label) => p.rows.find((r) => r.label === label);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('whip parsing: 1 device, 20 ft', () => {
  assert.equal(includedWhipFtEach(asm('20A Receptacle x1', [whip(20, 1), other('box')])), 20);
});

test('whip parsing: feet divided by the device count in the line name', () => {
  assert.equal(includedWhipFtEach(asm('20A Receptacle x3', [whip(20, 3)])), 20);
  assert.equal(includedWhipFtEach(asm('Fan x4', [whip(15, 4)])), 15);
});

test('whip parsing: uses the label quantity when the line name has none', () => {
  const lines = [{ name: '12/2 MC whip', qty: 60, unit: 'FT', mat: 1, lab: 0 }];
  assert.equal(includedWhipFtEach(asm('20A Receptacle x3', lines)), 20);
  assert.equal(includedWhipFtEach(asm('Dimmer ×2 [Romex]', [{ name: 'NM whip', qty: 30, unit: 'FT', mat: 1, lab: 0 }])), 15);
  assert.equal(includedWhipFtEach(asm('High-amp recept — 6-50R — 25ft whip — 2ea', [{ name: 'whip cable', qty: 50, unit: 'FT', mat: 1, lab: 0 }])), 25);
});

test('whip parsing: no quantity anywhere means 1 device', () => {
  assert.equal(includedWhipFtEach(asm('Odd thing', [{ name: 'whip', qty: 12, unit: 'FT', mat: 1, lab: 0 }])), 12);
});

test('several whip lines are added together (MC home run: feed + load)', () => {
  const lines = [
    { name: '#12/2 MC whip — feed side (20ft)', qty: 20, unit: 'FT', mat: 1, lab: 0 },
    { name: '#12/2 MC whip — load side (20ft)', qty: 20, unit: 'FT', mat: 1, lab: 0 },
  ];
  assert.equal(includedWhipFtEach(asm('MC home run', lines)), 40);
});

test('missing whip: no whip line, wrong unit, zero qty, or name without "whip" all return null', () => {
  assert.equal(includedWhipFtEach(asm('Panel', [other('breaker'), other('12/2 MC per ft', 40, 'FT')])), null);
  assert.equal(includedWhipFtEach(asm('X', [whip(20, 1, 'EA')])), null);
  assert.equal(includedWhipFtEach(asm('X', [{ name: 'whip', qty: 0, unit: 'FT', mat: 0, lab: 0 }])), null);
  assert.equal(includedWhipFtEach(asm('X', [])), null);
  assert.equal(includedWhipFtEach({ label: 'X', mat: 0, lab: 0 }), null);
});

test('unit match is case-insensitive', () => {
  assert.equal(includedWhipFtEach(asm('X x1', [whip(10, 1, 'ft')])), 10);
});

test('preview rows: placed, matching assembly and whip each; totals add up', () => {
  const asms = [asm('20A Receptacle x1', [whip(20, 1)]), asm('Fixture x1', [whip(10, 1)])];
  const p = computeDropsPreview({ '20A Receptacle x1': 12, 'Fixture x1': 4 }, asms);
  assert.equal(row(p, '20A Receptacle x1').whipFtEach, 20);
  assert.equal(row(p, '20A Receptacle x1').placed, 12);
  assert.equal(row(p, '20A Receptacle x1').reason, null);
  assert.equal(p.totalDevices, 16);
  assert.equal(p.totalWhipFt, 12 * 20 + 4 * 10);
});

test('label with no matching assembly: null whip and a plain reason, not in totals', () => {
  const p = computeDropsPreview({ Ghost: 5 }, [asm('Other', [whip(20, 1)])]);
  const r = row(p, 'Ghost');
  assert.equal(r.assembly, null);
  assert.equal(r.whipFtEach, null);
  assert.equal(r.reason, NO_MATCH_REASON);
  assert.equal(p.totalDevices, 0);
  assert.equal(p.totalWhipFt, 0);
});

test('assembly without a whip line: null whip, "No whip line found", not in totals', () => {
  const p = computeDropsPreview({ 'Panel x1': 2, 'Recep x1': 3 }, [asm('Panel x1', [other('breaker')]), asm('Recep x1', [whip(20, 1)])]);
  assert.equal(row(p, 'Panel x1').reason, NO_WHIP_REASON);
  assert.equal(row(p, 'Panel x1').whipFtEach, null);
  assert.equal(p.totalDevices, 3);
  assert.equal(p.totalWhipFt, 60);
});

test('matching prefers an unflagged assembly; falls back to a PDF copy', () => {
  const original = asm('A', [whip(20, 1)]);
  const copy = asm('A', [whip(30, 1)], { fromPdf: true, pdfLabel: 'A' });
  assert.equal(findMatchingAssembly([copy, original], 'A'), original);
  assert.equal(findMatchingAssembly([copy], 'A'), copy);
  assert.equal(findMatchingAssembly([], 'A'), null);
});

test('PDF copies in the estimate do not change the per-device whip', () => {
  const original = asm('A x1', [whip(20, 1)]);
  const copy = asm('A x1', [whip(20, 1)], { fromPdf: true, pdfLabel: 'A x1' });
  const p = computeDropsPreview({ 'A x1': 3 }, [original, copy, copy, copy]);
  assert.equal(row(p, 'A x1').whipFtEach, 20);
  assert.equal(p.totalWhipFt, 60);
});

test('bad counts are ignored (zero, negative, NaN) and fractions round down', () => {
  const p = computeDropsPreview({ A: 0, B: -2, C: NaN, D: 2.9 }, [asm('D', [whip(10, 1)])]);
  assert.deepEqual(p.rows.map((r) => r.label), ['D']);
  assert.equal(row(p, 'D').placed, 2);
});

test('what-if overrides change the totals only; the rows and inputs are untouched', () => {
  const asms = [asm('A x1', [whip(20, 1)])];
  const p = computeDropsPreview({ 'A x1': 10 }, asms);
  const snapshot = JSON.stringify([p, asms]);
  assert.deepEqual(dropTotals(p.rows, { 'A x1': 12 }), { totalDevices: 10, totalWhipFt: 120 });
  assert.deepEqual(dropTotals(p.rows, { 'A x1': 0 }), { totalDevices: 10, totalWhipFt: 0 });
  assert.deepEqual(dropTotals(p.rows, { 'A x1': -5 }), { totalDevices: 10, totalWhipFt: 200 }); // invalid -> default
  assert.deepEqual(dropTotals(p.rows, { 'A x1': NaN }), { totalDevices: 10, totalWhipFt: 200 });
  assert.deepEqual(dropTotals(p.rows, { Other: 99 }), { totalDevices: 10, totalWhipFt: 200 });
  assert.equal(JSON.stringify([p, asms]), snapshot);
});

test('an override on a row without a whip is ignored', () => {
  const p = computeDropsPreview({ Ghost: 4 }, []);
  assert.deepEqual(dropTotals(p.rows, { Ghost: 10 }), { totalDevices: 0, totalWhipFt: 0 });
});

test('empty tally gives an empty preview', () => {
  assert.deepEqual(computeDropsPreview({}, [asm('A', [whip(20, 1)])]), { rows: [], totalDevices: 0, totalWhipFt: 0 });
});

test('assemblyDeviceQty reads the line name first, then the label', () => {
  assert.equal(assemblyDeviceQty(asm('Thing x9', []), [{ name: 'whip (20ft x3)', qty: 60, unit: 'FT', mat: 0, lab: 0 }]), 3);
  assert.equal(assemblyDeviceQty(asm('Thing x9', []), []), 9);
  assert.equal(assemblyDeviceQty(asm('FA Smoke | wood | 35ft | ×7', []), []), 7);
  assert.equal(assemblyDeviceQty(asm('Thing', []), []), 1);
});

test('tally parsing: good data, and missing or malformed data never throws', () => {
  const t = parseRidgeTally(JSON.stringify({ estimateId: 'e1', updatedAt: '2026-11-06T12:00:00Z', counts: { A: 2, B: 0, C: 'x', D: -1 } }));
  assert.deepEqual(t, { estimateId: 'e1', updatedAt: '2026-11-06T12:00:00Z', counts: { A: 2 } });
  for (const bad of [null, undefined, '', 'not json', '[]', '{}', '{"counts":[1]}', '{"counts":"x"}', 'null', '7']) {
    assert.equal(parseRidgeTally(bad), null, `input ${JSON.stringify(bad)}`);
  }
  assert.deepEqual(parseRidgeTally('{"counts":{"A":1}}'), { estimateId: '', updatedAt: '', counts: { A: 1 } });
});

console.log(`\n${n} tests passed`);
