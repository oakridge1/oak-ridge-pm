// Plain node tests: live BOM cache falls back to the built-in list; isPriceNeeded rule.
// Run: node scripts/test-bom-fallback.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);

const { getBomItem, initBomCache, invalidateBomCache } = await import('../lib/estimator/bom.ts');
const { isPriceNeeded } = await import('../lib/estimator/priceNeeded.ts');
const { calcFloorBox } = await import('../lib/estimator/calc.ts');

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

const staticMnt = getBomItem('fb_mnt'); // static list (cache not loaded yet)
const staticW1 = getBomItem('w1');

// Fake the live list: a few rows, WITHOUT fb_mnt, and w1 at a different price.
async function loadLive(rows) {
  globalThis.fetch = async () => ({ ok: true, json: async () => rows });
  await initBomCache();
}
const liveRows = [
  { id: 'w1', cat: 'Wire', name: 'LIVE 12/2 MC', unit: 'FT', mat: 9.99, lhr: 0.02, mk: 'bulk' },
  { id: 'mr1', cat: 'Boxes', name: 'SG mud ring', unit: 'EA', mat: 1.23, lhr: 0.1, mk: 'bulk' },
];

await test('fb_mnt missing from live list falls back to the static row', async () => {
  await loadLive(liveRows);
  const b = getBomItem('fb_mnt');
  assert.equal(b.name, 'Floor Box Mounting Material');
  assert.equal(b.mat, 0.01);
  assert.deepEqual(b, staticMnt);
});

await test('a live row still beats the static row', async () => {
  await loadLive(liveRows);
  const b = getBomItem('w1');
  assert.equal(b.name, 'LIVE 12/2 MC');
  assert.equal(b.mat, 9.99);
  assert.notEqual(b.mat, staticW1.mat);
});

await test('an unknown id still throws (live cache and static both)', async () => {
  await loadLive(liveRows);
  assert.throws(() => getBomItem('nope_xyz'), /BOM item not found/);
  invalidateBomCache();
  assert.throws(() => getBomItem('nope_xyz'), /BOM item not found/);
});

await test('wood floor box with live cache lacking fb_mnt: no MISSING BOM line, mount line flagged', async () => {
  await loadLive(liveRows);
  const a = calcFloorBox({ floorType: 'wood', gangs: 2, qty: 1, quoted: true, diff: 1.0 });
  assert.ok(!a.lines.some((l) => l.name.includes('MISSING BOM')));
  const line = a.lines.find((l) => l.name === 'Floor Box Mounting Material');
  assert.ok(line && isPriceNeeded(line));
});

await test('isPriceNeeded: 0, 0.01, 0.09, 0.10, 5', () => {
  assert.equal(isPriceNeeded({ mat: 0 }), false);
  assert.equal(isPriceNeeded({ mat: 0.01 }), true);
  assert.equal(isPriceNeeded({ mat: 0.09 }), true);
  assert.equal(isPriceNeeded({ mat: 0.10 }), false);
  assert.equal(isPriceNeeded({ mat: 5 }), false);
});

await test('source check: BidItemsTab and EditablePreview use isPriceNeeded, old inline rule gone', async () => {
  const { readFile } = await import('node:fs/promises');
  const bid = await readFile(new URL('../components/estimator/BidItemsTab.tsx', import.meta.url), 'utf8');
  const prev = await readFile(new URL('../components/estimator/EditablePreview.tsx', import.meta.url), 'utf8');
  assert.ok(!/mat\s*>\s*0\s*&&\s*\w+\.mat\s*<\s*0\.10/.test(bid));
  assert.equal((bid.match(/isPriceNeeded/g) ?? []).length, 4); // import + 3 uses
  assert.match(prev, /Price needed/);
  assert.match(prev, /isPriceNeeded/);
});

invalidateBomCache();
console.log(`\n${n} tests passed`);
