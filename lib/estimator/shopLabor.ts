// ── lib/estimator/shopLabor.ts ────────────────────────────────────────────────
// Oak Ridge shop labor standards for the Device & Fixture Builder.
//
// These are Justin's field times: base hours per box/fixture, rough + trim,
// BEFORE the crew adder and gang factor. Edit the numbers here and nowhere else.
//
// The Device/Fixture Builder (components/estimator/FixtureBuilderTab.tsx) turns
// these into ONE "Install labor (shop standard)" line per assembly:
//
//   hours = base hrs x gang factor x qty x difficulty (crew adder by default)
//
// Part lines (whip, connectors, box, C23, mud ring, CJ6, device, plate, wire
// nuts, ground screw) carry material cost only, no labor hours.
//
// Any assembly id NOT listed in SHOP_LABOR keeps its old install-line hours
// (the aHr / iHr on its ASMS entry in FixtureBuilderTab.tsx).
//
// This does NOT touch the BOM (lib/estimator/bom.ts or the BomItem table), the
// NECA tables in constants.ts, or any other builder.

/** Base shop hours per box (devices) or per fixture, keyed by ASMS id. */
export const SHOP_LABOR: Record<string, number> = {
  // Devices: per box, rough + trim
  r20:    0.90,  // 20A Receptacle
  r15:    0.90,  // 15A TR Receptacle
  gfci20: 0.95,  // 20A GFCI Receptacle
  gfci15: 0.95,  // 15A TR GFCI Receptacle
  sw1p:   0.90,  // Single Pole Switch
  sw3way: 0.90,  // 3-Way Switch (per box)
  sw4way: 0.90,  // 4-Way Switch

  // Fixtures: per fixture (0.67 x 1.12 crew adder = ~0.75 hr)
  tb24:   0.67,  // 2x4 LED Lay-In T-Bar
  tb22:   0.67,  // 2x2 LED Lay-In T-Bar
};

/** Each extra gang adds this fraction of the base: 2-gang 1.25x, 3-gang 1.5x. */
export const GANG_ADDER = 0.25;

/** Default difficulty for new Device/Fixture builds: 12% crew adder. Still editable. */
export const CREW_ADDER = 1.12;

/** Labor multiplier for a box with `gangs` gangs (1 gang = 1.0). */
export function gangFactor(gangs: number): number {
  return 1 + GANG_ADDER * (Math.max(1, gangs) - 1);
}
