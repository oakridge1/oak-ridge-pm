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

// ── step 5: add / remove / mark math ──
import { findSourceAssembly, makePdfCopy, removePdfCopies, markPdfCopies, matchableCount } from '../lib/estimator/ridgeSync.ts';

test('findSourceAssembly returns the first unflagged assembly, never a PDF copy', () => {
  const lists = { savedCustomAsm: [placed('Duplex')], savedRuns: [asm('Duplex', { mat: 5 })] };
  assert.equal(findSourceAssembly(lists, 'Duplex').mat, 5);
  assert.equal(findSourceAssembly({ savedCustomAsm: [placed('Duplex')] }, 'Duplex'), undefined);
});

test('makePdfCopy flags the copy and keeps pricing and lines', () => {
  const src = asm('Duplex', { mat: 7, lab: 2, lines: [{ x: 1 }], area: 'A', params: { z: 1 }, _edited: true });
  const c = makePdfCopy(src);
  assert.equal(c.fromPdf, true);
  assert.equal(c.pdfLabel, 'Duplex');
  assert.equal(c.mat, 7);
  assert.equal(c.lab, 2);
  assert.deepEqual(c.lines, [{ x: 1 }]);
  assert.equal(c.area, 'A');
});

test('add math: adding diff copies makes the row match', () => {
  const lists = { savedRuns: [asm('Duplex')], savedCustomAsm: [placed('Duplex')] };
  const before = compareRidgeTally({ Duplex: 4 }, Object.values(lists).flat());
  assert.equal(before[0].action, 'add');
  assert.equal(before[0].diff, 3);
  const src = findSourceAssembly(lists, 'Duplex');
  for (let i = 0; i < before[0].diff; i++) lists.savedCustomAsm.push(makePdfCopy(src));
  const after = compareRidgeTally({ Duplex: 4 }, Object.values(lists).flat());
  assert.equal(after[0].action, 'equal');
  assert.equal(lists.savedRuns.length, 1);
});

test('remove never touches items that are not flagged fromPdf', () => {
  const hand = asm('Duplex');
  const lists = { savedRuns: [hand, asm('Duplex')], savedCustomAsm: [placed('Duplex'), placed('Duplex'), placed('Other')] };
  const r = removePdfCopies(lists, 'Duplex', 99);
  assert.equal(r.count, 2);
  assert.equal(r.changed.savedRuns, undefined);
  assert.deepEqual(r.changed.savedCustomAsm.map((a) => a.label), ['Other']);
  assert.equal(lists.savedRuns.length, 2);
  assert.equal(lists.savedCustomAsm.length, 3);
});

test('remove takes only what was asked, newest first, and only the matching pdfLabel', () => {
  const a1 = placed('Duplex'); const a2 = placed('Duplex'); const a3 = placed('Duplex');
  const lists = { savedCustomAsm: [a1, a2, a3, placed('Other')] };
  const r = removePdfCopies(lists, 'Duplex', 2);
  assert.equal(r.count, 2);
  assert.deepEqual(r.changed.savedCustomAsm, [a1, lists.savedCustomAsm[3]]);
});

test('remove with fewer flagged copies than asked removes only those', () => {
  const lists = { savedRuns: [asm('Duplex'), asm('Duplex')], savedCustomAsm: [placed('Duplex')] };
  const r = removePdfCopies(lists, 'Duplex', 3);
  assert.equal(r.count, 1);
  assert.equal(r.changed.savedRuns, undefined);
});

test('remove of zero or negative count does nothing', () => {
  const lists = { savedCustomAsm: [placed('Duplex')] };
  assert.equal(removePdfCopies(lists, 'Duplex', 0).count, 0);
  assert.equal(removePdfCopies(lists, 'Duplex', -3).count, 0);
});

test('mark matched flags hand-added extras but never the original', () => {
  const original = asm('Duplex');
  const lists = { savedRuns: [original], savedCustomAsm: [asm('Duplex'), asm('Duplex'), asm('Other')] };
  assert.equal(matchableCount(lists, 'Duplex'), 2);
  const r = markPdfCopies(lists, 'Duplex', 5);
  assert.equal(r.count, 2);
  assert.equal(r.changed.savedRuns, undefined);
  assert.ok(r.changed.savedCustomAsm.slice(0, 2).every((a) => a.fromPdf && a.pdfLabel === 'Duplex'));
  assert.equal(r.changed.savedCustomAsm[2].fromPdf, undefined);
  assert.equal(r.changed.savedCustomAsm.length, 3);
  assert.equal(original.fromPdf, undefined);
});

test('mark matched respects the count cap and changes no quantities', () => {
  const lists = { savedRuns: [asm('Duplex')], savedCustomAsm: [asm('Duplex'), asm('Duplex'), asm('Duplex')] };
  const r = markPdfCopies(lists, 'Duplex', 1);
  assert.equal(r.count, 1);
  const all = [...lists.savedRuns, ...r.changed.savedCustomAsm];
  assert.equal(all.length, 5 - 1);
  assert.equal(compareRidgeTally({ Duplex: 1 }, all)[0].action, 'equal');
});

test('mark matched with only the original does nothing', () => {
  const lists = { savedRuns: [asm('Duplex')] };
  assert.equal(matchableCount(lists, 'Duplex'), 0);
  assert.equal(markPdfCopies(lists, 'Duplex', 3).count, 0);
});

console.log(`\n${n} tests passed`);
