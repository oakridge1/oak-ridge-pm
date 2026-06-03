"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/permissions";
import { notifyScheduleChange } from "@/lib/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

async function requireManageCalendar() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  const canManage = await hasPermission(
    session.user.id,
    session.user.role!,
    "MANAGE_CALENDAR"
  );
  if (!canManage) throw new Error("Permission denied");
  return session;
}

// ── createSchedule ────────────────────────────────────────────────────────────

export async function createSchedule(data: {
  jobId:     string;
  date:      string;   // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime:   string;   // HH:MM
  notes:     string;
  userIds:   string[]; // assigned team members
}) {
  const session = await requireManageCalendar();

  const schedule = await prisma.schedule.create({
    data: {
      jobId:       data.jobId,
      date:        new Date(data.date + "T12:00:00"),
      startTime:   data.startTime || null,
      endTime:     data.endTime || null,
      notes:       data.notes || null,
      createdById: session.user.id!,
      assignments: {
        create: data.userIds.map((userId) => ({ userId })),
      },
    },
    include: {
      job:         { select: { jobName: true, jobNumber: true } },
      assignments: { include: { user: { select: { name: true, email: true } } } },
      createdBy:   { select: { name: true } },
    },
  });

  const changeDesc =
    `Scheduled for ${data.date}` +
    (data.startTime ? ` at ${formatTime(data.startTime)}` : "") +
    (data.endTime   ? ` – ${formatTime(data.endTime)}`   : "");

  await notifyScheduleChange({
    jobId:      data.jobId,
    jobName:    schedule.job.jobName,
    changeDesc,
    changedBy:  session.user.name ?? "Admin",
  });

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true, scheduleId: schedule.id };
}

// ── updateSchedule ────────────────────────────────────────────────────────────

export async function updateSchedule(
  scheduleId: string,
  data: {
    jobId?:     string;
    date?:      string;
    startTime?: string;
    endTime?:   string;
    notes?:     string;
    userIds?:   string[];
  }
) {
  const session = await requireManageCalendar();

  await prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      ...(data.jobId     && { jobId: data.jobId }),
      ...(data.date      && { date: new Date(data.date + "T12:00:00") }),
      ...(data.startTime !== undefined && { startTime: data.startTime || null }),
      ...(data.endTime   !== undefined && { endTime: data.endTime || null }),
      ...(data.notes     !== undefined && { notes: data.notes || null }),
    },
  });

  if (data.userIds) {
    await prisma.scheduleAssignment.deleteMany({ where: { scheduleId } });
    await prisma.scheduleAssignment.createMany({
      data: data.userIds.map((userId) => ({ scheduleId, userId })),
    });
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { job: { select: { jobName: true } } },
  });

  if (schedule) {
    await notifyScheduleChange({
      jobId:      schedule.jobId,
      jobName:    schedule.job.jobName,
      changeDesc: "Schedule has been updated — please check your calendar.",
      changedBy:  session.user.name ?? "Admin",
    });
  }

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── deleteSchedule ────────────────────────────────────────────────────────────

