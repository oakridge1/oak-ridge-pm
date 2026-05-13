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

  if (session.user.role === "FIELD" && type !== "DAY_OFF") {
    throw new Error("Field users can only add Day Off events.");
  }
  if ((type === "MILESTONE" || type === "CUSTOM") && session.user.role !== "ADMIN") {
    throw new Error("Only ADMIN can add Milestone or Custom events.");
  }

  await prisma.calendarEvent.create({
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

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/calendar");
}

export async function deleteCalendarEvent(eventId: string, jobId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") {
    throw new Error("Only ADMIN can delete calendar events.");
  }

  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/calendar");
}
