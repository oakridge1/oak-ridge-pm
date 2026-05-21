export const runtime = "nodejs";

// This route is intentionally public — no auth required.
// Access is gated by the 32-char shareToken embedded in the URL.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { StandardInvoiceDoc } from "@/app/api/jobs/[id]/pdf/_templates";
import React from "react";
import fs from "fs";
import path from "path";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch { /* ignore */ }
  return undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareToken: string }> }
) {
  try {
    const { shareToken } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { shareToken },
      include: {
        job: {
          select: {
            jobNumber: true, jobName: true,
            gcCompany: true, gcContactName: true, gcEmail: true,
            address: true, city: true, state: true,
            contractStartDate: true, contractValue: true, scopeOfWork: true,
            changeOrders: {
              where: { status: "APPROVED" },
              select: { coNumber: true, description: true, approvedValue: true },
              orderBy: { coNumber: "asc" },
            },
            invoices: {
              where: { status: { not: "DRAFT" } },
              select: { id: true, amount: true, invoiceNumber: true },
              orderBy: { invoiceNumber: "asc" },
            },
          },
        },
      },
    });

    if (!invoice) return new NextResponse("Not found", { status: 404 });
    if (invoice.type !== "STANDARD") return new NextResponse("AIA invoices not available via public link", { status: 400 });
    if (invoice.shareExpiry && new Date() > invoice.shareExpiry) {
      return new NextResponse("Link expired", { status: 410 });
    }

    const job = invoice.job;
    const companySettings = await prisma.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    const previouslyInvoiced = job.invoices
      .filter((inv) => inv.id !== invoice.id && inv.invoiceNumber < invoice.invoiceNumber)
      .reduce((s, inv) => s + (inv.amount?.toNumber?.() ?? Number(inv.amount) ?? 0), 0);

    const lineItems = (invoice.lineItems as { label: string; amount: number }[] | null) ?? [];
    const logoSrc = getLogoSrc() ?? companySettings.logoUrl ?? undefined;

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
          contractValue: job.contractValue?.toNumber() ?? null,
          approvedCOs: job.changeOrders.map((co) => ({
            coNumber: co.coNumber,
            description: co.description,
            approvedValue: co.approvedValue?.toNumber() ?? 0,
          })),
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.date,
          periodTo: invoice.periodTo,
          amount: invoice.amount.toNumber(),
          retainagePct: invoice.retainagePct,
          retainageHeld: invoice.retainageHeld?.toNumber() ?? null,
          lineItems,
          notes: invoice.notes,
          previouslyInvoiced,
          invoiceKind: invoice.invoiceKind,
          paymentTerms: invoice.paymentTerms,
          scopeOfWork: invoice.scopeOfWork ?? job.scopeOfWork,
          logoSrc,
          companyName: companySettings.name,
          companyAddress: companySettings.address,
          companyCity: companySettings.city,
          companyState: companySettings.state,
          companyZip: companySettings.zip,
          companyPhone: companySettings.phone,
          companyEmail: companySettings.email,
          companyLogoUrl: companySettings.logoUrl,
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
  } catch (err) {
    console.error("[Public Invoice PDF]", err);
    return new NextResponse(
      `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
