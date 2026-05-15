export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { StandardInvoiceDoc } from "../../_templates";
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
        gcCompany: true, gcContactName: true, gcEmail: true,
        address: true, city: true, state: true,
        contractStartDate: true,
        invoices: {
          where: { status: { not: "DRAFT" } },
          select: { id: true, amount: true, invoiceNumber: true },
          orderBy: { invoiceNumber: "asc" },
        },
      },
    }),
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceNumber: true, date: true, periodTo: true, amount: true,
        retainagePct: true, retainageHeld: true,
        lineItems: true, notes: true, type: true,
      },
    }),
  ]);

  if (!job || !invoice) return new NextResponse("Not found", { status: 404 });
  if (invoice.type !== "STANDARD") return new NextResponse("Use /aia route for AIA invoices", { status: 400 });

  // Previously sent invoices (before this one by number)
  const previouslyInvoiced = job.invoices
    .filter((inv) => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
    .reduce((s, inv) => s + inv.amount.toNumber(), 0);

  const lineItems = (invoice.lineItems as { label: string; amount: number }[] | null) ?? [];

  const buf = await renderToBuffer(
    React.createElement(StandardInvoiceDoc, {
      data: {
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        gcCompany: job.gcCompany,
        gcContactName: job.gcContactName,
        gcEmail: job.gcEmail,
        address: job.address,
        city: job.city,
        state: job.state,
        contractStartDate: job.contractStartDate,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.date,
        periodTo: invoice.periodTo,
        amount: invoice.amount.toNumber(),
        retainagePct: invoice.retainagePct,
        retainageHeld: invoice.retainageHeld?.toNumber() ?? null,
        lineItems,
        notes: invoice.notes,
        previouslyInvoiced,
      },
    }) as any
  );

  const filename = `${job.jobNumber}_Invoice_${String(invoice.invoiceNumber).padStart(3, "0")}.pdf`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
