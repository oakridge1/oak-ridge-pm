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

// ── Row builders ──────────────────────────────────────────────────────────────

function buildRowsFromCostCodes(
  costCodes: { id: string; code: string; description: string; type: string; coId: string | null; sortOrder: number }[],
  laborBudget: number,
  materialBudget: number,
  approvedCOs: { id: string; coNumber: number | null; description: string; approvedValue: number }[]
): SovRow[] {
  const rows: SovRow[] = [];
  for (const cc of costCodes) {
    if (cc.type === "labor") {
      rows.push({
        id: crypto.randomUUID(),
        itemNo: cc.code,
        description: cc.description,
        scheduledValue: laborBudget,
        type: "labor",
        previouslyBilled: 0,
        thisPeriod: 0,
        materialsStored: 0,
        autoFilled: true,
      });
    } else if (cc.type === "material") {
      rows.push({
        id: crypto.randomUUID(),
        itemNo: cc.code,
        description: cc.description,
        scheduledValue: materialBudget,
        type: "material",
        previouslyBilled: 0,
        thisPeriod: 0,
        materialsStored: 0,
        autoFilled: true,
      });
    } else if (cc.type === "co" && cc.coId) {
      const co = approvedCOs.find(c => c.id === cc.coId);
      rows.push({
        id: crypto.randomUUID(),
        itemNo: cc.code,
        description: co ? coDescription(co) : cc.description,
        scheduledValue: co?.approvedValue ?? 0,
        type: "co",
        previouslyBilled: 0,
        thisPeriod: 0,
        materialsStored: 0,
        coId: cc.coId,
      });
    } else {
      // subcontractor, equipment, other custom types
      rows.push({
        id: crypto.randomUUID(),
        itemNo: cc.code,
        description: cc.description,
        scheduledValue: 0,
        type: "custom",
        previouslyBilled: 0,
        thisPeriod: 0,
        materialsStored: 0,
      });
    }
  }
  return rows;
}

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
      description: coDescription(co),
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

