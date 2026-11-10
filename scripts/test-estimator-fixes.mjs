// Plain node tests for the estimator fixes (needs Node 22.6+ type stripping).
// Run: node scripts/test-estimator-fixes.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);

const { calcHighAmpRecept, calcFloorBox } = await import('../lib/estimator/calc.ts');
const { getBomItem } = await import('../lib/estimator/bom.ts');
const { CREW_ADDER } = await import('../lib/estimator/shopLabor.ts');
const { mudRingFor, homeRunWireWarning, REC_CAN_FIXTURE_ID } = await import('../lib/estimator/fixRules.ts');
const { getRates } = await import('../lib/estimator/constants.ts');

const R = getRates();
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
const har = (receptType, over = {}) => calcHighAmpRecept({ receptType, whipFeet: 20, qty: 1, diff: 1.0, ...over });
const cableLine = (asm) => asm.lines[0]; // the whip cable is the first line
const installLine = (asm) => asm.lines.find((l) => /install labor/.test(l.name));
// Same rule BidItemsTab uses for the "Price needed" flag.
const flagged = (line) => line.mat > 0 && line.mat < 0.10;

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// ── 1. HAR cable picks ───────────────────────────────────────────────────────
test('30A uses 10/2 MC Glide (w3), 20ft x 1', () => {
  const c = cableLine(har('30A'));
  assert.equal(c.name, getBomItem('w3').name);
  assert.equal(c.name, '10/2 MC Glide per ft');
  assert.equal(c.qty, 20);
});

test('50A uses 6/3 MC Cable (w4c)', () => {
  const c = cableLine(har('50A'));
  assert.equal(c.name, '6/3 MC Cable per ft');
  assert.equal(c.name, getBomItem('w4c').name);
});

test('static BOM has w4c with the exact live values', () => {
  const b = getBomItem('w4c');
  assert.equal(b.unit, 'FT');
  assert.equal(b.mat, 2.80);
  assert.equal(b.lhr, 0.048);
});

test('240V and twist-lock cables are unchanged (w1, w3)', () => {
  assert.equal(cableLine(har('240V')).name, getBomItem('w1').name);
  assert.equal(cableLine(har('twist')).name, getBomItem('w3').name);
});

test('30A cable material scales with whip feet and qty', () => {
  const a = cableLine(har('30A', { whipFeet: 25, qty: 3 }));
  assert.equal(a.qty, 75);
  close(a.mat, getBomItem('w3').mat * 75 * (1 + R.bulk), 'mat');
});

// ── 2. HAR crew adder ────────────────────────────────────────────────────────
test('HAR labor = base hrs x CREW_ADDER x qty x diff x labor rate', () => {
  assert.equal(CREW_ADDER, 1.12);
  const cases = [['30A', 1.00], ['50A', 1.25], ['240V', 1.00], ['twist', 1.50]];
  for (const [type, base] of cases) {
    const a = har(type, { qty: 4, diff: 1.25 });
    close(installLine(a).lab, base * CREW_ADDER * 4 * 1.25 * R.labor, `${type} labor`);
  }
});

test('HAR crew adder applies once (before difficulty), not twice', () => {
  const normal = installLine(har('30A', { diff: 1.0 })).lab;
  const hard = installLine(har('30A', { diff: 1.25 })).lab;
  close(normal, 1.12 * R.labor, 'normal');
  close(hard / normal, 1.25, 'difficulty ratio');
});

test('HAR assembly labor total = sum of its lines; only the install line got the crew adder', () => {
  const a = har('30A', { qty: 2 });
  close(a.lab, a.lines.reduce((s, l) => s + l.lab, 0), 'asm lab');
  const partsLab = a.lines.filter((l) => l !== installLine(a)).reduce((s, l) => s + l.lab, 0);
  close(a.lab - installLine(a).lab, partsLab, 'parts labor untouched');
});

// ── 3. Home run wire warning ─────────────────────────────────────────────────
test('home run warning: 30A with #12 or #14 warns; #10 does not', () => {
  assert.ok(homeRunWireWarning('#12', '30A'));
  assert.ok(homeRunWireWarning('#14', '30A'));
  assert.equal(homeRunWireWarning('#10', '30A'), null);
});

