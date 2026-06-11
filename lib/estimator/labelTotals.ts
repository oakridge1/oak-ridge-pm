// ── lib/estimator/labelTotals.ts ──────────────────────────────────────────────
// Shared utility: aggregate assembly costs by bid-package label.
// Returns a proportional share of the full marked-up project grand total for
// each bid package, using the same formula as BidSummaryTab / ProposalTab.

import type { SavedAssembly } from './constants';
import type { EstimatorState } from './state';
import { calcBid }  from './calc';
import { getRates } from './constants';

export type LabelTotals = {
  [bidPackage: string]: {
    raw:   number;   // mat + condMult*heightMult*lab (before markups)
    total: number;   // proportional share of the project's grand total
  };
};

export function calcLabelTotals(state: EstimatorState): LabelTotals {
  const allAsms: SavedAssembly[] = [
    ...(state.savedRuns      ?? []),
    ...(state.savedRacks     ?? []),
    ...(state.savedMCHR      ?? []),
    ...(state.savedThreeWay  ?? []),
    ...(state.savedData      ?? []),
    ...(state.savedFA        ?? []),
    ...(state.savedCans      ?? []),
    ...(state.savedGear      ?? []),
    ...(state.savedCustomDev ?? []),
    ...(state.savedTM        ?? []),
    ...(state.savedLV        ?? []),
    ...(state.savedCustomAsm ?? []),
    ...(state.savedHAR       ?? []),
    ...(state.savedFloorBox  ?? []),
    ...(state.asms           ?? []),
    ...(state.savedPanels    ?? []),
  ];

  if (allAsms.length === 0) return {};

  const heightMult = state.heightAdder ? 1.10 : 1.0;
  const condMult   = state.jobCondMult ?? 1.0;

  // ── 1. Raw per-package totals (mat + condMult*heightMult*lab) ───────────────
  const rawByPkg: Record<string, number> = {};
  for (const asm of allAsms) {
    const bp = asm.bidPackage || 'Base Bid';
    rawByPkg[bp] = (rawByPkg[bp] ?? 0) + (asm.mat ?? 0) + (asm.lab ?? 0) * condMult * heightMult;
  }

  const totalRaw = Object.values(rawByPkg).reduce((s, v) => s + v, 0);
  if (totalRaw === 0) return {};

  // ── 2. Full project grand total (mirrors BidSummaryTab / ProposalTab) ───────
  const R = getRates();

  const bid = calcBid({
    conduitRuns:    state.savedRuns      ?? [],
    racks:          state.savedRacks     ?? [],
    mcHomeRuns:     state.savedMCHR      ?? [],
    threeWays:      state.savedThreeWay  ?? [],
    dataDrops:      state.savedData      ?? [],
    fireAlarm:      state.savedFA        ?? [],
    gear:           [...(state.savedGear ?? []), ...(state.savedPanels ?? [])],
    floorBoxes:     state.savedFloorBox  ?? [],
    highAmpRecepts: state.savedHAR       ?? [],
    misc: [
      ...(state.savedCans      ?? []),
      ...(state.savedCustomDev ?? []),
      ...(state.savedTM        ?? []),
      ...(state.savedLV        ?? []),
      ...(state.savedCustomAsm ?? []),
    ],
    lighting:    state.asms ?? [],
    heating:     [],
    tempPower:   [],
    underground: [],
    other:       [],
    condMult,
  });

  // heightMult applied here (calcBid does not apply it)
  const effectiveLaborTotal = bid.laborTotal * heightMult;
  const effectiveOverhead   = effectiveLaborTotal * R.overhead;

  // Actual permit / sub / rental dollar amounts (not rate constants)
  const permitEntries = (state.permits ?? []).filter(p => !p.desc.startsWith('[Rental]'));
  const rentalEntries = (state.permits ?? []).filter(p =>  p.desc.startsWith('[Rental]'));
  const permitTotal   = permitEntries.reduce((s, p) => s + p.cost, 0) * (1 + R.permit);
  const rentalTotal   = rentalEntries.reduce((s, p) => s + p.cost, 0) * (1 + R.bulk);
  const subTotal      = (state.subs ?? []).reduce((s, p) => s + p.cost, 0) * (1 + R.sub);

  // Lighting quoted costs
  const lightingPerUnit = (state.lightingSchedule ?? []).reduce((sum, item) => {
    if (!item.quotedPrice || !item.qty) return sum;
    return sum + item.quotedPrice * item.qty * (1 + item.markup);
  }, 0);
  const lightingCost = state.lightingTotalQuote
    ? state.lightingTotalQuote * (1 + (state.lightingQuoteMarkup ?? 0.05))
    : lightingPerUnit;

  // Gear quoted costs
  const gearPerUnit = (state.gearSchedule ?? []).reduce((sum, item) => {
    if (!item.quotedPrice || !item.qty) return sum;
    return sum + item.quotedPrice * item.qty * (1 + item.markup);
  }, 0);
  const gearCost = state.gearTotalQuote
    ? state.gearTotalQuote * (1 + (state.gearQuoteMarkup ?? 0.05))
    : gearPerUnit;

  const subtotal   = bid.matTotal + effectiveLaborTotal + effectiveOverhead
                   + permitTotal + rentalTotal + subTotal
                   + lightingCost + gearCost;
  const grandTotal = subtotal * (1 + R.profit);

  // ── 3. Proportional split ───────────────────────────────────────────────────
  const result: LabelTotals = {};
  for (const [bp, raw] of Object.entries(rawByPkg)) {
    result[bp] = {
      raw,
      total: grandTotal * (raw / totalRaw),
    };
  }

  return result;
}
