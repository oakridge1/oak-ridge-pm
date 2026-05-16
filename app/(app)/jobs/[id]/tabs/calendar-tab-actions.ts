"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { CalendarEventType } from "@/app/generated/prisma/client";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function addCalendarEvent(jobId: string, fd: FormData) {
  const session = await requireActive();

  const type = (fd.get("type") as CalendarEventType | null) ?? "CUSTOM";
  const title = (fd.get("title") as string | null)?.trim();
  const dateRaw = (fd.get("date") as string | null)?.trim();
  const note = (fd.get("note") as string | null)?.trim() || null;
  const recurrence = (fd.get("recurrence") as string | null) || "NONE";
  const endDateRaw = (fd.get("recurrenceEndDate") as string | null)?.trim() || null;

  if (!title) throw new Error("Event title is required.");
  if (!dateRaw) throw new Error("Event date is required.");

  if (session.user.role === "TEAMMATE" && type !== "DAY_OFF") {
    throw new Error("Teammates can only add Day Off events.");
  }
  if ((type === "MILESTONE" || type === "CUSTOM") && session.user.role !== "ADMIN" && session.user.role !== "FOREMAN") {
    throw new Error("Only ADMIN or FOREMAN can add Milestone or Custom events.");
  }

  const event = await prisma.calendarEvent.create({
    data: {
      jobId,
      userId: session.user.id,
      type,
      title,
      date: new Date(dateRaw),
      note,
      recurrence,
      recurrenceEndDate: endDateRaw ? new Date(endDateRaw) : null,
    },
  });

  // Real-time Google Calendar sync (best-effort — don't block if it fails)
  try {
    const { syncCalendarEventToGoogle } = await import("@/lib/google");
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, jobNumber: true, jobName: true },
    });
    const googleEventId = await syncCalendarEventToGoogle({
      eventId: event.id,
      title,
      date: new Date(dateRaw),
      allDay: true,
      note,
      recurrence,
      recurrenceEndDate: endDateRaw ? new Date(endDateRaw) : null,
      job,
    });
    if (googleEventId) {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { googleEventId },
      });
    }
  } catch (err) {
    console.error("[calendar-tab] Google sync failed (non-fatal):", err);
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/calendar");
}

export async function deleteCalendarEvent(eventId: string, jobId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN" && session.user.role !== "FOREMAN") {
    throw new Error("Only ADMIN or FOREMAN can delete calendar events.");
  }

  // Fetch the event to get googleEventId before deleting
  const eventToDelete = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { googleEventId: true },
  });

  if (eventToDelete?.googleEventId) {
    try {
      const { deleteCalendarEventFromGoogle } = await import("@/lib/google");
      await deleteCalendarEventFromGoogle(eventToDelete.googleEventId);
    } catch (err) {
      console.error("[calendar-tab] Google delete sync failed (non-fatal):", err);
    }
  }

  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/calendar");
}
