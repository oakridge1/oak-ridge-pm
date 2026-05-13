"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireAdmin(jobId?: string) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    throw new Error("Only ADMIN can update billing settings.");
  }
  return session;
}

export async function updateDirectCosts(
  jobId: string,
  data: {
    blendedLaborRate: string;
    subcontractorCost: string;
    equipmentCost: string;
    equipmentBillPct: string;
  }
) {
  await requireAdmin();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      blendedLaborRate: data.blendedLaborRate ? parseFloat(data.blendedLaborRate) : null,
      subcontractorCost: data.subcontractorCost ? parseFloat(data.subcontractorCost) : null,
      equipmentCost: data.equipmentCost ? parseFloat(data.equipmentCost) : null,
      equipmentBillPct: data.equipmentBillPct ? parseFloat(data.equipmentBillPct) : null,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateMarkups(
  jobId: string,
  data: {
    laborMarkupPct: string;
    subMarkupPct: string;
    equipmentMarkupPct: string;
  }
) {
  await requireAdmin();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      laborMarkupPct: data.laborMarkupPct ? parseFloat(data.laborMarkupPct) : null,
      subMarkupPct: data.subMarkupPct ? parseFloat(data.subMarkupPct) : null,
      equipmentMarkupPct: data.equipmentMarkupPct ? parseFloat(data.equipmentMarkupPct) : null,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function addOtherCost(
  jobId: string,
  description: string,
  amount: string
) {
  await requireAdmin();
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { otherCosts: true } });
  const current = (job?.otherCosts as { id: string; description: string; amount: number }[] | null) ?? [];
  current.push({ id: crypto.randomUUID(), description: description.trim(), amount: parseFloat(amount) });
  await prisma.job.update({ where: { id: jobId }, data: { otherCosts: current } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteOtherCost(jobId: string, costId: string) {
  await requireAdmin();
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { otherCosts: true } });
  const current = ((job?.otherCosts as { id: string }[] | null) ?? []).filter((c) => c.id !== costId);
  await prisma.job.update({ where: { id: jobId }, data: { otherCosts: current } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function addPayment(
  jobId: string,
  date: string,
  amount: string,
  note: string
) {
  await requireAdmin();
  if (!date) throw new Error("Date is required.");
  if (!amount || parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0.");

  await prisma.payment.create({
    data: {
      jobId,
      date: new Date(date),
      amount: parseFloat(amount),
      note: note.trim() || null,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePayment(id: string, jobId: string) {
  await requireAdmin();
  await prisma.payment.delete({ where: { id } });
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateContractBudget(
  jobId: string,
  data: {
    contractValue: string;
    laborBudgetHours: string;
    materialBudget: string;
  }
) {
  await requireAdmin();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      contractValue: data.contractValue ? data.contractValue : null,
      laborBudgetHours: data.laborBudgetHours ? parseFloat(data.laborBudgetHours) : null,
      materialBudget: data.materialBudget ? data.materialBudget : null,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}
