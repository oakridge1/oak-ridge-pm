// Plain node tests for lib/estimator/ridgeSync.ts (needs Node 22.6+ type stripping).
// Run: node scripts/test-ridge-sync.mjs
import assert from 'node:assert/strict';
import { compareRidgeTally } from '../lib/estimator/ridgeSync.ts';

const asm = (label, extra = {}) => ({ label, mat: 1, lab: 1, lines: [], ...extra });
const placed = (label) => asm(label, { fromPdf: true, pdfLabel: label });
const row = (rows, label) => rows.find((r) => r.label === label);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log('ok -', name); };

test('add: PDF has more than estimate', () => {
  const rows = compareRidgeTally({ Duplex: 12 }, [asm('Duplex'), ...Array(10).fill(0).map(() => placed('Duplex'))]);
  assert.deepEqual(row(rows, 'Duplex'), { label: 'Duplex', pdfCount: 12, estimateCount: 10, action: 'add', diff: 2, hasSourceAssembly: true });
});

test('remove: PDF has fewer than estimate', () => {
  const rows = compareRidgeTally({ Duplex: 1 }, [asm('Duplex'), placed('Duplex'), placed('Duplex'), placed('Duplex')]);
  const r = row(rows, 'Duplex');
  assert.equal(r.action, 'remove');
  assert.equal(r.diff, 2);
  assert.equal(r.estimateCount, 3);
});

test('equal: counts match', () => {
  const rows = compareRidgeTally({ Duplex: 2 }, [asm('Duplex'), placed('Duplex'), placed('Duplex')]);
  const r = row(rows, 'Duplex');
  assert.equal(r.action, 'equal');
  assert.equal(r.diff, 0);
});

test('label with no source assembly', () => {
  const rows = compareRidgeTally({ Ghost: 3 }, [asm('Duplex')]);
  const r = row(rows, 'Ghost');
  assert.equal(r.hasSourceAssembly, false);
  assert.equal(r.action, 'add');
  assert.equal(r.diff, 3);
});

test('flagged copies whose source is gone still get a row (remove, no source)', () => {
  const rows = compareRidgeTally({}, [placed('Gone'), placed('Gone')]);
  assert.deepEqual(row(rows, 'Gone'), { label: 'Gone', pdfCount: 0, estimateCount: 2, action: 'remove', diff: 2, hasSourceAssembly: false });
});

test('unflagged assemblies are never counted', () => {
  const rows = compareRidgeTally({ Duplex: 2 }, [asm('Duplex'), asm('Duplex'), asm('Duplex')]);
  const r = row(rows, 'Duplex');
  assert.equal(r.estimateCount, 0);
  assert.equal(r.action, 'add');
  assert.equal(r.diff, 2);
  assert.equal(r.hasSourceAssembly, true);
});

test('old estimate with no flags: every PDF label is an add, nothing else', () => {
  const rows = compareRidgeTally({ A: 1, B: 4 }, [asm('A'), asm('B'), asm('C')]);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.estimateCount === 0 && r.action === 'add'));
});

test('empty tally and no flagged copies gives no rows', () => {
  assert.deepEqual(compareRidgeTally({}, [asm('A')]), []);
});

test('bad counts (negative, NaN, fractional) are handled; inputs are not mutated', () => {
  const tally = { A: -2, B: NaN, C: 2.9 };
  const asms = [asm('C')];
  const rows = compareRidgeTally(tally, asms);
  assert.equal(row(rows, 'A').pdfCount, 0);
  assert.equal(row(rows, 'B').pdfCount, 0);
  assert.equal(row(rows, 'C').pdfCount, 2);
  assert.deepEqual(tally, { A: -2, B: NaN, C: 2.9 });
  assert.equal(asms.length, 1);
});

console.log(`\n${n} tests passed`);
