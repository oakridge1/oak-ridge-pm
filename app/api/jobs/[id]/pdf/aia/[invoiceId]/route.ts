export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { AiaDoc } from "../../_templates";
import React from "react";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role === "FIELD") return new NextResponse("Forbidden", { status: 403 });

  const { id: jobId, invoiceId } = await params;

  const [job, invoice] = await Promise.all([
    prisma.job.findUnique({
      where: { id: jobId },
      select: {
        jobNumber: true, jobName: true,
        ownerName: true, gcCompany: true, gcContactName: true,
        address: true, city: true, state: true,
        contractStartDate: true, contractValue: true,
        changeOrders: {
          where: { status: "APPROVED" },
          select: { approvedValue: true },
        },
        invoices: {
          where: { type: "AIA", status: { not: "DRAFT" } },
          select: { id: true, amount: true, invoiceNumber: true, retainagePct: true, retainageHeld: true },
          orderBy: { invoiceNumber: "asc" },
        },
        laborEntries: { select: { hours: true } },
        materials: { select: { amount: true } },
        blendedLaborRate: true, laborMarkupPct: true,
        subcontractorCost: true, subMarkupPct: true,
        equipmentCost: true, equipmentBillPct: true, equipmentMarkupPct: true,
        otherCosts: true,
      },
    }),
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceNumber: true, applicationNo: true, date: true, periodTo: true,
        amount: true, retainagePct: true, retainageHeld: true,
        lineItems: true, notes: true, type: true,
      },
    }),
  ]);

  if (!job || !invoice) return new NextResponse("Not found", { status: 404 });
  if (invoice.type !== "AIA") return new NextResponse("Use /invoice route for Standard invoices", { status: 400 });

  const contractValue = job.contractValue?.toNumber() ?? 0;
  const approvedCOs = job.changeOrders.reduce((s, co) => s + (co.approvedValue?.toNumber() ?? 0), 0);
  const revisedContract = contractValue + approvedCOs;

  // Total Completed & Stored = gross billing from Summary tab logic
  const totalHours = job.laborEntries.reduce((s, e) => s + e.hours, 0);
  const laborCost = job.blendedLaborRate ? totalHours * job.blendedLaborRate.toNumber() : 0;
  const materialsCost = job.materials.reduce((s, m) => s + m.amount.toNumber(), 0);
  const subCost = job.subcontractorCost?.toNumber() ?? 0;
  const equipCost = job.equipmentCost?.toNumber() ?? 0;
  const otherCosts = (job.otherCosts as { amount: number }[] | null) ?? [];
  const otherTotal = otherCosts.reduce((s, c) => s + c.amount, 0);
  const totalDirectCosts = laborCost + materialsCost + subCost + equipCost + otherTotal;
  const laborMarkup = job.laborMarkupPct ? laborCost * (job.laborMarkupPct / 100) : 0;
  const subMarkup = job.subMarkupPct ? subCost * (job.subMarkupPct / 100) : 0;
  const equipBilled = equipCost * ((job.equipmentBillPct ?? 100) / 100);
  const equipMarkup = job.equipmentMarkupPct ? equipBilled * (job.equipmentMarkupPct / 100) : 0;
  const totalMarkup = laborMarkup + subMarkup + equipMarkup;
  const grossBilling = totalDirectCosts + totalMarkup;

  const retainagePct = invoice.retainagePct ?? 0;
  const retainageHeld = grossBilling * (retainagePct / 100);
  const totalEarnedLessRetainage = grossBilling - retainageHeld;

  // Previous AIA certificates (Line 7)
  const previousCertificates = job.invoices
    .filter((inv) => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
    .reduce((inv_sum, inv) => {
      const invAmount = inv.amount.toNumber();
      const invRetainage = inv.retainageHeld?.toNumber() ?? (inv.retainagePct ? invAmount * inv.retainagePct / 100 : 0);
      return inv_sum + (invAmount - invRetainage);
    }, 0);

  const currentPaymentDue = totalEarnedLessRetainage - previousCertificates;
  const balanceToFinish = revisedContract - totalEarnedLessRetainage;

  // Build G703 line items from stored lineItems or auto-compute
  const storedItems = (invoice.lineItems as {
    no: number; description: string; scheduledValue: number;
    previouslyBilled: number; thisPeriod: number; stored: number;
  }[] | null) ?? [];

  // If no stored G703 items, generate from current period computations
  const lineItems = storedItems.length > 0 ? storedItems : (() => {
    const items = [];
    let no = 1;
    if (laborCost + laborMarkup > 0) {
      items.push({ no: no++, description: "Labor" + (job.laborMarkupPct ? ` (incl. ${job.laborMarkupPct}% markup)` : ""), scheduledValue: laborCost + laborMarkup, previouslyBilled: 0, thisPeriod: laborCost + laborMarkup, stored: 0 });
    }
    if (materialsCost > 0) {
      items.push({ no: no++, description: "Materials", scheduledValue: materialsCost, previouslyBilled: 0, thisPeriod: materialsCost, stored: 0 });
    }
    if (subCost + subMarkup > 0) {
      items.push({ no: no++, description: "Subcontractors" + (job.subMarkupPct ? ` (incl. ${job.subMarkupPct}% markup)` : ""), scheduledValue: subCost + subMarkup, previouslyBilled: 0, thisPeriod: subCost + subMarkup, stored: 0 });
    }
    if (equipCost + equipMarkup > 0) {
      items.push({ no: no++, description: "Equipment Rental" + (job.equipmentMarkupPct ? ` (incl. ${job.equipmentMarkupPct}% markup)` : ""), scheduledValue: equipCost + equipMarkup, previouslyBilled: 0, thisPeriod: equipCost + equipMarkup, stored: 0 });
    }
    for (const oc of (job.otherCosts as { id: string; description: string; amount: number }[] | null) ?? []) {
      items.push({ no: no++, description: oc.description, scheduledValue: oc.amount, previouslyBilled: 0, thisPeriod: oc.amount, stored: 0 });
    }
    return items;
  })();

  const buf = await renderToBuffer(
    React.createElement(AiaDoc, {
      data: {
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        ownerName: job.ownerName,
        gcCompany: job.gcCompany,
        gcContactName: job.gcContactName,
        address: job.address,
        city: job.city,
        state: job.state,
        contractStartDate: job.contractStartDate,
        applicationNo: invoice.applicationNo ?? invoice.invoiceNumber,
        invoiceDate: invoice.date,
        periodTo: invoice.periodTo,
        originalContractSum: contractValue,
        netChangeByChangeOrders: approvedCOs,
        contractSumToDate: revisedContract,
        totalCompletedAndStored: grossBilling,
        retainagePct,
        previousCertificates,
        currentPaymentDue,
        balanceToFinish,
        lineItems,
        notes: invoice.notes,
      },
    }) as any
  );

  const appNo = invoice.applicationNo ?? invoice.invoiceNumber;
  const filename = `${job.jobNumber}_AIA_App-${appNo}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
