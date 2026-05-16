export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { StandardInvoiceDoc } from "../../_templates";
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
  } catch {
    // ignore
  }
  return undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role === "TEAMMATE") return new NextResponse("Forbidden", { status: 403 });

  const { id: jobId, invoiceId } = await params;

  const [job, invoice, companySettings] = await Promise.all([
    prisma.job.findUnique({
      where: { id: jobId },
      select: {
        jobNumber: true, jobName: true,
        gcCompany: true, gcContactName: true, gcEmail: true,
        address: true, city: true, state: true,
        contractValue: true,
        contractStartDate: true,
        scopeOfWork: true,
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
    }),
    prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        invoiceNumber: true, date: true, periodTo: true, amount: true,
        retainagePct: true, retainageHeld: true,
        lineItems: true, notes: true, type: true, invoiceKind: true,
      },
    }),
    prisma.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  if (!job || !invoice) return new NextResponse("Not found", { status: 404 });
  if (invoice.type !== "STANDARD") return new NextResponse("Use /aia route for AIA invoices", { status: 400 });

  // Previously sent invoices (before this one by number)
  const previouslyInvoiced = job.invoices
    .filter((inv) => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
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
        scopeOfWork: job.scopeOfWork,
        approvedCOs: job.changeOrders.map(co => ({
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
    console.error("[Invoice PDF] Error generating PDF:", err);
    return new NextResponse(
      `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
