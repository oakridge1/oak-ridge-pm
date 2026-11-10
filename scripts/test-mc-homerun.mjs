// Plain node tests: MC home run builder with #8 / #6 wire and 40A / 50A breakers.
// Run: node scripts/test-mc-homerun.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register('./ts-resolve-hook.mjs', import.meta.url);

const { calcMCHomeRun, mcHomeRunCableId } = await import('../lib/estimator/calc.ts');
const { getBomItem } = await import('../lib/estimator/bom.ts');
const { getRates } = await import('../lib/estimator/constants.ts');
const { homeRunWireWarning, lockedMcConductors } = await import('../lib/estimator/fixRules.ts');
const { isPriceNeeded } = await import('../lib/estimator/priceNeeded.ts');

const R = getRates();
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

// Output of calcMCHomeRun with the double-counted "MC pull labor" line removed (the old line
// is gone; lab totals are the earlier values minus that line). Default rates.
// Each: [params, label, mat, lab, [[line name, qty, mat, lab], ...]]
const GOLD = [
  [{ suppType: 'Staple', feet: 80, makeup: 5, diff: 1, wireSize: '#12', numCond: 2, bkrSize: '20A' },
    '#12/2 MC — 80ft — 20A', 76.25067520000002, 229.91000000000003 - 39.839999999999996, [
      ['#12/2 MC (90ft)', 90, 58.589999999999996, 97.11], ['MC connector x2', 2, 7.423787, 9.959999999999999],
      ['4" square deep box', 1, 2.7125, 12.45], ['C23 bracket', 1, 3.0359385, 4.15], ['SG mud ring', 1, 1.3739355, 6.225],
      ['CJ6 x2', 2, 1.438927, 2.4899999999999998], ['wire nuts', 3, 0.283185, 4.9799999999999995],
      ['ground screw', 1, 0.14973, 1.6600000000000001], ['staples (22)', 22, 1.2426722000000001, 18.26],
      ['20A breaker termination labor', 1, 0, 14.110000000000001],
      ['Box termination & makeup labor', 1, 0, 18.675]]],
  [{ suppType: 'Strap', feet: 80, makeup: 5, diff: 1.25, wireSize: '#10', numCond: 3, bkrSize: '30A' },
    '#10/3 MC — 80ft — 30A', 123.89528200000002, 295.79125 - 62.25, [
      ['#10/3 MC (90ft)', 90, 102.5325, 119.52], ['MC connector x2', 2, 7.423787, 9.959999999999999],
      ['4" square deep box', 1, 2.7125, 12.45], ['C23 bracket', 1, 3.0359385, 4.15], ['SG mud ring', 1, 1.3739355, 6.225],
      ['CJ6 x2', 2, 1.438927, 2.4899999999999998], ['wire nuts', 4, 0.37757999999999997, 6.640000000000001],
      ['ground screw', 1, 0.14973, 1.6600000000000001], ['MC straps (22)', 22, 4.850383999999999, 27.389999999999997],
      ['30A breaker termination labor', 1, 0, 19.7125],
      ['Box termination & makeup labor', 1, 0, 23.34375]]],
  [{ suppType: 'J-Hook', feet: 80, makeup: 5, diff: 1, wireSize: '#14', numCond: 2, bkrSize: '15A' },
    '#14/2 MC — 80ft — 15A', 78.48000300000001, 190.89999999999998 - 33.2, [
      ['#14/2 MC (90ft)', 90, 27.342000000000002, 67.22999999999999], ['MC connector x2', 2, 7.423787, 9.959999999999999],
      ['4" square deep box', 1, 2.7125, 12.45], ['C23 bracket', 1, 3.0359385, 4.15], ['SG mud ring', 1, 1.3739355, 6.225],
      ['CJ6 x2', 2, 1.438927, 2.4899999999999998], ['wire nuts', 3, 0.283185, 4.9799999999999995],
      ['ground screw', 1, 0.14973, 1.6600000000000001], ['J-hooks', 8, 34.72, 16.6],
      ['15A breaker termination labor', 1, 0, 13.280000000000001],
      ['Box termination & makeup labor', 1, 0, 18.675]]],
  [{ suppType: 'Staple', feet: 120, makeup: 10, diff: 1, wireSize: '#10', numCond: 2, bkrSize: '30A' },
    '#10/2 MC — 120ft — 30A', 136.7075262, 346.11 - 74.69999999999999, [
      ['#10/2 MC (140ft)', 140, 118.482, 168.49], ['MC connector x2', 2, 7.423787, 9.959999999999999],
      ['4" square deep box', 1, 2.7125, 12.45], ['C23 bracket', 1, 3.0359385, 4.15], ['SG mud ring', 1, 1.3739355, 6.225],
      ['CJ6 x2', 2, 1.438927, 2.4899999999999998], ['wire nuts', 3, 0.283185, 4.9799999999999995],
      ['ground screw', 1, 0.14973, 1.6600000000000001], ['staples (32)', 32, 1.8075232, 26.560000000000002],
      ['30A breaker termination labor', 1, 0, 15.77],
      ['Box termination & makeup labor', 1, 0, 18.675]]],
];

