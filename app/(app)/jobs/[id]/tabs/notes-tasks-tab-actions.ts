"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function addNote(jobId: string, content: string) {
  const session = await requireActive();
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Note content is required.");

  await prisma.note.create({
    data: {
      jobId,
      userId: session.user.id,
      content: trimmed,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function addJobTask(jobId: string, fd: FormData) {
  const session = await requireActive();

  const title = (fd.get("title") as string | null)?.trim();
  if (!title) throw new Error("Task title is required.");

  const assigneeId = (fd.get("assigneeId") as string | null)?.trim() || null;
  const ballInCourt = (fd.get("ballInCourt") as string | null)?.trim() || null;
  const dueDateRaw = (fd.get("dueDate") as string | null)?.trim() || null;
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;
  const description = (fd.get("description") as string | null)?.trim() || null;

  await prisma.task.create({
    data: {
      jobId,
      title,
      description,
      assigneeId,
      ballInCourt,
      dueDate,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function completeTask(taskId: string) {
  const session = await requireActive();

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedBy: session.user.name ?? session.user.email ?? "Unknown",
    },
  });

  // Get jobId for revalidation
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { jobId: true } });
  if (task) revalidatePath(`/jobs/${task.jobId}`);
}

export async function reopenTask(taskId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    throw new Error("Only ADMIN or OFFICE can reopen tasks.");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "OPEN",
      completedAt: null,
      completedBy: null,
    },
  });

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { jobId: true } });
  if (task) revalidatePath(`/jobs/${task.jobId}`);
}

export async function applySavedTaskToJob(jobId: string, savedTaskId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    throw new Error("Only ADMIN or OFFICE can apply saved task templates.");
  }

  const template = await prisma.savedTask.findUnique({ where: { id: savedTaskId } });
  if (!template) throw new Error("Saved task template not found.");

  // Avoid duplicate — check if this template is already applied to this job
  const existing = await prisma.task.findFirst({
    where: { jobId, savedTaskId },
  });
  if (existing) return; // Already applied

  await prisma.task.create({
    data: {
      jobId,
      savedTaskId,
      title: template.title,
      description: template.description,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteTask(taskId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") {
    throw new Error("Only ADMIN can delete tasks.");
  }

  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { jobId: true } });
  await prisma.task.delete({ where: { id: taskId } });
  if (task) revalidatePath(`/jobs/${task.jobId}`);
}

// ── Change Orders ──────────────────────────────────────────────────────────────

export async function createChangeOrder(
  jobId: string,
  input: {
    description: string;
    date?: string | null;
    location?: string | null;
    reason?: string | null;
    requestedByName?: string | null;
    estimatedHours?: number | null;
    estimatedLaborCost?: number | null;
    estimatedMaterials?: number | null;
  }
) {
  const session = await requireActive();

  const description = input.description.trim();
  if (!description) throw new Error("Description is required.");

  const coCount = await prisma.changeOrder.count({ where: { jobId } });

  await prisma.changeOrder.create({
    data: {
      jobId,
      requestedById: session.user.id,
      coNumber: coCount + 1,
      date: input.date ? new Date(input.date) : null,
      description,
      location: input.location?.trim() || null,
      reason: input.reason?.trim() || null,
      requestedByName: input.requestedByName?.trim() || null,
      estimatedHours: input.estimatedHours ?? null,
      estimatedLaborCost: input.estimatedLaborCost ?? null,
      estimatedMaterials: input.estimatedMaterials ?? null,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateChangeOrder(
  coId: string,
  input: {
    status?: "PENDING" | "APPROVED" | "REJECTED";
    approvedValue?: number | null;
    adminNotes?: string | null;
  }
) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can review change orders.");

  const co = await prisma.changeOrder.findUnique({ where: { id: coId }, select: { jobId: true } });
  if (!co) throw new Error("Change order not found.");

  await prisma.changeOrder.update({
    where: { id: coId },
    data: {
      status: input.status,
      approvedValue: input.approvedValue ?? null,
      adminNotes: input.adminNotes?.trim() || null,
    },
  });

  revalidatePath(`/jobs/${co.jobId}`);
}

export async function deleteChangeOrder(coId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete change orders.");

  const co = await prisma.changeOrder.findUnique({ where: { id: coId }, select: { jobId: true } });
  if (!co) throw new Error("Change order not found.");

  await prisma.changeOrder.delete({ where: { id: coId } });
  revalidatePath(`/jobs/${co.jobId}`);
}
