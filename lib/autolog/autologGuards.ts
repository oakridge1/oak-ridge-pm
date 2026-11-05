// Pure guard helpers for the auto-log writer. No env access here: callers pass the raw values in.

/** "a, b,,c " -> ["a","b","c"]. Unset or blank means an empty list (auto-log off). */
export function parseJobNumberAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
}

/** Trimmed, case-insensitive match. An empty allowlist allows nothing. */
export function isJobAllowed(jobNumber: string, allowlist: string[]): boolean {
  const want = jobNumber.trim().toLowerCase();
  if (!want) return false;
  return allowlist.some((a) => a.trim().toLowerCase() === want);
}

/**
 * Never backfill: a date is allowed only on or after AUTO_LOG_START_DATE.
 * Unset start date = no restriction. A set but unreadable value fails closed.
 */
export function isDateAllowed(targetDate: string, startDate: string | undefined | null): boolean {
  const start = (startDate ?? '').trim();
  if (!start) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return false;
  return targetDate >= start;
}

export type AutoLogBlock = 'disabled' | 'before_start_date' | null;

/** Why a run is blocked outright, or null if it may proceed. */
export function autoLogBlockReason(
  targetDate: string,
  env: { jobNumbers?: string | null; startDate?: string | null },
): AutoLogBlock {
  if (parseJobNumberAllowlist(env.jobNumbers).length === 0) return 'disabled';
  if (!isDateAllowed(targetDate, env.startDate)) return 'before_start_date';
  return null;
}

/** True for a unique-constraint violation from Prisma or Postgres. */
export function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: unknown; message?: unknown };
  if (err.code === 'P2002' || err.code === '23505') return true;
  return typeof err.message === 'string' && /unique constraint/i.test(err.message);
}