const base = { suppType: 'Strap', feet: 80, makeup: 5, diff: 1.0 };
const lineNamed = (a, re) => a.lines.find((l) => re.test(l.name));

await test('#14, #12 and #10 totals, lines and labels match the new golden values (no pull line)', () => {
  for (const [p, label, mat, lab, lines] of GOLD) {
    const a = calcMCHomeRun({ ...p });
    assert.equal(a.label, label);
    close(a.mat, mat, `${label} mat`); close(a.lab, lab, `${label} lab`);
    assert.equal(a.lines.length, lines.length);
    lines.forEach(([name, qty, m, l], i) => {
      assert.equal(a.lines[i].name, name); assert.equal(a.lines[i].qty, qty);
      close(a.lines[i].mat, m, `${name} mat`); close(a.lines[i].lab, l, `${name} lab`);
    });
  }
});

await test('#8 / 40A uses w4b (8/3 MC) and the 2-pole 30A breaker hours (0.58)', () => {
  const a = calcMCHomeRun({ ...base, wireSize: '#8', numCond: 3, bkrSize: '40A' });
  assert.ok(a);
  assert.equal(mcHomeRunCableId('#8', 3), 'w4b');
  assert.equal(a.lines[0].name, '#8/3 MC (90ft)');
  close(a.lines[0].mat, getBomItem('w4b').mat * 90 * (1 + R.bulk), 'cable mat');
  const bk = lineNamed(a, /40A breaker termination/);
  close(bk.lab, 0.58 * 1.0 * R.labor, '40A breaker labor');
  assert.equal(a.label, '#8/3 MC — 80ft — 40A');
});

await test('#6 / 50A uses w4c (6/3 MC) and the 2-pole 50A breaker hours (0.64)', () => {
  const a = calcMCHomeRun({ ...base, wireSize: '#6', numCond: 3, bkrSize: '50A', diff: 1.25 });
  assert.equal(mcHomeRunCableId('#6', 3), 'w4c');
  assert.equal(a.lines[0].name, '#6/3 MC (90ft)');
  close(a.lines[0].mat, getBomItem('w4c').mat * 90 * (1 + R.bulk), 'cable mat');
  close(lineNamed(a, /50A breaker termination/).lab, 0.64 * 1.25 * R.labor, '50A breaker labor');
});

await test('15A/20A/30A breaker hours are unchanged (0.32, 0.34, 0.38)', () => {
  for (const [b, h, w] of [['15A', 0.32, '#14'], ['20A', 0.34, '#12'], ['30A', 0.38, '#10']]) {
    const a = calcMCHomeRun({ ...base, wireSize: w, numCond: 2, bkrSize: b });
    close(lineNamed(a, /breaker termination/).lab, h * R.labor, `${b} labor`);
  }
});

await test('#8 and #6 use the new large connector and strap; #14/#12/#10 keep mc1 and mc4', () => {
  for (const [w, b] of [['#8', '40A'], ['#6', '50A']]) {
    const a = calcMCHomeRun({ ...base, wireSize: w, numCond: 3, bkrSize: b });
    const conn = lineNamed(a, /connector/);
    assert.equal(conn.name, '3/4" MC connector x2'); assert.equal(conn.qty, 2);
    assert.ok(!a.lines.some((l) => l.name === 'MC connector x2'));
    const strap = lineNamed(a, /straps/);
    assert.match(strap.name, /^Large MC straps/);
    assert.ok(!a.lines.some((l) => /^MC straps/.test(l.name)));
  }
  for (const w of ['#14', '#12', '#10']) {
    const a = calcMCHomeRun({ ...base, wireSize: w, numCond: 2, bkrSize: '15A' });
    assert.ok(a.lines.some((l) => l.name === 'MC connector x2'));
    assert.ok(a.lines.some((l) => /^MC straps/.test(l.name)));
  }
});

await test('the new $0.01 connector and strap rows are flagged Price needed', () => {
  for (const id of ['mc_big_conn', 'mc_big_strap']) {
    assert.equal(getBomItem(id).mat, 0.01);
  }
  const a = calcMCHomeRun({ ...base, wireSize: '#6', numCond: 3, bkrSize: '50A' });
  assert.ok(isPriceNeeded(lineNamed(a, /connector/)), 'connector flagged');
  assert.ok(!isPriceNeeded(a.lines[0]), 'cable line not flagged');
  // The strap line is flagged while its total is under $0.10 (about 9 straps or fewer, i.e. short runs).
  // On long runs the strap count is 10+ and the existing flag rule (mat under $0.10) no longer triggers.
  const short = calcMCHomeRun({ ...base, feet: 20, wireSize: '#6', numCond: 3, bkrSize: '50A' });
  assert.ok(isPriceNeeded(lineNamed(short, /straps/)), 'strap flagged on a short run');
  assert.ok(!isPriceNeeded(lineNamed(a, /straps/)), 'known limit: 22 straps at $0.01 is over the $0.10 flag rule');
});

