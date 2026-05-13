"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function addLaborEntries(
  jobId: string,
  date: string,
  entries: { userId: string; hours: number }[]
) {
  const session = await requireActive();
  if (!entries.length) throw new Error("No entries provided.");
  if (!date) throw new Error("Date is required.");

  const dateObj = new Date(date);

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
