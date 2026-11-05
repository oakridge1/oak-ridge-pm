import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  computeAutoLog,
  yesterdayEastern,
  type AutoLogSchedule,
} from "@/lib/autolog/computeAutoLog";

// ADMIN-only, READ-ONLY dry run of the nightly auto-log. It loads data and shows what WOULD be
// logged. There is no button here that writes anything.

const REASON_TEXT: Record<string, string> = {
  job_not_in_progress: "Job is not In Progress",
  job_archived: "Job is archived",
  user_inactive: "Person is inactive",
  completed_clock_entry: "Already clocked out for this shift",
  already_auto_logged: "Already logged for this shift",
  labor_entry_exists: "Already has hours on this job that day",
  duplicate_shift_same_day: "Second shift for the same job and day",
  zero_or_negative_hours: "Scheduled end is not after start",
};

export default async function AutoLogPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const sp = await searchParams;
  const requested = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const targetDate = requested ?? yesterdayEastern(new Date());

  const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) redirect("/admin/autolog-preview");

  const schedules = await prisma.schedule.findMany({
    where: { date: dayStart },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      job: { select: { id: true, jobNumber: true, jobName: true, status: true, archived: true } },
      assignments: { select: { userId: true, user: { select: { name: true, active: true } } } },
    },
  });

  const scheduleIds = schedules.map((s) => s.id);
  const jobIds = [...new Set(schedules.map((s) => s.job.id))];
  const dayMs = 24 * 60 * 60 * 1000;

  const [clockEntries, laborEntries] = await Promise.all([
    prisma.clockEntry.findMany({
      where: { scheduleId: { in: scheduleIds } },
      select: { id: true, scheduleId: true, userId: true, arrivedAt: true, departedAt: true },
    }),
    prisma.laborEntry.findMany({
      // wide window so Eastern-time conversion can't miss an entry; the function does the exact match
      where: {
        jobId: { in: jobIds },
        date: { gte: new Date(dayStart.getTime() - dayMs), lt: new Date(dayStart.getTime() + 2 * dayMs) },
      },
      select: { id: true, jobId: true, userId: true, date: true, scheduleId: true },
    }),
  ]);

  const input: AutoLogSchedule[] = schedules.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    startTime: s.startTime,
    endTime: s.endTime,
    job: s.job,
    assignments: s.assignments.map((a) => ({
      userId: a.userId,
      userName: a.user.name ?? "Unknown",
      userActive: a.user.active,
    })),
  }));

  const { toLog, skipped } = computeAutoLog({ targetDate, schedules: input, clockEntries, laborEntries });
  const totalHours = toLog.reduce((s, i) => s + i.hours, 0);

  const flagJobs = process.env.AUTO_LOG_JOB_NUMBERS?.trim() || "(not set: auto-log is off)";
  const flagStart = process.env.AUTO_LOG_START_DATE?.trim() || "(not set)";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Auto-log preview (dry run)</h1>
        <p className="text-sm text-gray-500">
          Shows what the nightly auto-log would add for one day. Nothing is saved from this page.
        </p>
      </div>

      <form method="get" className="flex items-end gap-3">
        <label className="text-sm text-gray-700">
          <span className="block text-xs text-gray-500 mb-1">Day (Eastern time)</span>
          <input
            type="date"
            name="date"
            defaultValue={targetDate}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </label>
        <button type="submit" className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50">
          Show
        </button>
      </form>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded px-3 py-2">
        Settings for the real run (not applied to this preview): AUTO_LOG_JOB_NUMBERS = {flagJobs};
        AUTO_LOG_START_DATE = {flagStart}.
      </div>

      <section>
        <h2 className="text-sm font-semibold text-[#1e3a8a] mb-2">
          Would log: {toLog.length} {toLog.length === 1 ? "entry" : "entries"}, {totalHours} hours
        </h2>
        {toLog.length === 0 ? (
          <div className="text-sm text-gray-400">Nothing to log for {targetDate}.</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium text-right">Hours</th>
                  <th className="px-3 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {toLog.map((i) => (
                  <tr key={`${i.scheduleId}-${i.userId}`} className="border-t border-gray-100">
                    <td className="px-3 py-2">{i.jobNumber} {i.jobName}</td>
                    <td className="px-3 py-2">{i.userName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{i.hours}</td>
                    <td className="px-3 py-2 text-gray-500">
                      {i.reason === "forgot_depart" ? "Arrived but never departed: finished at scheduled end" : "Scheduled shift"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Skipped: {skipped.length}</h2>
        {skipped.length === 0 ? (
          <div className="text-sm text-gray-400">Nothing skipped.</div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Job</th>
                  <th className="px-3 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {skipped.map((s) => (
                  <tr key={`${s.scheduleId}-${s.userId}`} className="border-t border-gray-100">
                    <td className="px-3 py-2">{s.jobNumber} {s.jobName}</td>
                    <td className="px-3 py-2">{s.userName}</td>
                    <td className="px-3 py-2 text-gray-500">{REASON_TEXT[s.reason] ?? s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
