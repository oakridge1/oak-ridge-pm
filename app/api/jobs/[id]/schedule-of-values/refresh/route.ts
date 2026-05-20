export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role === "TEAMMATE") return new NextResponse("Forbidden", { status: 403 });

    const { id: jobId } = await params;
    const body = await req.json().catch(() => ({}));
    const { periodTo } = body as { periodTo?: string };

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        blendedLaborRate: true,
        laborEntries: { select: { date: true, hours: true } },
        materials: { select: { date: true, amount: true } },
        invoices: {
          where: { type: "AIA", status: { not: "DRAFT" } },
          select: { periodTo: true, date: true },
          orderBy: { invoiceNumber: "desc" },
        },
      },
    });

    if (!job) return new NextResponse("Not found", { status: 404 });

    const lastInv = job.invoices[0];
    const lastInvoiceDate: Date | null = lastInv
      ? (lastInv.periodTo ?? lastInv.date)
      : null;

    const blendedRate = job.blendedLaborRate != null ? Number(job.blendedLaborRate) : null;

    // Cutoff is lastInvoiceDate (or all time if no prior invoice)
    const cutoff = lastInvoiceDate;

    const hoursThisPeriod = job.laborEntries
      .filter(e => !cutoff || e.date > cutoff)
      .reduce((s, e) => s + e.hours, 0);

    const laborAutoFill = blendedRate != null ? hoursThisPeriod * blendedRate : 0;

    const materialAutoFill = job.materials
      .filter(m => !cutoff || m.date > cutoff)
      .reduce((s, m) => s + Number(m.amount), 0);

    return NextResponse.json({
      laborAutoFill,
      materialAutoFill,
      lastInvoiceDate: lastInvoiceDate?.toISOString() ?? null,
      periodTo: periodTo ?? null,
    });
  } catch (err) {
    console.error("[SOV Refresh]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
