"use server";
import { generateId } from '@/lib/utils/uuid';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { notifyPaymentRecorded } from "@/lib/notifications";
import type { PermissionKey } from "@/lib/permissions";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    throw new Error("Only ADMIN can update billing settings.");
  }
  return session;
}

// ADMIN and OFFICE always pass. Foremen pass on their own job. Anyone else passes if they
// have the named permission granted via the UserPermission table.
async function requirePermission(jobId: string, permission: PermissionKey) {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  const { role, id: userId } = session.user;
  if (role === "ADMIN" || role === "OFFICE") return session;
  if (role === "FOREMAN") {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { foremanId: true, createdById: true },
    });
    if (job && (job.foremanId === userId || job.createdById === userId)) return session;
  }
  const perm = await prisma.userPermission.findFirst({ where: { userId, permission } });
  if (perm) return session;
  throw new Error("You don't have permission to perform this action.");
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

// Combined save — costs + markups + per-item other cost markups in one round-trip
export async function updateDirectCostsWithMarkups(
  jobId: string,
  data: {
    blendedLaborRate: string;
    laborMarkupPct: string;
    subcontractorCost: string;
    subcontractorBillPct: string;
    subMarkupPct: string;
    equipmentCost: string;
    equipmentBillPct: string;
    equipmentMarkupPct: string;
    materialMarkupPct: string;
    otherMarkupPct: string;
    otherCosts: { id: string; description: string; amount: number; markupPct: number }[];
    laborBudgetDollars?: string;
    materialBudget?: string;
  }
) {
  await requireAdmin();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      blendedLaborRate: data.blendedLaborRate ? parseFloat(data.blendedLaborRate) : null,
      laborMarkupPct:   data.laborMarkupPct   ? parseFloat(data.laborMarkupPct)   : null,
      laborBudgetDollars: data.laborBudgetDollars !== undefined
        ? (data.laborBudgetDollars ? parseFloat(data.laborBudgetDollars) : null) : undefined,
      subcontractorCost:    data.subcontractorCost    ? parseFloat(data.subcontractorCost)    : null,
      subcontractorBillPct: data.subcontractorBillPct ? parseFloat(data.subcontractorBillPct) : null,
      subMarkupPct:         data.subMarkupPct         ? parseFloat(data.subMarkupPct)         : null,
      equipmentCost:     data.equipmentCost     ? parseFloat(data.equipmentCost)     : null,
      equipmentBillPct:  data.equipmentBillPct  ? parseFloat(data.equipmentBillPct)  : null,
      equipmentMarkupPct: data.equipmentMarkupPct ? parseFloat(data.equipmentMarkupPct) : null,
      materialMarkupPct:  data.materialMarkupPct  ? parseFloat(data.materialMarkupPct)  : null,
      materialBudget: data.materialBudget !== undefined
        ? (data.materialBudget ? parseFloat(data.materialBudget) : null) : undefined,
      otherMarkupPct:     data.otherMarkupPct     ? parseFloat(data.otherMarkupPct)     : null,
      otherCosts: data.otherCosts,
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
    materialMarkupPct: string;
    otherMarkupPct: string;
  }
) {
  await requireAdmin();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      laborMarkupPct: data.laborMarkupPct ? parseFloat(data.laborMarkupPct) : null,
      subMarkupPct: data.subMarkupPct ? parseFloat(data.subMarkupPct) : null,
      equipmentMarkupPct: data.equipmentMarkupPct ? parseFloat(data.equipmentMarkupPct) : null,
      materialMarkupPct: data.materialMarkupPct ? parseFloat(data.materialMarkupPct) : null,
      otherMarkupPct: data.otherMarkupPct ? parseFloat(data.otherMarkupPct) : null,
    },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function addOtherCost(
  jobId: string,
  description: string,
  amount: string,
  markupPct?: string
) {
  await requireAdmin();
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { otherCosts: true } });
  const current = (job?.otherCosts as { id: string; description: string; amount: number; markupPct?: number }[] | null) ?? [];
  current.push({
    id: generateId(),
    description: description.trim(),
    amount: parseFloat(amount),
    markupPct: markupPct ? parseFloat(markupPct) : 0,
  });
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
    laborBudgetDollars: string;
    materialBudget: string;
  }
) {
  await requireAdmin();
  await prisma.job.update({
    where: { id: jobId },
    data: {
      contractValue: data.contractValue ? data.contractValue : null,
      laborBudgetDollars: data.laborBudgetDollars ? parseFloat(data.laborBudgetDollars) : null,
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
  paymentTerms?: string;
  scopeOfWork?: string;
  lineItems: Record<string, unknown>[];
  invoiceKind?: string;
  force?: boolean;
}) {
  const session = await requirePermission(jobId, "CREATE_INVOICES");

  if (!data.date) throw new Error("Invoice date is required.");
  if (!data.amount || parseFloat(data.amount) <= 0) throw new Error("Amount must be greater than 0.");

  // Duplicate check: warn if an invoice already exists for the same date/period
  if (!data.force) {
    const invoiceDate = new Date(data.date);
    const monthStart = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth(), 1);
    const monthEnd = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + 1, 0, 23, 59, 59);
    const existingInMonth = await prisma.invoice.findFirst({
      where: {
        jobId,
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { invoiceNumber: true, date: true },
    });
    if (existingInMonth) {
      return {
        duplicate: {
          invoiceNumber: existingInMonth.invoiceNumber,
          date: existingInMonth.date.toISOString(),
        },
      };
    }
  }

  // Auto-number: find highest existing invoice number for this job
  const last = await prisma.invoice.findFirst({
    where: { jobId },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const invoiceNumber = (last?.invoiceNumber ?? 0) + 1;

  const retainagePctRaw = data.retainagePct ? parseFloat(data.retainagePct) : null;
  const retainagePct = data.type === "AIA" ? (retainagePctRaw ?? 10) : (retainagePctRaw ?? null);
  const amount = parseFloat(data.amount);
  const retainageHeld = retainagePct != null ? amount * (retainagePct / 100) : null;

  // Generate share token for public link (Standard invoices only)
  const shareToken = data.type !== "AIA"
    ? generateId().replace(/-/g, "")
    : null;
  const shareExpiry = shareToken
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    : null;

  await prisma.invoice.create({
    data: {
      jobId,
      createdById: session.user.id!,
      invoiceNumber,
      type: data.type === "AIA" ? "AIA" : "STANDARD",
      invoiceKind: data.invoiceKind || "PROGRESS_PAYMENT",
      date: new Date(data.date),
      periodTo: data.periodTo ? new Date(data.periodTo) : null,
      applicationNo: data.applicationNo ? parseInt(data.applicationNo) : null,
      status: "DRAFT",
      amount,
      retainagePct,
      retainageHeld,
      lineItems: data.lineItems.length > 0 ? (data.lineItems as object[]) : undefined,
      notes: data.notes.trim() || null,
      paymentTerms: data.paymentTerms || "due_on_receipt",
      scopeOfWork: data.scopeOfWork?.trim() || null,
      shareToken,
      shareExpiry,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
  return { success: true };
}

export async function updateInvoiceStatus(
  invoiceId: string,
  jobId: string,
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID"
) {
  await requirePermission(jobId, "UPDATE_INVOICE_STATUS");
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
  includesRetainageRelease?: boolean,
  receiptImageUrl?: string
) {
  const session = await requirePermission(jobId, "RECORD_PAYMENTS");
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
      receiptImageUrl: receiptImageUrl?.trim() || null,
      includesRetainageRelease: includesRetainageRelease ?? false,
      note: note.trim() || null,
    },
  });

  // Auto-update invoice status if linked
  let invoiceLabel: string | null = null;
  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: { select: { amount: true } } },
    });
    if (invoice) {
      invoiceLabel = `Invoice #${invoice.invoiceNumber}`;
      const totalPaid = invoice.payments.reduce((s, p) => s + p.amount.toNumber(), 0);
      const invoiceAmount = invoice.amount.toNumber();
      const newStatus = totalPaid >= invoiceAmount ? "PAID" : "PARTIALLY_PAID";
      await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus } });
    }
  }

  // Fire payment notification (non-blocking)
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobName: true } });
  if (job) {
    const recordedBy = session.user.name ?? session.user.email ?? "Unknown";
    notifyPaymentRecorded({
      jobName: job.jobName,
      jobId,
      amount: parseFloat(amount),
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      checkNumber: checkNumber?.trim() || null,
      reference: reference?.trim() || null,
      note: note.trim() || null,
      invoiceLabel,
      receiptImageUrl: receiptImageUrl?.trim() || null,
      recordedBy,
    }).catch((err) => console.error("[notify]", err));
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
