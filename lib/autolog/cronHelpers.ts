// Pure helpers for the nightly auto-log cron route: secret check and summary email text.
// No env access, no I/O. No wage or dollar amounts anywhere in the summary.

import type { AutoLogItem } from './computeAutoLog';

export type CronAuth = { ok: true } | { ok: false; status: 401 | 500; error: string };

/**
 * Fail closed: a missing or empty secret is a server error (500) and nothing runs;
 * the Authorization header must be exactly `Bearer <secret>` or the call is rejected (401).
 */
export function checkCronAuth(secret: string | undefined | null, authHeader: string | null | undefined): CronAuth {
  if (!secret) return { ok: false, status: 500, error: 'CRON_SECRET is not configured' };
  if (authHeader !== `Bearer ${secret}`) return { ok: false, status: 401, error: 'Unauthorized' };
  return { ok: true };
}

export interface SummarySkip { scheduleId: string; userId: string; userName: string; jobNumber: string; reason: string }
export interface SummaryError { scheduleId: string; userId: string; userName: string; jobNumber: string; message: string }
export interface SummaryInput {
  targetDate: string;
  logged: AutoLogItem[];
  skipped: SummarySkip[];
  errors: SummaryError[];
}

const REASON_TEXT: Record<string, string> = {
  job_not_in_progress: 'job is not In Progress',
  job_archived: 'job is archived',
  user_inactive: 'person is inactive',
  completed_clock_entry: 'already clocked out for this shift',
  already_auto_logged: 'already logged for this shift',
  already_logged: 'already logged for this shift',
  labor_entry_exists: 'already has hours on this job that day',
  duplicate_shift_same_day: 'second shift for the same job and day',
  zero_or_negative_hours: 'scheduled end is not after start',
  job_not_in_allowlist: 'job is not enabled for auto-log',
};

/** Email only when something was logged or went wrong. */
export function shouldSendSummary(r: Pick<SummaryInput, 'logged' | 'errors'>): boolean {
  return r.logged.length > 0 || r.errors.length > 0;
}

export function summarySubject(r: SummaryInput): string {
  const errs = r.errors.length > 0 ? `, ${r.errors.length} error${r.errors.length === 1 ? '' : 's'}` : '';
  return `Auto-log ${r.targetDate}: ${r.logged.length} logged${errs}`;
}

/**
 * Plain-text body. Skipped lines are limited to jobs that are enabled for auto-log, so the
 * email is not buried in reasons for every other job on the schedule.
 */
export function buildSummaryText(r: SummaryInput, isJobEnabled: (jobNumber: string) => boolean): string {
  const lines: string[] = [`Auto-logged hours for ${r.targetDate}`, ''];

  lines.push(`Logged (${r.logged.length}):`);
  if (r.logged.length === 0) lines.push('  none');
  for (const i of r.logged) {
    const note = i.reason === 'forgot_depart' ? ' (arrived, never departed: full scheduled shift)' : '';
    lines.push(`  ${i.jobNumber} ${i.jobName} - ${i.userName} - ${i.hours} hrs${note}`);
  }

  const relevantSkips = r.skipped.filter((s) => isJobEnabled(s.jobNumber));
  lines.push('', `Skipped (${relevantSkips.length}):`);
  if (relevantSkips.length === 0) lines.push('  none');
  for (const s of relevantSkips) {
    lines.push(`  ${s.jobNumber} - ${s.userName} - ${REASON_TEXT[s.reason] ?? s.reason}`);
  }

  if (r.errors.length > 0) {
    lines.push('', `Errors (${r.errors.length}):`);
    for (const e of r.errors) {
      lines.push(`  ${e.jobNumber} - ${e.userName} - ${e.message.slice(0, 200)}`);
    }
  }

  lines.push('', 'Review or edit entries on each job\'s Labor tab (marked Auto).');
  return lines.join('\n');
}
