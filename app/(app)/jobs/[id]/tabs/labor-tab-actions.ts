"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export type DuplicateLaborEntry = {
  userId: string;
  userName: string;
  date: string;
  existingHours: number;
  existingId: string;
};

export async function addLaborEntries(
  jobId: string,
  date: string,
  entries: { userId: string; hours: number }[],
  mode: "check" | "add" | "replace" = "check"
) {
  const session = await requireActive();
  if (!entries.length) throw new Error("No entries provided.");
  if (!date) throw new Error("Date is required.");

  const dateObj = new Date(date);
  // Normalize to midnight UTC for comparison
  const dayStart = new Date(dateObj);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  // Check for duplicates (same job + user + date)
  const userIds = entries.map(e => e.userId);
  const existing = await prisma.laborEntry.findMany({
    where: {
      jobId,
      userId: { in: userIds },
      date: { gte: dayStart, lt: dayEnd },
    },
    include: { user: { select: { name: true } } },
  });

  if (existing.length > 0 && mode === "check") {
    // Return duplicate info for the client to handle
    const duplicates: DuplicateLaborEntry[] = existing.map(e => ({
      userId: e.userId,
      userName: e.user.name ?? "Unknown",
      date: e.date.toISOString(),
      existingHours: e.hours,
      existingId: e.id,
    }));
    return { duplicates };
  }

  if (mode === "replace" && existing.length > 0) {
    // Delete existing entries for these users on this date
    await prisma.laborEntry.deleteMany({
      where: { id: { in: existing.map(e => e.id) } },
    });
  }

  await prisma.laborEntry.createMany({
    data: entries.map((e) => ({
      jobId,
      userId: e.userId,
      date: dateObj,
      hours: e.hours,
      submittedByName: session.user.name ?? session.user.email ?? "Unknown",
    })),
  });

  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

export async function updateLaborEntry(
  id: string,
  jobId: string,
  hours: number,
  date: string
) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can edit entries.");

  await prisma.laborEntry.update({
    where: { id },
    data: { hours, date: new Date(date) },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteLaborEntry(id: string, jobId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete entries.");

  await prisma.laborEntry.delete({ where: { id } });
  revalidatePath(`/jobs/${jobId}`);
}
