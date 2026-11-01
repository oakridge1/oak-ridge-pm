// ── lib/estimator/quoteCheck.ts ───────────────────────────────────────────────
// Pure check: which lighting / gear items still need a real quote?
// Lighting fixtures and distribution gear are quoted per job, so the BOM only
// holds placeholder prices for them. Never decide from a price value — only
// from null checks, the total-quote fields, and the "per quote" line name.
//
// NOTE: the lighting/gear cost formula below is duplicated in BidSummaryTab,
// ProposalTab and labelTotals.ts. Keep all four in sync.

import type { EstimatorState, LightingItem, GearItem } from './state';
import type { SavedAssembly } from './constants';

function rowLabel(item: LightingItem | GearItem): string {
  const type = item.typeLabel.trim();
  const desc = item.description.trim();
  if (type && desc) return `${type} — ${desc}`;
  return type || desc || 'Unnamed item';
}

function perUnitCost(items: (LightingItem | GearItem)[]): number {
  return items.reduce((sum, item) => {
    if (!item.quotedPrice || !item.qty) return sum;
    return sum + item.quotedPrice * item.qty * (1 + item.markup);
  }, 0);
}

function hasPerQuoteLine(asms: SavedAssembly[] | undefined): boolean {
  return (asms ?? []).some(a => a.lines.some(l => /per quote/i.test(l.name)));
}

function checkGroup(
  label: string,
  coverageMessage: string,
  items: (LightingItem | GearItem)[],
  totalQuote: number | null,
  asms: SavedAssembly[] | undefined,
): string[] {
  const warnings: string[] = [];
  const cost = totalQuote ? totalQuote : perUnitCost(items);

  if (!totalQuote) {
    for (const item of items) {
      if (item.qty > 0 && item.quotedPrice == null) {
        warnings.push(`${label} quote missing: ${rowLabel(item)} (qty ${item.qty})`);
      }
    }
  }

  if (hasPerQuoteLine(asms) && cost === 0) {
    warnings.push(coverageMessage);
  }

  return warnings;
}

export function getUnquotedWarnings(state: EstimatorState): string[] {
  return [
    ...checkGroup(
      'Lighting',
      'Lighting fixtures are in the bid but no lighting quote is entered.',
      state.lightingSchedule ?? [], state.lightingTotalQuote, state.asms,
    ),
    ...checkGroup(
      'Gear',
      'Gear is in the bid but no gear quote is entered.',
      state.gearSchedule ?? [], state.gearTotalQuote, state.savedGear,
    ),
  ];
}
