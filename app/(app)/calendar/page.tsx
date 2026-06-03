import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Calendar } from "lucide-react";
import { MasterCalendar } from "./master-calendar";
import { parseLocalDate } from "@/lib/dateUtils";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");

  const [events, jobs, tasks, inspections] = await Promise.all([
    prisma.calendarEvent.findMany({
      orderBy: { date: "asc" },
      include: {
        user: { select: { name: true } },
        job: {
          select: {
            jobName: true,
            jobNumber: true,
            calendarColor: true,
          },
        },
      },
    }),
    prisma.job.findMany({
      where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
      select: {
        id: true,
        jobName: true,
        jobNumber: true,
        calendarColor: true,
        completionDate: true,
        contractStartDate: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.findMany({
      where: { dueDate: { not: null }, status: { not: "COMPLETED" } },
      select: {
        id: true,
        title: true,
        dueDate: true,
        jobId: true,
        job: { select: { jobName: true, jobNumber: true, calendarColor: true } },
      },
    }),
    prisma.inspection.findMany({
      where: { dateScheduled: { not: null }, job: { status: { in: ["ACTIVE", "ON_HOLD"] } } },
      select: {
        id: true,
        dateScheduled: true,
        type: true,
        result: true,
        jobId: true,
        job: { select: { jobName: true, jobNumber: true, calendarColor: true } },
      },
    }),
  ]);

  // Inspection type labels for readable titles
  const INSP_LABELS: Record<string, string> = {
    UNDERGROUND: "Underground", ROUGH_IN: "Rough-In", SERVICE: "Service",
    FIRE_ALARM: "Fire Alarm", SPECIAL: "Special", FINAL: "Final",
  };

  // Build synthetic CalendarEvent-compatible objects for dates, tasks, and inspections
  const syntheticEvents = [
    // Job contract start and completion milestones
    ...jobs.flatMap((job) => {
      const ev = [];
      if (job.contractStartDate) {
        ev.push({
          id: `start-${job.id}`,
          type: "MILESTONE" as const,
          title: `Start: ${job.jobName}`,
          date: parseLocalDate(job.contractStartDate),
          note: null,
          jobId: job.id,
          recurrence: "NONE",
          recurrenceEndDate: null,
          user: { name: null },
          job: { jobName: job.jobName, jobNumber: job.jobNumber, calendarColor: job.calendarColor },
        });
      }
      if (job.completionDate) {
        ev.push({
          id: `completion-${job.id}`,
          type: "COMPLETION" as const,
          title: `Complete: ${job.jobName}`,
          date: parseLocalDate(job.completionDate),
          note: null,
          jobId: job.id,
          recurrence: "NONE",
          recurrenceEndDate: null,
          user: { name: null },
          job: { jobName: job.jobName, jobNumber: job.jobNumber, calendarColor: job.calendarColor },
        });
      }
      return ev;
    }),
    // Task due dates
    ...tasks
      .filter((t) => t.dueDate != null)
      .map((t) => ({
        id: `task-${t.id}`,
        type: "TASK_DUE" as const,
        title: t.job ? `${t.title} (${t.job.jobNumber})` : t.title,
        date: parseLocalDate(t.dueDate!),
        note: null,
        jobId: t.jobId,
        recurrence: "NONE",
        recurrenceEndDate: null,
        user: { name: null },
        job: t.job,
      })),
    // Scheduled inspections
    ...inspections
      .filter((i) => i.dateScheduled != null)
      .map((i) => ({
        id: `insp-${i.id}`,
        type: "CUSTOM" as const,
        title: `${INSP_LABELS[i.type] ?? i.type} Inspection${i.result ? ` (${i.result})` : ""}${i.job ? ` — ${i.job.jobNumber}` : ""}`,
        date: parseLocalDate(i.dateScheduled!),
        note: null,
        jobId: i.jobId,
        recurrence: "NONE",
        recurrenceEndDate: null,
        user: { name: null },
        job: i.job,
      })),
  ];

  const allEvents = [...events, ...syntheticEvents];

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#002D72] flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#002D72]">Master Calendar</h1>
        </div>
        <p className="text-sm text-gray-500">
          All events across all active jobs — milestones, completions, and days
          off.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <MasterCalendar
          events={allEvents}
          jobs={jobs}
          role={session.user.role}
        />
      </div>
    </div>
  );
}
