import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sov, invoices, payments, changeOrders, laborEntries, materials] = await Promise.all([
    prisma.scheduleOfValues.findUnique({ where: { jobId: id } }),
    prisma.invoice.findMany({
      where: { jobId: id },
      orderBy: { invoiceNumber: "desc" },
    }),
    prisma.payment.findMany({
      where: { jobId: id },
      orderBy: { date: "desc" },
    }),
    prisma.changeOrder.findMany({
      where: { jobId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, description: true, status: true,
        approvedValue: true, estimatedLaborCost: true, estimatedMaterials: true,
        coNumber: true, date: true,
      },
    }),
    prisma.laborEntry.findMany({
      where: { jobId: id },
      select: { hours: true, userId: true },
    }),
    prisma.material.findMany({
      where: { jobId: id, archivedToVault: false },
      select: { amount: true, markupPct: true },
    }),
  ]);

  return NextResponse.json({ sov, invoices, payments, changeOrders, laborEntries, materials });
}

// Save / upsert Schedule of Values rows
export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { rows } = await req.json();
  const sov = await prisma.scheduleOfValues.upsert({
    where: { jobId: id },
    update: { rows, updatedAt: new Date(), updatedBy: session.user.id },
    create: { id: crypto.randomUUID(), jobId: id, rows, updatedAt: new Date(), updatedBy: session.user.id },
  });
  return NextResponse.json(sov);
}

// Create invoice
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { action } = body;

  if (action === "create_invoice") {
    const last = await prisma.invoice.findFirst({ where: { jobId: id }, orderBy: { invoiceNumber: "desc" } });
    const invoiceNumber = (last?.invoiceNumber ?? 0) + 1;
    const invoice = await prisma.invoice.create({
      data: {
        id: crypto.randomUUID(),
        jobId: id,
        createdById: session.user.id,
        invoiceNumber,
        type: body.type ?? "STANDARD",
        date: new Date(body.date),
        periodTo: body.periodTo ? new Date(body.periodTo) : null,
        applicationNo: body.applicationNo ?? null,
        status: "DRAFT",
        amount: body.amount,
        retainagePct: body.retainagePct ?? null,
        notes: body.notes ?? null,
        paymentTerms: body.paymentTerms ?? "due_on_receipt",
        scopeOfWork: body.scopeOfWork ?? null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(invoice);
  }

  if (action === "record_payment") {
    const payment = await prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        jobId: id,
        date: new Date(body.date),
        amount: body.amount,
        note: body.note ?? null,
        checkNumber: body.checkNumber ?? null,
        includesRetainageRelease: body.includesRetainageRelease ?? false,
        invoiceId: body.invoiceId ?? null,
        reference: body.reference ?? null,
      },
    });
    return NextResponse.json(payment);
  }

  if (action === "update_invoice_status") {
    const updated = await prisma.invoice.update({
      where: { id: body.invoiceId },
      data: { status: body.status, updatedAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
