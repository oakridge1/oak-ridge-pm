export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FullReportDoc, SummaryDoc } from "./_templates";

type OtherCost = { id: string; description: string; amount: number };

function pdfSlug(jobNumber: string, jobName: string) {
  return `${jobNumber}_${jobName.replace(/[^a-z0-9]/gi, "_")}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.active)
    return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role === "FIELD")
    return new NextResponse("Forbidden", { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "full";

  // ── Full Report ────────────────────────────────────────────────────────────
  if (type === "full") {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        foreman: { select: { name: true } },
        laborEntries: {
          orderBy: { date: "desc" },
          include: { user: { select: { name: true } } },
        },
        materials: { orderBy: { date: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        },
        tasks: {
          orderBy: { createdAt: "asc" },
          include: { assignee: { select: { name: true } } },
        },
        payments: { orderBy: { date: "asc" } },
      },
    });
    if (!job) return new NextResponse("Not found", { status: 404 });

    const data = {
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      status: job.status,
      address: job.address,
      city: job.city,
      state: job.state,
      zip: job.zip,
      gcCompany: job.gcCompany,
      gcContactName: job.gcContactName,
      permitNumber: job.permitNumber,
      contractStartDate: job.contractStartDate,
      completionDate: job.completionDate,
      scopeOfWork: job.scopeOfWork,
      foreman: job.foreman,
      laborEntries: job.laborEntries.map((e) => ({
        date: e.date,
        hours: e.hours,
        user: e.user,
      })),
      materials: job.materials.map((m) => ({
        date: m.date,
        vendor: m.vendor,
        description: m.description,
        amount: m.amount.toNumber(),
      })),
      notes: job.notes.map((n) => ({
        content: n.content,
        createdAt: n.createdAt,
        user: n.user,
      })),
      tasks: job.tasks.map((t) => ({
        title: t.title,
        status: t.status,
        assignee: t.assignee,
        dueDate: t.dueDate,
      })),
      payments: job.payments.map((p) => ({
        date: p.date,
        note: p.note,
        amount: p.amount.toNumber(),
      })),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(createElement(FullReportDoc, { data }) as any);
    const fileName = `${pdfSlug(job.jobNumber, job.jobName)}_FullReport.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  if (type === "summary") {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        foreman: { select: { name: true } },
        laborEntries: { select: { hours: true } },
        materials: { select: { amount: true } },
        changeOrders: {
          where: { status: "APPROVED" },
          select: { description: true, approvedValue: true },
        },
        payments: { orderBy: { date: "asc" } },
      },
    });
    if (!job) return new NextResponse("Not found", { status: 404 });

    const totalHours = job.laborEntries.reduce((s, e) => s + e.hours, 0);
    const laborCost =
      job.blendedLaborRate != null
        ? totalHours * job.blendedLaborRate.toNumber()
        : null;
    const materialsCost = job.materials.reduce(
      (s, m) => s + m.amount.toNumber(),
      0
    );
    const subCost = job.subcontractorCost?.toNumber() ?? 0;
    const equipCost = job.equipmentCost?.toNumber() ?? 0;
    const equipBillPct = job.equipmentBillPct ?? 100;
    const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];
    const otherTotal = otherCosts.reduce((s, c) => s + c.amount, 0);

    const laborMarkup =
      laborCost != null && job.laborMarkupPct != null
        ? laborCost * (job.laborMarkupPct / 100)
        : 0;
    const subMarkup = subCost * ((job.subMarkupPct ?? 0) / 100);
    const equipMarkup =
      equipCost * (equipBillPct / 100) * ((job.equipmentMarkupPct ?? 0) / 100);
    const totalDirectCosts =
      (laborCost ?? 0) + materialsCost + subCost + equipCost + otherTotal;
    const grossBilling = totalDirectCosts + laborMarkup + subMarkup + equipMarkup;

    const contractValue = job.contractValue?.toNumber() ?? 0;
    const approvedCOs = job.changeOrders.map((co) => ({
      description: co.description,
      approvedValue: co.approvedValue?.toNumber() ?? 0,
    }));
    const revisedContract =
      contractValue + approvedCOs.reduce((s, co) => s + co.approvedValue, 0);
    const totalBilled = job.payments.reduce(
      (s, p) => s + p.amount.toNumber(),
      0
    );
    const balanceRemaining = revisedContract - totalBilled;

    const data = {
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      gcCompany: job.gcCompany,
      gcContactName: job.gcContactName,
      foreman: job.foreman,
      contractStartDate: job.contractStartDate,
      completionDate: job.completionDate,
      permitNumber: job.permitNumber,
      totalHours,
      laborCost,
      blendedLaborRate: job.blendedLaborRate?.toNumber() ?? null,
      materialsCost,
      subCost,
      subMarkupPct: job.subMarkupPct,
      equipCost,
      equipBillPct,
      equipmentMarkupPct: job.equipmentMarkupPct,
      otherCosts,
      laborMarkupPct: job.laborMarkupPct,
      laborMarkup,
      subMarkup,
      equipMarkup,
      grossBilling,
      contractValue,
      approvedCOs,
      revisedContract,
      payments: job.payments.map((p) => ({
        date: p.date,
        note: p.note,
        amount: p.amount.toNumber(),
      })),
      totalBilled,
      balanceRemaining,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(createElement(SummaryDoc, { data }) as any);
    const fileName = `${pdfSlug(job.jobNumber, job.jobName)}_Summary.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  }

  return new NextResponse("Invalid type parameter. Use ?type=full or ?type=summary", {
    status: 400,
  });
}
