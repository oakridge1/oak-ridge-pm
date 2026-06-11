// Shared formatting helpers for estimator UI components.
// Import from here instead of defining fmt$ / fmtH in each file.

export const fmt$ = (n: number | null | undefined): string => {
  const safe = (n == null || !isFinite(n)) ? 0 : n;
  return '$' + safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/** Convert dollar-valued labor to a human-readable hours string. */
export const fmtH = (
  labDollars: number | null | undefined,
  laborRate: number | null | undefined,
): string => {
  const lab  = (labDollars == null || !isFinite(labDollars)) ? 0 : labDollars;
  const rate = (laborRate == null || !isFinite(laborRate) || laborRate === 0) ? 1 : laborRate;
  return (lab / rate).toFixed(2) + 'h';
};
