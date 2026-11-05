import { prisma } from "@/lib/prisma";
import { computeAutoLog, type AutoLogItem } from "./computeAutoLog";
import {
  autoLogBlockReason, isJobAllowed, isUniqueViolation, parseJobNumberAllowlist,
  type AutoLogBlock,
} from "./autologGuards";
import { loadAutoLogInput } from "./loadAutoLogInput";

// Writes the planned auto-log hours as LaborEntry rows (source AUTO, scheduleId set).
// Guarded by env flags; safe to re-run: the unique (scheduleId, userId) index makes a second
// write for the same shift fail, and that is treated as "already logged".
// NOT wired to any cron yet.

export interface AutoLogRunSkip {
  scheduleId: string;
  userId: string;
  userName: string;
  jobNumber: string;
  reason: string;
}

export interface AutoLogRunError {
  scheduleId: string;
  userId: string;
  userName: string;
  jobNumber: string;
  message: string;
}

export interface AutoLogRunResult {
  targetDate: string;
  /** Set when the guards stopped the run before anything was loaded or written. */
  blocked: AutoLogBlock;
  logged: AutoLogItem[];
  skipped: AutoLogRunSkip[];
  errors: AutoLogRunError[];
}

export async function runAutoLog(
  targetDate: string,
  env: { jobNumbers?: string | null; startDate?: string | null } = {
    jobNumbers: process.env.AUTO_LOG_JOB_NUMBERS,
    startDate: process.env.AUTO_LOG_START_DATE,
  },
): Promise<AutoLogRunResult> {
  const result: AutoLogRunResult = { targetDate, blocked: null, logged: [], skipped: [], errors: [] };

  const blocked = autoLogBlockReason(targetDate, env);
  if (blocked) { result.blocked = blocked; return result; }
  const allowlist = parseJobNumberAllowlist(env.jobNumbers);

  const plan = computeAutoLog(await loadAutoLogInput(targetDate));

  for (const s of plan.skipped) {
    result.skipped.push({
      scheduleId: s.scheduleId, userId: s.userId, userName: s.userName, jobNumber: s.jobNumber, reason: s.reason,
    });
  }

  const date = new Date(`${targetDate}T00:00:00.000Z`); // date-only, like the Labor tab
  for (const item of plan.toLog) {
    const base = { scheduleId: item.scheduleId, userId: item.userId, userName: item.userName, jobNumber: item.jobNumber };
    if (!isJobAllowed(item.jobNumber, allowlist)) {
      result.skipped.push({ ...base, reason: 'job_not_in_allowlist' });
      continue;
    }
    try {
      await prisma.laborEntry.create({
        data: {
          jobId: item.jobId,
          userId: item.userId,
          date,
          hours: item.hours,
          source: 'AUTO',
          scheduleId: item.scheduleId,
          submittedByName: `Auto-logged scheduled shift - ${item.jobName}`,
        },
      });
      result.logged.push(item);
    } catch (e) {
      if (isUniqueViolation(e)) {
        result.skipped.push({ ...base, reason: 'already_logged' });
      } else {
        result.errors.push({ ...base, message: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return result;
}
