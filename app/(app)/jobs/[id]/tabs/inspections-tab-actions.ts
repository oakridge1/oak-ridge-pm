"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyInspectionFailed } from "@/lib/notifications";
import type { InspectionType, InspectionResult } from "@/app/generated/prisma/client";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function createInspection(
  jobId: string,
  input: {
    type: InspectionType;
    dateCalled?: string | null;
    dateScheduled?: string | null;
    inspectorName?: string | null;
    inspectorPhone?: string | null;
    result?: InspectionResult | null;
    correctionNotes?: string | null;
    reinspectDate?: string | null;
    notes?: string | null;
  }
) {
  const session = await requireActive();
  if (session.user.role === "TEAMMATE") throw new Error("Teammates cannot create inspections.");

  const inspection = await prisma.inspection.create({
    data: {
      jobId,
      createdById: session.user.id,
      type: input.type,
      dateCalled: input.dateCalled ? new Date(input.dateCalled) : null,
      dateScheduled: input.dateScheduled ? new Date(input.dateScheduled) : null,
      inspectorName: input.inspectorName?.trim() || null,
      inspectorPhone: input.inspectorPhone?.trim() || null,
      result: input.result ?? null,
      correctionNotes: input.correctionNotes?.trim() || null,
      reinspectDate: input.reinspectDate ? new Date(input.reinspectDate) : null,
      notes: input.notes?.trim() || null,
    },
  });

  // Send notification if inspection failed
  if (input.result === "FAIL") {
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobName: true } });
    if (job) {
      notifyInspectionFailed({
        jobName: job.jobName,
        jobId,
        inspectionType: input.type,
        inspectorName: input.inspectorName ?? null,
        correctionNotes: input.correctionNotes ?? null,
        loggedBy: session.user.name ?? session.user.email ?? "Unknown",
      }).catch((err) => console.error("[notify]", err));
    }
  }

  revalidatePath(`/jobs/${jobId}`);
  return inspection;
}

export async function updateInspection(
  inspectionId: string,
  input: {
    dateCalled?: string | null;
    dateScheduled?: string | null;
    inspectorName?: string | null;
    inspectorPhone?: string | null;
    result?: InspectionResult | null;
    correctionNotes?: string | null;
    reinspectDate?: string | null;
    notes?: string | null;
  }
) {
  const session = await requireActive();
  if (session.user.role === "TEAMMATE") throw new Error("Teammates cannot edit inspections.");

  const existing = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { jobId: true, result: true, type: true },
  });
  if (!existing) throw new Error("Inspection not found.");

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      dateCalled: input.dateCalled !== undefined
        ? (input.dateCalled ? new Date(input.dateCalled) : null)
        : undefined,
      dateScheduled: input.dateScheduled !== undefined
        ? (input.dateScheduled ? new Date(input.dateScheduled) : null)
        : undefined,
      inspectorName: input.inspectorName?.trim() || null,
      inspectorPhone: input.inspectorPhone?.trim() || null,
      result: input.result !== undefined ? (input.result ?? null) : undefined,
      correctionNotes: input.correctionNotes?.trim() || null,
      reinspectDate: input.reinspectDate !== undefined
        ? (input.reinspectDate ? new Date(input.reinspectDate) : null)
        : undefined,
      notes: input.notes?.trim() || null,
    },
  });

  // Notify on new FAIL result
  if (input.result === "FAIL" && existing.result !== "FAIL") {
    const job = await prisma.job.findUnique({ where: { id: existing.jobId }, select: { jobName: true } });
    if (job) {
      notifyInspectionFailed({
        jobName: job.jobName,
        jobId: existing.jobId,
        inspectionType: existing.type,
        inspectorName: input.inspectorName ?? null,
        correctionNotes: input.correctionNotes ?? null,
        loggedBy: session.user.name ?? session.user.email ?? "Unknown",
      }).catch((err) => console.error("[notify]", err));
    }
  }

  revalidatePath(`/jobs/${existing.jobId}`);
}

export async function deleteInspection(inspectionId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete inspections.");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { jobId: true },
  });
  if (!inspection) throw new Error("Inspection not found.");

  await prisma.inspection.delete({ where: { id: inspectionId } });
  revalidatePath(`/jobs/${inspection.jobId}`);
}
