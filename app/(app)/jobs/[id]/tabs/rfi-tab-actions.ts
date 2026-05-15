"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyRfiAnswered } from "@/lib/notifications";
import type { RfiStatus } from "@/app/generated/prisma/client";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function createRfi(
  jobId: string,
  input: {
    subject: string;
    description?: string | null;
    submittedTo?: string | null;
    submittedToEmail?: string | null;
    dueDate?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
  }
) {
  const session = await requireActive();

  const subject = input.subject.trim();
  if (!subject) throw new Error("Subject is required.");

  const count = await prisma.rfi.count({ where: { jobId } });

  await prisma.rfi.create({
    data: {
      jobId,
      submittedById: session.user.id,
      rfiNumber: count + 1,
      subject,
      description: input.description?.trim() || null,
      submittedTo: input.submittedTo?.trim() || null,
      submittedToEmail: input.submittedToEmail?.trim() || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      fileUrl: input.fileUrl || null,
      fileName: input.fileName || null,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateRfi(
  rfiId: string,
  input: {
    status?: RfiStatus;
    answer?: string | null;
    answeredDate?: string | null;
    submittedTo?: string | null;
    submittedToEmail?: string | null;
    dueDate?: string | null;
    description?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
  }
) {
  const session = await requireActive();

  const existing = await prisma.rfi.findUnique({
    where: { id: rfiId },
    include: {
      job: { select: { jobName: true } },
      submittedBy: { select: { name: true, email: true } },
    },
  });
  if (!existing) throw new Error("RFI not found.");

  const wasOpen = existing.status === "OPEN";
  const becomingAnswered = input.status === "ANSWERED";

  await prisma.rfi.update({
    where: { id: rfiId },
    data: {
      status: input.status,
      answer: input.answer !== undefined ? (input.answer?.trim() || null) : undefined,
      answeredDate: input.answeredDate !== undefined
        ? (input.answeredDate ? new Date(input.answeredDate) : (becomingAnswered ? new Date() : null))
        : (becomingAnswered && wasOpen ? new Date() : undefined),
      submittedTo: input.submittedTo !== undefined ? (input.submittedTo?.trim() || null) : undefined,
      submittedToEmail: input.submittedToEmail !== undefined ? (input.submittedToEmail?.trim() || null) : undefined,
      dueDate: input.dueDate !== undefined
        ? (input.dueDate ? new Date(input.dueDate) : null)
        : undefined,
      description: input.description !== undefined ? (input.description?.trim() || null) : undefined,
      fileUrl: input.fileUrl !== undefined ? (input.fileUrl || null) : undefined,
      fileName: input.fileName !== undefined ? (input.fileName || null) : undefined,
    },
  });

  // Notify submitter if RFI was just answered
  if (wasOpen && becomingAnswered) {
    notifyRfiAnswered({
      submitterEmail: existing.submittedBy.email,
      submitterName: existing.submittedBy.name,
      jobName: existing.job.jobName,
      jobId: existing.jobId,
      rfiNumber: existing.rfiNumber,
      subject: existing.subject,
      answer: input.answer ?? existing.answer,
    }).catch(() => {});
  }

  revalidatePath(`/jobs/${existing.jobId}`);
}

export async function deleteRfi(rfiId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete RFIs.");

  const rfi = await prisma.rfi.findUnique({ where: { id: rfiId }, select: { jobId: true } });
  if (!rfi) throw new Error("RFI not found.");

  await prisma.rfi.delete({ where: { id: rfiId } });
  revalidatePath(`/jobs/${rfi.jobId}`);
}