await test('no MC pull labor line exists at any size; 0.45 hr box makeup and other lines are unchanged', () => {
  for (const [w, c, b] of [['#14', 2, '15A'], ['#12', 2, '20A'], ['#10', 3, '30A'], ['#8', 3, '40A'], ['#6', 3, '50A']]) {
    const a = calcMCHomeRun({ ...base, wireSize: w, numCond: c, bkrSize: b });
    assert.ok(!a.lines.some((l) => /pull/i.test(l.name)), `${w}: pull line present`);
    close(lineNamed(a, /Box termination/).lab, 0.45 * R.labor, `${w} box makeup`);
    assert.ok(a.lines.some((l) => l.name === '4" square deep box'));
  }
});

await test('cable line labor = total feet x BOM hours per foot x labor rate', () => {
  const cases = [['#12', 2, 'w1'], ['#10', 2, 'w3'], ['#10', 3, 'w4'], ['#8', 3, 'w4b'], ['#6', 3, 'w4c']];
  for (const [w, c, id] of cases) {
    const feet = 80, makeup = 5;
    const a = calcMCHomeRun({ ...base, feet, makeup, wireSize: w, numCond: c, bkrSize: '50A' });
    const totalFt = feet + makeup * 2;                // cable bought = run + makeup both ends
    close(a.lines[0].lab, totalFt * getBomItem(id).lhr * R.labor, `${w}/${c} cable labor`);
    assert.equal(a.lines[0].qty, totalFt);
  }
});

await test('80 ft, straps, no makeup, normal difficulty: total hours are 4.540 / 4.820 / 5.940 / 6.640', () => {
  const hrs = (w, c, b) => calcMCHomeRun({ ...base, makeup: 0, wireSize: w, numCond: c, bkrSize: b }).lab / R.labor;
  close(hrs('#12', 2, '20A'), 4.540, '#12/2 20A');
  close(hrs('#10', 2, '30A'), 4.820, '#10/2 30A');
  close(hrs('#8', 3, '40A'), 5.940, '#8/3 40A');
  close(hrs('#6', 3, '50A'), 6.640, '#6/3 50A');
});

await test('no cable for #8 or #6 with 2 conductors: calc returns null (UI shows a message)', () => {
  assert.equal(calcMCHomeRun({ ...base, wireSize: '#8', numCond: 2, bkrSize: '40A' }), null);
  assert.equal(calcMCHomeRun({ ...base, wireSize: '#6', numCond: 2, bkrSize: '50A' }), null);
  assert.equal(mcHomeRunCableId('#8', 2), undefined);
});

await test('conductors lock to 3 at #8 and #6 only', () => {
  assert.equal(lockedMcConductors('#8'), 3);
  assert.equal(lockedMcConductors('#6'), 3);
  for (const w of ['#14', '#12', '#10']) assert.equal(lockedMcConductors(w), null);
});

await test('mismatch warnings follow the table (15A #14, 20A #12, 30A #10, 40A #8, 50A #6)', () => {
  const table = [['15A', '#14'], ['20A', '#12'], ['30A', '#10'], ['40A', '#8'], ['50A', '#6']];
  const order = ['#14', '#12', '#10', '#8', '#6'];
  for (const [bkr, min] of table) {
    for (const w of order) {
      const tooSmall = order.indexOf(w) < order.indexOf(min);
      const msg = homeRunWireWarning(w, bkr);
      assert.equal(!!msg, tooSmall, `${bkr} on ${w}`);
      if (tooSmall) assert.ok(msg.includes(`${bkr.replace('A', '')}A breaker needs ${min} wire or larger`));
    }
  }
});

await test('builder wiring: new options, conductor lock, notes, no-cable message', async () => {
  const src = await readFile(new URL('../components/estimator/MCHomeRunBuilder.tsx', import.meta.url), 'utf8');
  for (const s of ['value="#8"', 'value="#6"', 'value="40A"', 'value="50A"']) assert.ok(src.includes(s), s);
  assert.match(src, /#8 and #6 use 3-conductor MC/);
  assert.match(src, /Verify box size for large MC cable/);
  assert.match(src, /disabled=\{bigWire\}/);
  assert.match(src, /No MC cable is set up for/);
  assert.match(src, /numCond: 3/);
});

console.log(`\n${n} tests passed`);
