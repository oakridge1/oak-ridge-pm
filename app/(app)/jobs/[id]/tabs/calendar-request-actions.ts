"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyCalendarRequestSubmitted, notifyCalendarRequestDecision } from "@/lib/notifications";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function submitCalendarRequest(
  jobId: string,
  data: {
    date: string;
    timeOfDay?: string;
    description: string;
    reason?: string;
  }
) {
  const session = await requireActive();

  if (!data.date) throw new Error("Date is required.");
  if (!data.description?.trim()) throw new Error("Description is required.");

  const request = await prisma.calendarRequest.create({
    data: {
      jobId,
      requestedById: session.user.id,
      date: new Date(data.date),
      timeOfDay: data.timeOfDay?.trim() || null,
      description: data.description.trim(),
      reason: data.reason?.trim() || null,
    },
  });

  // Notify foreman + admins
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      jobName: true,
      foreman: { select: { email: true, name: true } },
    },
  });
  if (job) {
    notifyCalendarRequestSubmitted({
      jobName: job.jobName,
      jobId,
      requestId: request.id,
      date: data.date,
      description: data.description.trim(),
      reason: data.reason ?? null,
      submittedBy: session.user.name ?? session.user.email ?? "Unknown",
      foremanEmail: job.foreman?.email ?? null,
    }).catch((err) => console.error("[notify]", err));
  }

  revalidatePath(`/jobs/${jobId}`);
}

export async function reviewCalendarRequest(
  requestId: string,
  status: "APPROVED" | "DENIED",
  reviewNotes?: string
) {
  const session = await requireActive();

  // Only ADMIN or FOREMAN assigned to this job can review
  const req = await prisma.calendarRequest.findUnique({
    where: { id: requestId },
    select: {
      jobId: true,
      date: true,
      timeOfDay: true,
      description: true,
      status: true,
      requestedBy: { select: { email: true, name: true } },
      job: { select: { jobName: true, foremanId: true } },
    },
  });
  if (!req) throw new Error("Request not found.");
  if (req.status !== "PENDING") throw new Error("This request has already been reviewed.");

  const isAdmin = session.user.role === "ADMIN";
  const isAssignedForeman =
    session.user.role === "FOREMAN" && req.job.foremanId === session.user.id;
  if (!isAdmin && !isAssignedForeman) {
    throw new Error("Only ADMIN or the assigned foreman can review calendar requests.");
  }

  await prisma.calendarRequest.update({
    where: { id: requestId },
    data: {
      status,
      reviewedById: session.user.id,
      reviewNotes: reviewNotes?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  // If approved, create the calendar event
  if (status === "APPROVED") {
    await prisma.calendarEvent.create({
      data: {
        jobId: req.jobId,
        userId: session.user.id,
        type: "CUSTOM",
        title: req.description,
        date: req.date,
        note: req.timeOfDay ? `Time: ${req.timeOfDay}` : null,
      },
    });
  }

  // Notify requester
  notifyCalendarRequestDecision({
    requesterEmail: req.requestedBy.email,
    requesterName: req.requestedBy.name,
    jobName: req.job.jobName,
    jobId: req.jobId,
    date: req.date.toISOString().split("T")[0],
    description: req.description,
    status,
    reviewNotes: reviewNotes ?? null,
    reviewedBy: session.user.name ?? session.user.email ?? "Unknown",
  }).catch((err) => console.error("[notify]", err));

  revalidatePath(`/jobs/${req.jobId}`);
  revalidatePath("/calendar");
}
