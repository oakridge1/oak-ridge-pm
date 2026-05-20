export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type SovRow = {
  id: string;
  itemNo: string;
  description: string;
  scheduledValue: number;
  type: "labor" | "material" | "co" | "custom";
  previouslyBilled: number;
  thisPeriod: number;
  materialsStored: number;
  autoFilled?: boolean;
  manuallyEdited?: boolean;
  coId?: string;
};

function buildDefaultRows(
  laborBudget: number,
  materialBudget: number,
  approvedCOs: { id: string; coNumber: number | null; description: string; approvedValue: number }[]
): SovRow[] {
  const rows: SovRow[] = [
    {
      id: crypto.randomUUID(),
      itemNo: "16-100",
      description: "Labor",
      scheduledValue: laborBudget,
      type: "labor",
      previouslyBilled: 0,
      thisPeriod: 0,
      materialsStored: 0,
      autoFilled: true,
    },
    {
      id: crypto.randomUUID(),
      itemNo: "16-200",
      description: "Material",
      scheduledValue: materialBudget,
      type: "material",
      previouslyBilled: 0,
      thisPeriod: 0,
      materialsStored: 0,
      autoFilled: true,
    },
  ];

  for (const co of approvedCOs) {
    rows.push({
      id: crypto.randomUUID(),
      itemNo: `400-${String(co.coNumber ?? approvedCOs.indexOf(co) + 1).padStart(3, "0")}`,
      description: `CO #${co.coNumber ?? ""} — ${co.description || "Change Order"}`,
      scheduledValue: co.approvedValue,
      type: "co",
      previouslyBilled: 0,
      thisPeriod: 0,
      materialsStored: 0,
      coId: co.id,
    });
  }

  return rows;
}

function computeAutoFill(
  laborEntries: { date: Date; hours: number }[],
  materials: { date: Date; amount: number }[],
  blendedLaborRate: number | null,
  lastInvoiceDate: Date | null
): { laborAutoFill: number; materialAutoFill: number } {
  const cutoff = lastInvoiceDate;

  const hoursThisPeriod = laborEntries
    .filter(e => !cutoff || e.date > cutoff)
    .reduce((s, e) => s + e.hours, 0);

  const laborAutoFill = blendedLaborRate != null ? hoursThisPeriod * blendedLaborRate : 0;

  const materialAutoFill = materials
    .filter(m => !cutoff || m.date > cutoff)
    .reduce((s, m) => s + m.amount, 0);

  return { laborAutoFill, materialAutoFill };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role === "TEAMMATE") return new NextResponse("Forbidden", { status: 403 });

    const { id: jobId } = await params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: {
        laborBudgetHours: true,
        materialBudget: true,
        blendedLaborRate: true,
        changeOrders: {
          where: { status: "APPROVED" },
          select: { id: true, coNumber: true, description: true, approvedValue: true },
          orderBy: { coNumber: "asc" },
        },
        laborEntries: { select: { date: true, hours: true }, orderBy: { date: "asc" } },
        materials: { select: { date: true, amount: true }, orderBy: { date: "asc" } },
        invoices: {
          where: { type: "AIA", status: { not: "DRAFT" } },
          select: { periodTo: true, date: true },
          orderBy: { invoiceNumber: "desc" },
        },
        scheduleOfValues: { select: { rows: true, updatedAt: true, updatedBy: true } },
      },
    });

    if (!job) return new NextResponse("Not found", { status: 404 });

    // Determine last invoice cutoff date
    const lastInv = job.invoices[0];
    const lastInvoiceDate: Date | null = lastInv
      ? (lastInv.periodTo ?? lastInv.date)
      : null;

    const blendedRate = job.blendedLaborRate != null ? Number(job.blendedLaborRate) : null;
    const laborBudget =
      (job.laborBudgetHours != null && blendedRate != null)
        ? job.laborBudgetHours * blendedRate
        : 0;
    const materialBudget = job.materialBudget != null ? Number(job.materialBudget) : 0;

    const approvedCOs = job.changeOrders.map(co => ({
      id: co.id,
      coNumber: co.coNumber,
      description: co.description,
      approvedValue: Number(co.approvedValue ?? 0),
    }));

    const laborEntries = job.laborEntries.map(e => ({ date: e.date, hours: e.hours }));
    const materials = job.materials.map(m => ({
      date: m.date,
      amount: Number(m.amount),
    }));

    const { laborAutoFill, materialAutoFill } = computeAutoFill(
      laborEntries,
      materials,
      blendedRate,
      lastInvoiceDate
    );

    // Load or init rows
    let rows: SovRow[];
    if (job.scheduleOfValues && Array.isArray(job.scheduleOfValues.rows) && job.scheduleOfValues.rows.length > 0) {
      rows = job.scheduleOfValues.rows as SovRow[];
      // Merge in any new CO rows that aren't yet in the SOV
      const existingCoIds = new Set(rows.filter(r => r.coId).map(r => r.coId));
      for (const co of approvedCOs) {
        if (!existingCoIds.has(co.id)) {
          rows.push({
            id: crypto.randomUUID(),
            itemNo: `400-${String(co.coNumber ?? 1).padStart(3, "0")}`,
            description: `CO #${co.coNumber ?? ""} — ${co.description || "Change Order"}`,
            scheduledValue: co.approvedValue,
            type: "co",
            previouslyBilled: 0,
            thisPeriod: 0,
            materialsStored: 0,
            coId: co.id,
          });
        }
      }
    } else {
      rows = buildDefaultRows(laborBudget, materialBudget, approvedCOs);
    }

    // Apply auto-fill to non-manually-edited labor/material rows
    rows = rows.map(row => {
      if (row.type === "labor" && row.autoFilled && !row.manuallyEdited) {
        return { ...row, thisPeriod: laborAutoFill };
      }
      if (row.type === "material" && row.autoFilled && !row.manuallyEdited) {
        return { ...row, thisPeriod: materialAutoFill };
      }
      return row;
    });

    return NextResponse.json({
      rows,
      lastInvoiceDate: lastInvoiceDate?.toISOString() ?? null,
      laborAutoFill,
      materialAutoFill,
      updatedAt: job.scheduleOfValues?.updatedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[SOV GET]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

    const { id: jobId } = await params;
    const body = await req.json();
    const { rows } = body as { rows: SovRow[] };

    await prisma.scheduleOfValues.upsert({
      where: { jobId },
      create: { jobId, rows: rows as object[], updatedBy: session.user.id ?? null },
      update: { rows: rows as object[], updatedBy: session.user.id ?? null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SOV PUT]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