test('home run warning: 40A needs #8 or larger, 50A needs #6 or larger', () => {
  assert.ok(homeRunWireWarning('#10', '40A'));
  assert.ok(homeRunWireWarning('#12', '50A'));
  assert.ok(homeRunWireWarning('#8', '50A'));
  assert.equal(homeRunWireWarning('#8', '40A'), null);
  assert.equal(homeRunWireWarning('#6', '40A'), null);
  assert.equal(homeRunWireWarning('#6', '50A'), null);
  assert.equal(homeRunWireWarning('#6', '60A'), null); // 60A is not offered: no rule, no warning
});

test('home run warning: 15A needs #14, 20A needs #12; larger wire never warns; bad input does not warn or throw', () => {
  for (const w of ['#14', '#12', '#10', '#8', '#6']) assert.equal(homeRunWireWarning(w, '15A'), null);
  assert.ok(homeRunWireWarning('#14', '20A'));
  for (const w of ['#12', '#10', '#8', '#6']) assert.equal(homeRunWireWarning(w, '20A'), null);
  assert.equal(homeRunWireWarning('', ''), null);
  assert.equal(homeRunWireWarning('xyz', '30A'), null);
});

// ── 4. Mud ring by gangs ─────────────────────────────────────────────────────
test('mud ring: 1 gang = mr1, 2 gang = mr2, 3 gang = mr2 with a verify note', () => {
  assert.equal(mudRingFor(1).id, 'mr1');
  assert.equal(mudRingFor(2).id, 'mr2');
  assert.equal(mudRingFor(2).name, '2G mud ring');
  assert.equal(mudRingFor(3).id, 'mr2');
  assert.ok(mudRingFor(3).name.includes('3G ring – verify'));
  assert.ok(!mudRingFor(2).name.includes('verify'));
  assert.equal(mudRingFor(1).id, 'mr1');
  assert.equal(mudRingFor(NaN).id, 'mr1');
  assert.equal(mudRingFor(0).id, 'mr1');
});

test('mr1 and mr2 exist in the BOM (2G ring is the dearer one)', () => {
  assert.ok(getBomItem('mr2').mat > getBomItem('mr1').mat);
});

// ── 5/6. fb_mnt and rec_can flagged "Price needed" ───────────────────────────
test('fb_mnt is in the BOM as a $0.01 placeholder named Floor Box Mounting Material', () => {
  const b = getBomItem('fb_mnt');
  assert.equal(b.name, 'Floor Box Mounting Material');
  assert.equal(b.mat, 0.01);
});

test('wood floor box: mount line is flagged Price needed, not [MISSING BOM]', () => {
  const a = calcFloorBox({ floorType: 'wood', gangs: 2, qty: 1, quoted: true, diff: 1.0 });
  assert.ok(!a.lines.some((l) => l.name.includes('MISSING BOM')));
  const line = a.lines.find((l) => l.name === 'Floor Box Mounting Material');
  assert.ok(line, 'mount line present');
  assert.ok(flagged(line), `mat ${line.mat}`);
});

test('concrete floor boxes do not add the mount line', () => {
  const a = calcFloorBox({ floorType: 'concrete_new', gangs: 1, qty: 1, quoted: true, diff: 1.0 });
  assert.ok(!a.lines.some((l) => l.name === 'Floor Box Mounting Material'));
});

test('rec_can fixture uses the $0.01 per-quote placeholder (not lc16) so it shows Price needed', () => {
  assert.notEqual(REC_CAN_FIXTURE_ID, 'lc16');
  const b = getBomItem(REC_CAN_FIXTURE_ID);
  assert.equal(b.mat, 0.01);
  const line = { mat: b.mat * (1 + R.light) }; // one can, light markup, as addI builds it
  assert.ok(flagged(line), `mat ${line.mat}`);
});

await test('fixture builder wiring: rec_can uses REC_CAN_FIXTURE_ID and the ring pick (source check)', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../components/estimator/FixtureBuilderTab.tsx', import.meta.url), 'utf8');
  assert.match(src, /id:'rec_can'[^\n]*fixId:REC_CAN_FIXTURE_ID[^\n]*iHr:0\.70/);
  assert.ok(!/id:'rec_can'[^\n]*lc16/.test(src));
  assert.match(src, /mudRingFor\(gangs\)/);
});

console.log(`\n${n} tests passed`);
