// Pure helper for the Bid Summary "Job adders (preview - not in totals)" card.
// Shows what job-level adders WOULD add; changes nothing and reads/writes no state.
// No runtime imports on purpose (so plain node can run the tests).

export type LiftUnit = 'days' | 'weeks';

/** What-if inputs. Strings are allowed so form fields can be passed straight in. */
export interface AdderInputs {
  fittingsPct?: number | string | null;      // % of material total
  nonProdPct?: number | string | null;       // % of effective labor total
  liftQty?: number | string | null;          // days or weeks
  liftRate?: number | string | null;         // $ per day or per week
  liftUnit?: LiftUnit;                       // label only; qty x rate either way
  tempPower?: number | string | null;        // lump sum $
}

export interface AdderRates {
  bulk: number;        // R.bulk, e.g. 0.085 (lift gets the same markup as Rental entries)
  overhead: number;    // R.overhead, e.g. 0.10 (applies to the labor adder only)
  profit: number;      // R.profit, e.g. 0.12
  /** Design fee % (0-5) already on the displayed grand total. Default 0. */
  designFeePct?: number;
}

export interface AdderBase {
  matTotal: number;
  effectiveLaborTotal: number;
  subtotal: number;
}

export interface AdderRow {
  key: 'fittings' | 'nonProd' | 'lift' | 'tempPower';
  /** Dollars added to the subtotal before profit (includes overhead for the labor adder, bulk markup for lift). */
  wouldAdd: number;
  /** Effect on the grand total after profit (and design fee, if any). */
  grandChange: number;
}

export interface AdderPreview {
  rows: AdderRow[];
  /** Sum of the rows' wouldAdd. */
  totalAdd: number;
  /** Sum of the rows' grand-total change. */
  totalGrandChange: number;
  /** Subtotal (as passed in) + totalAdd. */
  newSubtotal: number;
}

/** Blank, invalid, non-finite or negative values count as 0. */
export function cleanAmount(v: number | string | null | undefined): number {
  const n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v)) : v;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

const num = (v: number | undefined | null) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function computeAdders(base: AdderBase, inputs: AdderInputs, rates: AdderRates): AdderPreview {
  const mat = num(base.matTotal);
  const lab = num(base.effectiveLaborTotal);
  const profit = num(rates.profit);
  const feeMult = 1 + num(rates.designFeePct) / 100;

  const fittings = mat * (cleanAmount(inputs.fittingsPct) / 100);
  const nonProdLabor = lab * (cleanAmount(inputs.nonProdPct) / 100);
  const nonProd = nonProdLabor * (1 + num(rates.overhead)); // labor gets overhead, then profit
  const lift = cleanAmount(inputs.liftQty) * cleanAmount(inputs.liftRate) * (1 + num(rates.bulk));
  const tempPower = cleanAmount(inputs.tempPower);

  const mk = (key: AdderRow['key'], wouldAdd: number): AdderRow => ({
    key, wouldAdd, grandChange: wouldAdd * (1 + profit) * feeMult,
  });
  const rows = [mk('fittings', fittings), mk('nonProd', nonProd), mk('lift', lift), mk('tempPower', tempPower)];

  const totalAdd = rows.reduce((s, r) => s + r.wouldAdd, 0);
  const totalGrandChange = rows.reduce((s, r) => s + r.grandChange, 0);
  return { rows, totalAdd, totalGrandChange, newSubtotal: num(base.subtotal) + totalAdd };
}
