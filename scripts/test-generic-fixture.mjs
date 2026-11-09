// Plain node tests: generic per-quote fixture ("Other Fixture (per quote)" + optional type tag).
// Run: node scripts/test-generic-fixture.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { readFile } from 'node:fs/promises';

register('./ts-resolve-hook.mjs', import.meta.url);

const { GENERIC_FIXTURE_ID, fixtureLineLabel } = await import('../lib/estimator/fixRules.ts');
const { SHOP_LABOR } = await import('../lib/estimator/shopLabor.ts');
const { getBomItem } = await import('../lib/estimator/bom.ts');
const { applyMarkup } = await import('../lib/estimator/constants.ts');
const { isPriceNeeded } = await import('../lib/estimator/priceNeeded.ts');

const src = await readFile(new URL('../components/estimator/FixtureBuilderTab.tsx', import.meta.url), 'utf8');
const stateSrc = await readFile(new URL('../lib/estimator/state.ts', import.meta.url), 'utf8');

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

await test('generic fixture is in ASMS: Fixture group, lc8 placeholder, 0.75 hrs, label "Other Fixture (per quote)"', () => {
  assert.equal(GENERIC_FIXTURE_ID, 'generic_fix');
  assert.match(src, /id:GENERIC_FIXTURE_ID,\s*grp:'Fixture',\s*lbl:'Other Fixture \(per quote\)',\s*fixId:'lc8',\s*iHr:0\.75/);
});

await test('existing ASMS entries are unchanged (every earlier fixture and device still listed as before)', () => {
  const must = [
    "id:'r20',    grp:'Device',  lbl:'20A Receptacle',           devId:'d1',  plId:'dp1'",
    "id:'tb24',     grp:'Fixture', lbl:'2×4 LED Lay-In T-Bar',       fixId:'lc1'",
    "id:'hbay',     grp:'Fixture', lbl:'High Bay LED Round (UFO)',     fixId:'lc8'",
    "id:'exit',     grp:'Fixture', lbl:'Exit / EBU Combo',             fixId:'lc12'",
    "id:'fan60',    grp:'Fixture', lbl:'Ceiling Fan 60\"',              fixId:'lc15'",
    "id:'rec_can',  grp:'Fixture', lbl:'Recessed Can',                 fixId:REC_CAN_FIXTURE_ID, iHr:0.70",
  ];
  for (const m of must) assert.ok(src.includes(m), `missing: ${m}`);
  // exactly one new fixture entry: 21 fixtures before + the generic one
  assert.equal((src.match(/grp:'Fixture'/g) ?? []).length, 22);
});

await test('existing fixtures keep their line label even if a tag is passed', () => {
  assert.equal(fixtureLineLabel('tb24', '2×4 LED Lay-In T-Bar', 'Type D'), '2×4 LED Lay-In T-Bar — PER QUOTE');
  assert.equal(fixtureLineLabel('rec_can', 'Recessed Can'), 'Recessed Can — PER QUOTE');
  assert.equal(fixtureLineLabel('exit', 'Exit / EBU Combo', ''), 'Exit / EBU Combo — PER QUOTE');
});

await test('generic fixture with tag "Type D" -> "Type D — PER QUOTE"', () => {
  assert.equal(fixtureLineLabel('generic_fix', 'Other Fixture (per quote)', 'Type D'), 'Type D — PER QUOTE');
  assert.equal(fixtureLineLabel('generic_fix', 'Other Fixture (per quote)', '  Type N  '), 'Type N — PER QUOTE');
});

await test('blank, whitespace or missing tag -> "Other Fixture (per quote) — PER QUOTE"', () => {
  const want = 'Other Fixture (per quote) — PER QUOTE';
  assert.equal(fixtureLineLabel('generic_fix', 'Other Fixture (per quote)', ''), want);
  assert.equal(fixtureLineLabel('generic_fix', 'Other Fixture (per quote)', '   '), want);
  assert.equal(fixtureLineLabel('generic_fix', 'Other Fixture (per quote)'), want);
  assert.equal(fixtureLineLabel('generic_fix', 'Other Fixture (per quote)', undefined), want);
});

await test('generic fixture price is the $0.01 lc8 placeholder and flags Price needed', () => {
  const b = getBomItem('lc8');
  assert.equal(b.mat, 0.01);
  assert.equal(isPriceNeeded({ mat: applyMarkup(b.mat * 1, b.mk) }), true);
});

await test('no SHOP_LABOR entry for the new id, so install hours fall back to iHr 0.75', () => {
  assert.equal(SHOP_LABOR[GENERIC_FIXTURE_ID], undefined);
  assert.equal(SHOP_LABOR[GENERIC_FIXTURE_ID] ?? 0.75, 0.75);
  assert.match(src, /\(SHOP_LABOR\[asm\.id\] \?\? asm\.iHr\) \* qty \* diff \* R\.labor/);
});

await test('wiring: tag input only for the generic fixture, tag stored on fixtureState, passed to the builder', () => {
  assert.match(src, /selectedAsm\.id === GENERIC_FIXTURE_ID &&/);
  assert.match(src, /Type tag \(e\.g\. Type D\)/);
  assert.match(src, /updateFixtureState\(\{ typeTag: e\.target\.value \}\)/);
  assert.match(src, /buildFixtureAsm\(selectedAsm, whipFt, qty, gangs, romex, diff, typeTag\)/);
  assert.match(src, /fixtureLineLabel\(asm\.id, asm\.lbl, typeTag\)/);
  assert.match(stateSrc, /typeTag\?:\s*string/);
  // default state has no tag (missing = blank), and no schema/DB files involved
  assert.ok(!/DEFAULT_FIXTURE[\s\S]{0,200}typeTag/.test(stateSrc));
});

console.log(`\n${n} tests passed`);
