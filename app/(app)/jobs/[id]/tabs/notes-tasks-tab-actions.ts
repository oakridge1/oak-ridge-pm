"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  notifyNewNote,
  notifyTaskAssigned,
  notifyBallInCourt,
  notifyTaskCompleted,
  notifyCoSubmitted,
  notifyCoReviewed,
} from "@/lib/notifications";

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

  // Notify admins/office if a field user posts a note
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobName: true } });
  if (job) {
    notifyNewNote({
      jobName: job.jobName,
      jobId,
      content: trimmed,
      postedBy: session.user.name ?? session.user.email ?? "Unknown",
      posterRole: session.user.role,
    }).catch((err) => console.error("[notify]", err));
  }

  revalidatePath(`/jobs/${jobId}`);
}

export async function addJobTask(jobId: string, fd: FormData) {
  const session = await requireActive();

  const title = (fd.get("title") as string | null)?.trim();
  if (!title) throw new Error("Task title is required.");

  const assigneeId = (fd.get("assigneeId") as string | null)?.trim() || null;
  // ballInCourt is stored as a JSON array of user IDs: '["id1","id2"]'
  const ballInCourtRaw = fd.getAll("ballInCourt") as string[];
  const ballInCourt = ballInCourtRaw.length > 0
    ? JSON.stringify(ballInCourtRaw)
    : null;
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

  // Fire notifications (non-blocking)
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobName: true } });
  if (job) {
    // Notify assignee
    if (assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { email: true, name: true },
      });
      if (assignee) {
        notifyTaskAssigned({
          assigneeEmail: assignee.email,
          assigneeName: assignee.name,
          taskTitle: title,
          jobName: job.jobName,
          jobId,
          assignedBy: session.user.name ?? session.user.email ?? "Unknown",
        }).catch((err) => console.error("[notify]", err));
      }
    }
    // Notify ball in court users
    if (ballInCourtRaw.length > 0) {
      const bicUsers = await prisma.user.findMany({
        where: { id: { in: ballInCourtRaw }, active: true },
        select: { email: true },
      });
      const emails = bicUsers.map((u) => u.email).filter((e) => e !== session.user.email);
      if (emails.length > 0) {
        notifyBallInCourt({
          userEmails: emails,
          taskTitle: title,
          jobName: job.jobName,
          jobId,
          updatedBy: session.user.name ?? session.user.email ?? "Unknown",
        }).catch((err) => console.error("[notify]", err));
      }
    }
  }

  revalidatePath(`/jobs/${jobId}`);
}

export async function completeTask(taskId: string) {
  const session = await requireActive();
  const completedByName = session.user.name ?? session.user.email ?? "Unknown";

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      completedBy: completedByName,
    },
  });

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { jobId: true, title: true },
  });
  if (task) {
    const job = await prisma.job.findUnique({ where: { id: task.jobId }, select: { jobName: true } });
    if (job) {
      notifyTaskCompleted({
        taskTitle: task.title,
        jobName: job.jobName,
        jobId: task.jobId,
        completedBy: completedByName,
      }).catch((err) => console.error("[notify]", err));
    }
    revalidatePath(`/jobs/${task.jobId}`);
  }
}

export async function reopenTask(taskId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE" && session.user.role !== "FOREMAN") {
    throw new Error("Only ADMIN, OFFICE, or FOREMAN can reopen tasks.");
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
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE" && session.user.role !== "FOREMAN") {
    throw new Error("Only ADMIN, OFFICE, or FOREMAN can apply saved task templates.");
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

  const coNumber = coCount + 1;
  await prisma.changeOrder.create({
    data: {
      jobId,
      requestedById: session.user.id,
      coNumber,
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

  // Notify admins/office of new CO
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobName: true } });
  if (job) {
    notifyCoSubmitted({
      jobName: job.jobName,
      jobId,
      coNumber,
      description,
      submittedBy: session.user.name ?? session.user.email ?? "Unknown",
    }).catch((err) => console.error("[notify]", err));
  }

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

  const co = await prisma.changeOrder.findUnique({
    where: { id: coId },
    select: {
      jobId: true,
      status: true,
      coNumber: true,
      description: true,
      approvedValue: true,
      adminNotes: true,
      requestedBy: { select: { email: true, name: true } },
      job: { select: { jobName: true, foremanId: true } },
    },
  });
  if (!co) throw new Error("Change order not found.");

  // Permission: ADMIN always; FOREMAN only if assigned to this job
  if (session.user.role !== "ADMIN") {
    if (session.user.role === "FOREMAN" && co.job.foremanId === session.user.id) {
      // allowed
    } else {
      throw new Error("Only ADMIN or the assigned foreman can review change orders.");
    }
  }

  await prisma.changeOrder.update({
    where: { id: coId },
    data: {
      status: input.status,
      approvedValue: input.approvedValue ?? null,
      adminNotes: input.adminNotes?.trim() || null,
    },
  });

  // Auto-create a cost code when CO is approved for the first time
  if (input.status === "APPROVED" && co.status !== "APPROVED") {
    const coNum = co.coNumber ?? 1;
    const codeStr = `400-${String(coNum).padStart(3, "0")}`;
    const desc = co.description?.trim() || "Change Order";
    const fullDesc = `CO ${coNum} — ${desc}`;
    // Only create if one doesn't exist for this CO yet
    const existing = await prisma.costCode.findFirst({
      where: { jobId: co.jobId, coId },
    });
    if (!existing) {
      // Find highest sortOrder so CO codes go at the end
      const lastCode = await prisma.costCode.findFirst({
        where: { jobId: co.jobId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      await prisma.costCode.create({
        data: {
          jobId: co.jobId,
          code: codeStr,
          description: fullDesc,
          type: "co",
          coId,
          sortOrder: (lastCode?.sortOrder ?? 4) + 1,
        },
      });
    }
  }

  // Notify requester if status changed to APPROVED or REJECTED
  const newStatus = input.status;
  if (
    newStatus &&
    newStatus !== co.status &&
    (newStatus === "APPROVED" || newStatus === "REJECTED")
  ) {
    notifyCoReviewed({
      requesterEmail: co.requestedBy.email,
      requesterName: co.requestedBy.name,
      jobName: co.job.jobName,
      jobId: co.jobId,
      coNumber: co.coNumber,
      status: newStatus,
      adminNotes: input.adminNotes ?? co.adminNotes,
      approvedValue: input.approvedValue ?? co.approvedValue?.toNumber() ?? null,
    }).catch((err) => console.error("[notify]", err));
  }

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
