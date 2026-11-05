// Pure auto-log planner (see "AUTO-LOG SCHEDULED HOURS - RULES" in HANDOFF.md).
// No database, no clock: the caller passes everything in, including the target date.
// This step only PLANS hours; nothing here writes anything.

export const AUTO_LOG_TZ = 'America/New_York';
export const DEFAULT_SHIFT_HOURS = 8;

type DateLike = Date | string;

export interface AutoLogAssignment {
  userId: string;
  userName: string;
  userActive: boolean;
}

export interface AutoLogSchedule {
  id: string;
  /** Calendar date of the shift, YYYY-MM-DD (Schedule.date is a plain date). */
  date: string;
  startTime: string | null; // "HH:MM"
  endTime: string | null;   // "HH:MM"
  job: { id: string; jobNumber: string; jobName: string; status: string; archived: boolean };
  assignments: AutoLogAssignment[];
}

export interface AutoLogClockEntry {
  id: string;
  scheduleId: string;
  userId: string;
  arrivedAt: DateLike | null;
  departedAt: DateLike | null;
}

export interface AutoLogLaborEntry {
  id: string;
  jobId: string;
  userId: string;
  date: DateLike;
  scheduleId?: string | null;
}

export interface AutoLogInput {
  /** Eastern calendar date to process, YYYY-MM-DD. */
  targetDate: string;
  schedules: AutoLogSchedule[];
  clockEntries: AutoLogClockEntry[];
  laborEntries: AutoLogLaborEntry[];
}

export type AutoLogReason = 'scheduled' | 'forgot_depart';

export interface AutoLogItem {
  scheduleId: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  userId: string;
  userName: string;
  date: string;
  hours: number;
  reason: AutoLogReason;
  clockEntryId: string | null;
}

export type AutoLogSkipReason =
  | 'job_not_in_progress'
  | 'job_archived'
  | 'user_inactive'
  | 'completed_clock_entry'
  | 'already_auto_logged'
  | 'labor_entry_exists'
  | 'duplicate_shift_same_day'
  | 'zero_or_negative_hours';

export interface AutoLogSkip {
  scheduleId: string;
  jobId: string;
  jobNumber: string;
  jobName: string;
  userId: string;
  userName: string;
  reason: AutoLogSkipReason;
}

export interface AutoLogResult {
  toLog: AutoLogItem[];
  skipped: AutoLogSkip[];
}

const easternDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: AUTO_LOG_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** YYYY-MM-DD of an instant as seen in America/New_York. */
export function easternDateString(instant: Date): string {
  return easternDateFmt.format(instant);
}

/** Previous Eastern calendar day relative to `now` (the caller supplies the clock). */
export function yesterdayEastern(now: Date): string {
  const [y, m, d] = easternDateString(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Eastern day of a stored LaborEntry.date.
 * Labor-tab entries are stored as a date-only value (exactly midnight UTC), so that value IS the
 * day. Any other instant (e.g. a clock-out's noon timestamp) is converted to Eastern time.
 */
export function laborEntryDay(value: DateLike): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const isDateOnly =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return isDateOnly ? d.toISOString().slice(0, 10) : easternDateString(d);
}

function parseHHMM(v: string | null): number | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Scheduled hours rounded to the nearest quarter hour. No lunch deduction.
 * Missing or unreadable start/end means DEFAULT_SHIFT_HOURS.
 */
export function scheduledHours(startTime: string | null, endTime: string | null): number {
  const s = parseHHMM(startTime);
  const e = parseHHMM(endTime);
  const raw = s === null || e === null ? DEFAULT_SHIFT_HOURS : (e - s) / 60;
  return Math.round(raw * 4) / 4;
}

export function computeAutoLog(input: AutoLogInput): AutoLogResult {
  const { targetDate, schedules, clockEntries, laborEntries } = input;
  const toLog: AutoLogItem[] = [];
  const skipped: AutoLogSkip[] = [];

  const clockByKey = new Map<string, AutoLogClockEntry>();
  for (const c of clockEntries) clockByKey.set(`${c.scheduleId}|${c.userId}`, c);

  // Existing labor entries by job + person + Eastern day, and by shift + person.
  const laborDay = new Set<string>();
  const laborShift = new Set<string>();
  for (const l of laborEntries) {
    laborDay.add(`${l.jobId}|${l.userId}|${laborEntryDay(l.date)}`);
    if (l.scheduleId) laborShift.add(`${l.scheduleId}|${l.userId}`);
  }

  const planned = new Set<string>(); // job|user already planned in this run

  const ordered = [...schedules].sort((a, b) => a.id.localeCompare(b.id));
  for (const sch of ordered) {
    if (sch.date !== targetDate) continue;
    const assignments = [...sch.assignments].sort((a, b) => a.userId.localeCompare(b.userId));
    for (const a of assignments) {
      const base = {
        scheduleId: sch.id,
        jobId: sch.job.id,
        jobNumber: sch.job.jobNumber,
        jobName: sch.job.jobName,
        userId: a.userId,
        userName: a.userName,
      };
      const skip = (reason: AutoLogSkipReason) => skipped.push({ ...base, reason });

      if (sch.job.status !== 'IN_PROGRESS') { skip('job_not_in_progress'); continue; }
      if (sch.job.archived) { skip('job_archived'); continue; }
      if (!a.userActive) { skip('user_inactive'); continue; }

      const clock = clockByKey.get(`${sch.id}|${a.userId}`);
      if (clock?.departedAt) { skip('completed_clock_entry'); continue; }
      if (laborShift.has(`${sch.id}|${a.userId}`)) { skip('already_auto_logged'); continue; }
      if (laborDay.has(`${sch.job.id}|${a.userId}|${targetDate}`)) { skip('labor_entry_exists'); continue; }

      const dayKey = `${sch.job.id}|${a.userId}`;
      if (planned.has(dayKey)) { skip('duplicate_shift_same_day'); continue; }

      const hours = scheduledHours(sch.startTime, sch.endTime);
      if (!(hours > 0)) { skip('zero_or_negative_hours'); continue; }

      planned.add(dayKey);
      toLog.push({
        ...base,
        date: targetDate,
        hours,
        // Tapped Arrive but never Departed: the shift is finished at its scheduled end.
        reason: clock?.arrivedAt ? 'forgot_depart' : 'scheduled',
        clockEntryId: clock?.id ?? null,
      });
    }
  }

  return { toLog, skipped };
}
