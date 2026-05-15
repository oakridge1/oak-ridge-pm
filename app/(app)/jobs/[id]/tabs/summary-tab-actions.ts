"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    throw new Error("Only ADMIN can update billing settings.");
  }
  return session;
}

// ── Direct Costs ───────────────────────────────────────────────────────────────

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

// ── Invoices ───────────────────────────────────────────────────────────────────

export async function createInvoice(jobId: string, data: {
  type: string;
  date: string;
  periodTo: string;
  applicationNo: string;
  amount: string;
  retainagePct: string;
  notes: string;
  lineItems: { label: string; amount: number }[];
}) {
  const session = await requireAdmin();

  if (!data.date) throw new Error("Invoice date is required.");
  if (!data.amount || parseFloat(data.amount) <= 0) throw new Error("Amount must be greater than 0.");

  // Auto-number: find highest existing invoice number for this job
  const last = await prisma.invoice.findFirst({
    where: { jobId },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const invoiceNumber = (last?.invoiceNumber ?? 0) + 1;

  const retainagePct = data.retainagePct ? parseFloat(data.retainagePct) : null;
  const amount = parseFloat(data.amount);
  const retainageHeld = retainagePct != null ? amount * (retainagePct / 100) : null;

  await prisma.invoice.create({
    data: {
      jobId,
      createdById: session.user.id!,
      invoiceNumber,
      type: data.type === "AIA" ? "AIA" : "STANDARD",
      date: new Date(data.date),
      periodTo: data.periodTo ? new Date(data.periodTo) : null,
      applicationNo: data.applicationNo ? parseInt(data.applicationNo) : null,
      status: "DRAFT",
      amount,
      retainagePct,
      retainageHeld,
      lineItems: data.lineItems.length > 0 ? data.lineItems : undefined,
      notes: data.notes.trim() || null,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  jobId: string,
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID"
) {
  await requireAdmin();
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteInvoice(invoiceId: string, jobId: string) {
  await requireAdmin();
  // Only allow deleting DRAFT invoices that have no payments
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: { select: { id: true } } },
  });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "DRAFT") throw new Error("Only DRAFT invoices can be deleted.");
  if (invoice.payments.length > 0) throw new Error("Cannot delete an invoice with recorded payments.");

  await prisma.invoice.delete({ where: { id: invoiceId } });
  revalidatePath(`/jobs/${jobId}`);
}

// ── Payments ───────────────────────────────────────────────────────────────────

export async function addPayment(
  jobId: string,
  date: string,
  amount: string,
  note: string,
  invoiceId?: string,
  checkNumber?: string,
  reference?: string,
  includesRetainageRelease?: boolean
) {
  await requireAdmin();
  if (!date) throw new Error("Date is required.");
  if (!amount || parseFloat(amount) <= 0) throw new Error("Amount must be greater than 0.");

  await prisma.payment.create({
    data: {
      jobId,
      invoiceId: invoiceId || null,
      date: new Date(date),
      amount: parseFloat(amount),
      checkNumber: checkNumber?.trim() || null,
      reference: reference?.trim() || null,
      includesRetainageRelease: includesRetainageRelease ?? false,
      note: note.trim() || null,
    },
  });

  // Auto-update invoice status if linked
  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (invoice) {
      const totalPaid = invoice.payments.reduce((s, p) => s + p.amount.toNumber(), 0);
      const invoiceAmount = invoice.amount.toNumber();
      const newStatus = totalPaid >= invoiceAmount ? "PAID" : "PARTIALLY_PAID";
      await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    }
  }

  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePayment(id: string, jobId: string) {
  await requireAdmin();
  const payment = await prisma.payment.findUnique({ where: { id }, select: { invoiceId: true } });
  await prisma.payment.delete({ where: { id } });

  // Recalculate invoice status after payment removal
  if (payment?.invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (invoice) {
      const totalPaid = invoice.payments.reduce((s, p) => s + p.amount.toNumber(), 0);
      const invoiceAmount = invoice.amount.toNumber();
      const newStatus = totalPaid <= 0 ? "SENT" : totalPaid >= invoiceAmount ? "PAID" : "PARTIALLY_PAID";
      // Only auto-downgrade if not already DRAFT
      if (invoice.status !== "DRAFT") {
        await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: newStatus } });
      }
    }
  }

  revalidatePath(`/jobs/${jobId}`);
}