/** Canonical CO description — "CO 1 — Additional MEP" */
function coDescription(co: { coNumber: number | null; description: string }): string {
  const num = co.coNumber != null ? `CO ${co.coNumber}` : "CO";
  const desc = co.description?.trim() || "Change Order";
  return `${num} — ${desc}`;
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

/**
 * Compute "From Previous" totals from ALL prior AIA invoices (including DRAFT).
 * Returns { laborPrev, materialPrev, coPrev: Map<coId, amount> }
 */
function computeFromPrevious(priorInvoices: { lineItems: unknown }[]): {
  laborPrev: number;
  materialPrev: number;
  coPrev: Record<string, number>;
} {
  let laborPrev = 0;
  let materialPrev = 0;
  const coPrev: Record<string, number> = {};

  for (const inv of priorInvoices) {
    const items = Array.isArray(inv.lineItems)
      ? (inv.lineItems as Record<string, unknown>[])
      : [];
    if (items.length === 0) continue;

    if (items[0]?.fromSov === true) {
      // SOV-format invoice — use exact G703 rows
      for (const item of items) {
        const iType = String(item.type ?? "");
        const iCoId = item.coId ? String(item.coId) : null;
        // Amount billed in that period = thisPeriod + materialsStored
        const periodAmt = Number(item.thisPeriod ?? 0) + Number(item.materialsStored ?? 0);

        if (iType === "labor") laborPrev += periodAmt;
        if (iType === "material") materialPrev += periodAmt;
        if (iType === "co" && iCoId) {
          coPrev[iCoId] = (coPrev[iCoId] ?? 0) + periodAmt;
        }
        // custom rows: skip — user maintains manually
      }
    } else {
      // Legacy standard-format invoice: { label, amount }
      for (const item of items) {
        const label = String(item.label ?? "").toLowerCase();
        const amt = Number(item.amount ?? 0);
        if (label.includes("labor")) laborPrev += amt;
        else if (label.includes("material")) materialPrev += amt;
      }
    }
  }

  return { laborPrev, materialPrev, coPrev };
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
        laborBudgetDollars: true,
        materialBudget: true,
        blendedLaborRate: true,
        changeOrders: {
          where: { status: "APPROVED" },
          select: { id: true, coNumber: true, description: true, approvedValue: true },
          orderBy: { coNumber: "asc" },
        },
        costCodes: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, code: true, description: true, type: true, coId: true, sortOrder: true },
        },
        laborEntries: { select: { date: true, hours: true }, orderBy: { date: "asc" } },
        materials: { select: { date: true, amount: true }, orderBy: { date: "asc" } },
        // ALL AIA invoices (including DRAFT) so From Previous is always current
        invoices: {
          where: { type: "AIA" },
          select: { id: true, invoiceNumber: true, periodTo: true, date: true, lineItems: true },
          orderBy: { invoiceNumber: "asc" },
        },
        scheduleOfValues: { select: { rows: true, updatedAt: true, updatedBy: true } },
      },
    });

    if (!job) return new NextResponse("Not found", { status: 404 });

    // Most-recent AIA (including DRAFT) = cutoff for "this period" auto-fill
    const lastInv = job.invoices.length > 0 ? job.invoices[job.invoices.length - 1] : null;
    const lastInvoiceDate: Date | null = lastInv
      ? (lastInv.periodTo ?? lastInv.date)
      : null;

    const blendedRate = job.blendedLaborRate != null ? Number(job.blendedLaborRate) : null;

    const laborEntries = job.laborEntries.map(e => ({ date: e.date, hours: e.hours }));
    const materials = job.materials.map(m => ({ date: m.date, amount: Number(m.amount) }));
    const approvedCOs = job.changeOrders.map(co => ({
      id: co.id,
      coNumber: co.coNumber,
      description: co.description,
      approvedValue: Number(co.approvedValue ?? 0),
    }));

    // ── Auto-fill: hours/materials since last invoice ──────────────────────────
    const { laborAutoFill, materialAutoFill } = computeAutoFill(
      laborEntries,
      materials,
      blendedRate,
      lastInvoiceDate
    );

    // ── Scheduled value defaults ───────────────────────────────────────────────
    // Use budgets when set; fall back to actual all-time cost
    const totalLaborHours = laborEntries.reduce((s, e) => s + e.hours, 0);
    const totalLaborCost = blendedRate != null ? totalLaborHours * blendedRate : 0;
    const totalMaterialCost = materials.reduce((s, m) => s + m.amount, 0);

    const laborBudget =
      job.laborBudgetDollars != null
        ? Number(job.laborBudgetDollars)
        : totalLaborCost;

    const materialBudget =
      job.materialBudget != null
        ? Number(job.materialBudget)
        : totalMaterialCost;

    // ── From Previous: scan ALL prior AIA invoices ────────────────────────────
    const { laborPrev, materialPrev, coPrev } = computeFromPrevious(job.invoices);

    // ── Load or initialize SOV rows ───────────────────────────────────────────
    let rows: SovRow[];
    if (
      job.scheduleOfValues &&
      Array.isArray(job.scheduleOfValues.rows) &&
      job.scheduleOfValues.rows.length > 0
    ) {
      rows = job.scheduleOfValues.rows as SovRow[];

      // Merge in any new CO rows not yet in the saved SOV
      const existingCoIds = new Set(rows.filter(r => r.coId).map(r => r.coId));
      for (const co of approvedCOs) {
        if (!existingCoIds.has(co.id)) {
          rows.push({
            id: crypto.randomUUID(),
            itemNo: `400-${String(co.coNumber ?? 1).padStart(3, "0")}`,
            description: coDescription(co),
            scheduledValue: co.approvedValue,
            type: "co",
            previouslyBilled: 0,
            thisPeriod: 0,
            materialsStored: 0,
            coId: co.id,
          });
        }
      }

      // Always refresh CO descriptions + scheduled values from live CO data
      rows = rows.map(row => {
        if (row.type === "co" && row.coId) {
          const co = approvedCOs.find(c => c.id === row.coId);
          if (co) {
            return {
              ...row,
              description: coDescription(co),
              scheduledValue: row.scheduledValue || co.approvedValue,
            };
          }
        }
        return row;
      });
    } else if (job.costCodes.length > 0) {
      // Build from cost codes (new jobs created after this update)
      rows = buildRowsFromCostCodes(job.costCodes, laborBudget, materialBudget, approvedCOs);
    } else {
      // Legacy: build from defaults
      rows = buildDefaultRows(laborBudget, materialBudget, approvedCOs);
    }

    // ── Apply auto-fill for "This Period" ────────────────────────────────────
    rows = rows.map(row => {
      if (row.type === "labor" && row.autoFilled && !row.manuallyEdited) {
        return { ...row, thisPeriod: laborAutoFill };
      }
      if (row.type === "material" && row.autoFilled && !row.manuallyEdited) {
        return { ...row, thisPeriod: materialAutoFill };
      }
      return row;
    });

    // ── Apply "From Previous" from ALL prior AIA invoices ────────────────────
    rows = rows.map(row => {
      if (row.type === "labor") return { ...row, previouslyBilled: laborPrev };
      if (row.type === "material") return { ...row, previouslyBilled: materialPrev };
      if (row.type === "co" && row.coId) return { ...row, previouslyBilled: coPrev[row.coId] ?? 0 };
      // custom rows: use saved previouslyBilled (user manages)
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
