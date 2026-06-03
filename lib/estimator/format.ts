// Shared formatting helpers for estimator UI components.
// Import from here instead of defining fmt$ / fmtH in each file.

export const fmt$ = (n: number): string =>
  '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Convert dollar-valued labor to a human-readable hours string. */
export const fmtH = (labDollars: number, laborRate: number): string =>
  (labDollars / laborRate).toFixed(2) + 'h';
