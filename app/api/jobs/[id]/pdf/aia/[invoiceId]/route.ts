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
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role === "TEAMMATE") return new NextResponse("Forbidden", { status: 403 });

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

    // Recompute gross billing from Summary tab logic
    const totalHours = job.laborEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
    const blendedRate = job.blendedLaborRate?.toNumber() ?? 0;
    const laborCost = blendedRate > 0 ? totalHours * blendedRate : 0;
    const materialsCost = job.materials.reduce((s, m) => s + (m.amount?.toNumber() ?? 0), 0);
    const subCost = job.subcontractorCost?.toNumber() ?? 0;
    const equipCost = job.equipmentCost?.toNumber() ?? 0;
    const equipBillPct = job.equipmentBillPct ?? 100;
    const equipBilled = equipCost * (equipBillPct / 100);
    const otherCosts = Array.isArray(job.otherCosts)
      ? (job.otherCosts as { amount: number }[])
      : [];
    const otherTotal = otherCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const totalDirectCosts = laborCost + materialsCost + subCost + equipCost + otherTotal;

    const laborMarkupPct = job.laborMarkupPct ?? 0;
    const subMarkupPct = job.subMarkupPct ?? 0;
    const equipMarkupPct = job.equipmentMarkupPct ?? 0;
    const laborMarkup = laborCost * (laborMarkupPct / 100);
    const subMarkup = subCost * (subMarkupPct / 100);
    const equipMarkup = equipBilled * (equipMarkupPct / 100);
    const totalMarkup = laborMarkup + subMarkup + equipMarkup;
    const grossBilling = totalDirectCosts + totalMarkup;

    const retainagePct = invoice.retainagePct ?? 0;
    const retainageHeld = grossBilling * (retainagePct / 100);
    const totalEarnedLessRetainage = grossBilling - retainageHeld;

    // Previous AIA certificates (Line 7) — sum of prior non-draft AIA invoices' net amounts
    const previousCertificates = job.invoices
      .filter((inv) => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
      .reduce((sum, inv) => {
        const invAmount = inv.amount?.toNumber() ?? 0;
        const invRetainageHeld = inv.retainageHeld?.toNumber()
          ?? (inv.retainagePct != null ? invAmount * inv.retainagePct / 100 : 0);
        return sum + (invAmount - invRetainageHeld);
      }, 0);

    const currentPaymentDue = totalEarnedLessRetainage - previousCertificates;
    const balanceToFinish = revisedContract - totalEarnedLessRetainage;

    // Always auto-generate G703 line items from computed values.
    // (Stored lineItems are in Standard invoice format {label,amount} — not G703 format.)
    const lineItems: {
      no: number; description: string; scheduledValue: number;
      previouslyBilled: number; thisPeriod: number; stored: number;
    }[] = [];
    let no = 1;

    if (laborCost + laborMarkup > 0) {
      const suffix = laborMarkupPct > 0 ? ` (incl. ${laborMarkupPct}% markup)` : "";
      lineItems.push({
        no: no++, description: `Labor${suffix}`,
        scheduledValue: laborCost + laborMarkup, previouslyBilled: 0,
        thisPeriod: laborCost + laborMarkup, stored: 0,
      });
    }
    if (materialsCost > 0) {
      lineItems.push({
        no: no++, description: "Materials",
        scheduledValue: materialsCost, previouslyBilled: 0,
        thisPeriod: materialsCost, stored: 0,
      });
    }
    if (subCost + subMarkup > 0) {
      const suffix = subMarkupPct > 0 ? ` (incl. ${subMarkupPct}% markup)` : "";
      lineItems.push({
        no: no++, description: `Subcontractors${suffix}`,
        scheduledValue: subCost + subMarkup, previouslyBilled: 0,
        thisPeriod: subCost + subMarkup, stored: 0,
      });
    }
    if (equipCost + equipMarkup > 0) {
      const suffix = equipMarkupPct > 0 ? ` (incl. ${equipMarkupPct}% markup)` : "";
      lineItems.push({
        no: no++, description: `Equipment Rental${suffix}`,
        scheduledValue: equipCost + equipMarkup, previouslyBilled: 0,
        thisPeriod: equipCost + equipMarkup, stored: 0,
      });
    }
    for (const oc of Array.isArray(job.otherCosts)
      ? (job.otherCosts as { description: string; amount: number }[])
      : []) {
      if (oc.amount > 0) {
        lineItems.push({
          no: no++, description: oc.description ?? "Other",
          scheduledValue: Number(oc.amount), previouslyBilled: 0,
          thisPeriod: Number(oc.amount), stored: 0,
        });
      }
    }

    const buf = await renderToBuffer(
      React.createElement(AiaDoc, {
        data: {
          jobNumber: job.jobNumber ?? "",
          jobName: job.jobName ?? "",
          ownerName: job.ownerName ?? null,
          gcCompany: job.gcCompany ?? null,
          gcContactName: job.gcContactName ?? null,
          address: job.address ?? null,
          city: job.city ?? null,
          state: job.state ?? null,
          contractStartDate: job.contractStartDate ?? null,
          applicationNo: invoice.applicationNo ?? invoice.invoiceNumber,
          invoiceDate: invoice.date,
          periodTo: invoice.periodTo ?? null,
          originalContractSum: contractValue,
          netChangeByChangeOrders: approvedCOs,
          contractSumToDate: revisedContract,
          totalCompletedAndStored: grossBilling,
          retainagePct,
          previousCertificates,
          currentPaymentDue,
          balanceToFinish,
          lineItems,
          notes: invoice.notes ?? null,
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
  } catch (err) {
    console.error("[AIA PDF] Error generating PDF:", err);
    return new NextResponse(
      `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
