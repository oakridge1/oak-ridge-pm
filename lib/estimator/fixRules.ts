// Small pure rules used by the Fixture builder and the MC home run builder.
// No imports on purpose, so plain node can run the tests.

/** Recessed can fixture line: the same $0.01 "Price needed" placeholder as the other PER QUOTE lines. */
export const REC_CAN_FIXTURE_ID = 'lc9';

/** Generic per-quote fixture (Type D, exit signs, etc.): id in the Fixture builder's list. Priced from the $0.01 lc8 placeholder. */
export const GENERIC_FIXTURE_ID = 'generic_fix';

/** Per-quote fixture line name: "<tag> — PER QUOTE" for the generic fixture when a tag is typed, else "<label> — PER QUOTE". */
export function fixtureLineLabel(asmId: string, asmLabel: string, typeTag?: string): string {
  const tag = asmId === GENERIC_FIXTURE_ID && typeof typeTag === 'string' ? typeTag.trim() : '';
  return `${tag || asmLabel} — PER QUOTE`;
}

export interface MudRingPick {
  id: 'mr1' | 'mr2';
  /** Line name for the assembly. */
  name: string;
}

/** Mud ring for a device box: 1 gang = SG ring (mr1); 2+ gangs = 2G ring (mr2). There is no 3G ring in the BOM. */
export function mudRingFor(gangs: number): MudRingPick {
  const g = Number.isFinite(gangs) ? Math.floor(gangs) : 1;
  if (g >= 3) return { id: 'mr2', name: '2G mud ring (3G ring – verify)' };
  if (g === 2) return { id: 'mr2', name: '2G mud ring' };
  return { id: 'mr1', name: 'SG mud ring' };
}

// Smaller wire = bigger AWG number: #14 > #12 > #10 > #8.
const awgNumber = (wire: string): number => {
  const n = parseInt(String(wire).replace('#', ''), 10);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Warning (never blocking) when the wire looks too small for the breaker:
 * 30A needs #10 or larger; 40A and up needs #8 or larger. Returns null when fine.
 */
export function homeRunWireWarning(wireSize: string, bkrSize: string): string | null {
  const amps = parseInt(String(bkrSize), 10);
  const awg = awgNumber(wireSize);
  if (!Number.isFinite(amps) || !Number.isFinite(awg)) return null;
  if (amps >= 40 && awg > 8) return `${amps}A breaker needs #8 wire or larger – ${wireSize} is too small.`;
  if (amps >= 30 && amps < 40 && awg > 10) return `${amps}A breaker needs #10 wire or larger – ${wireSize} is too small.`;
  return null;
}
