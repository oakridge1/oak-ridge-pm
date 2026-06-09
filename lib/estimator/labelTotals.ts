// ── lib/estimator/labelTotals.ts ──────────────────────────────────────────────
// Shared utility: aggregate assembly costs by bid-package label.
// Used by BidSummaryTab (By Label view) and ProposalTab (alternates sync).

import type { SavedAssembly } from './constants';
import type { EstimatorState } from './state';

export type LabelTotals = {
  [bidPackage: string]: {
    mat:   number;
    lab:   number;   // condMult + heightMult already applied
    total: number;   // mat + lab
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

  const heightMult = state.heightAdder ? 1.10 : 1.0;
  const condMult   = state.jobCondMult ?? 1.0;
  const totals: LabelTotals = {};

  for (const asm of allAsms) {
    const bp = asm.bidPackage || 'Base Bid';
    if (!totals[bp]) totals[bp] = { mat: 0, lab: 0, total: 0 };
    const labH = asm.lab * condMult * heightMult;
    totals[bp].mat   += asm.mat;
    totals[bp].lab   += labH;
    totals[bp].total += asm.mat + labH;
  }

  return totals;
}