export async function deleteSchedule(scheduleId: string) {
  await requireManageCalendar();
  await prisma.schedule.delete({ where: { id: scheduleId } });
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── clockIn (Arrive) ──────────────────────────────────────────────────────────

export async function clockIn(scheduleId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Verify user is assigned to this schedule
  const assignment = await prisma.scheduleAssignment.findUnique({
    where: {
      scheduleId_userId: {
        scheduleId,
        userId: session.user.id,
      },
    },
  });
  if (!assignment) throw new Error("Not assigned to this schedule");

  const existing = await prisma.clockEntry.findUnique({
    where: {
      scheduleId_userId: {
        scheduleId,
        userId: session.user.id,
      },
    },
  });
  if (existing?.arrivedAt) throw new Error("Already clocked in");

  const arrivedAt = new Date();

  await prisma.clockEntry.upsert({
    where: {
      scheduleId_userId: {
        scheduleId,
        userId: session.user.id,
      },
    },
    create: { scheduleId, userId: session.user.id, arrivedAt },
    update: { arrivedAt },
  });

  revalidatePath("/dashboard");
  return { success: true, arrivedAt };
}

// ── clockOut (Depart) ─────────────────────────────────────────────────────────

export async function clockOut(scheduleId: string, lunchDeducted: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const entry = await prisma.clockEntry.findUnique({
    where: {
      scheduleId_userId: {
        scheduleId,
        userId: session.user.id,
      },
    },
    include: {
      schedule: {
        include: {
          job: { select: { id: true, jobName: true } },
        },
      },
    },
  });

  if (!entry)           throw new Error("No clock-in found");
  if (!entry.arrivedAt) throw new Error("Must clock in first");
  if (entry.departedAt) throw new Error("Already clocked out");

  const departedAt  = new Date();
  const rawHours    = (departedAt.getTime() - entry.arrivedAt.getTime()) / (1000 * 60 * 60);
  const hoursWorked = lunchDeducted ? Math.max(0, rawHours - 0.5) : rawHours;
  const roundedHours = Math.round(hoursWorked * 100) / 100;

  // LaborEntry only stores jobId, userId, date, hours, submittedByName
  const laborEntry = await prisma.laborEntry.create({
    data: {
      jobId:           entry.schedule.job.id,
      userId:          session.user.id,
      date:            new Date(departedAt.toISOString().slice(0, 10) + "T12:00:00"),
      hours:           roundedHours,
      submittedByName: `Auto-logged via clock out — ${entry.schedule.job.jobName}`,
    },
  });

  await prisma.clockEntry.update({
    where: { id: entry.id },
    data: {
      departedAt,
      lunchDeducted,
      hoursWorked:  roundedHours,
      laborEntryId: laborEntry.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${entry.schedule.job.id}`);
  return {
    success:     true,
    hoursWorked: roundedHours,
    jobName:     entry.schedule.job.jobName,
  };
}

// ── getMySchedule — for dashboard ─────────────────────────────────────────────

export async function getMySchedule(weekStart: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const start = new Date(weekStart + "T00:00:00");
  const end   = new Date(weekStart + "T00:00:00");
  end.setDate(end.getDate() + 7);

  const assignments = await prisma.scheduleAssignment.findMany({
    where: {
      userId: session.user.id,
      schedule: {
        date: { gte: start, lt: end },
      },
    },
    include: {
      schedule: {
        include: {
          job: { select: { id: true, jobName: true, jobNumber: true, address: true } },
          clockEntries: {
            where: { userId: session.user.id },
          },
        },
      },
    },
    orderBy: { schedule: { date: "asc" } },
  });

  return assignments.map((a) => ({
    scheduleId: a.scheduleId,
    date:       a.schedule.date.toISOString().slice(0, 10),
    startTime:  a.schedule.startTime,
    endTime:    a.schedule.endTime,
    notes:      a.schedule.notes,
    job: {
      id:      a.schedule.job.id,
      name:    a.schedule.job.jobName,
      number:  a.schedule.job.jobNumber,
      address: a.schedule.job.address,
    },
    clockEntry: a.schedule.clockEntries[0] ?? null,
  }));
}

// ── getSchedulesForCalendar ───────────────────────────────────────────────────

export async function getSchedulesForCalendar(month: number, year: number) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const start = new Date(year, month - 1, 1);
  const end   = new Date(year, month, 1);

  const isPrivileged =
    session.user.role === "ADMIN" || session.user.role === "OFFICE";

  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: start, lt: end },
      ...(!isPrivileged && {
        assignments: { some: { userId: session.user.id } },
      }),
    },
    include: {
      job: { select: { id: true, jobName: true, jobNumber: true } },
      assignments: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: "asc" },
  });

  return schedules.map((s) => ({
    id:        s.id,
    date:      s.date.toISOString().slice(0, 10),
    startTime: s.startTime,
    endTime:   s.endTime,
    notes:     s.notes,
    job: {
      id:     s.job.id,
      name:   s.job.jobName,
      number: s.job.jobNumber,
    },
    assignees: s.assignments.map((a) => ({
      id:   a.user.id,
      name: a.user.name ?? "Unknown",
    })),
  }));
}
