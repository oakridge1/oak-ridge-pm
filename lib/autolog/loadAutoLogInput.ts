import { prisma } from "@/lib/prisma";
import type { AutoLogInput } from "./computeAutoLog";

/** READ-ONLY. Loads the data computeAutoLog needs for one Eastern calendar date. */
export async function loadAutoLogInput(targetDate: string): Promise<AutoLogInput> {
  const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
  const dayMs = 24 * 60 * 60 * 1000;

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

  const [clockEntries, laborEntries] = await Promise.all([
    prisma.clockEntry.findMany({
      where: { scheduleId: { in: scheduleIds } },
      select: { id: true, scheduleId: true, userId: true, arrivedAt: true, departedAt: true },
    }),
    prisma.laborEntry.findMany({
      // wide window so Eastern-time conversion can't miss an entry; the planner does the exact match
      where: {
        jobId: { in: jobIds },
        date: { gte: new Date(dayStart.getTime() - dayMs), lt: new Date(dayStart.getTime() + 2 * dayMs) },
      },
      select: { id: true, jobId: true, userId: true, date: true, scheduleId: true },
    }),
  ]);

  return {
    targetDate,
    schedules: schedules.map((s) => ({
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
    })),
    clockEntries,
    laborEntries,
  };
}
