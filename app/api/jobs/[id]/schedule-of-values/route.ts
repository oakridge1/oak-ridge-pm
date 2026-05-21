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
 * Compute "From Previous" totals from prior AIA invoices.
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
        // "Total completed and stored" for that row = previouslyBilled + thisPeriod + materialsStored
        // But from the prior application's perspective, what they billed in that period is:
        const thisPeriod = Number(item.thisPeriod ?? 0);
        const stored = Number(item.materialsStored ?? 0);
        const periodAmt = thisPeriod + stored;

        if (iType === "labor") laborPrev += periodAmt;
        if (iType === "material") materialPrev += periodAmt;
        if (iType === "co" && iCoId) {
          coPrev[iCoId] = (coPrev[iCoId] ?? 0) + periodAmt;
        }
        // custom rows: skip — user maintains manually
      }
    } else {
      // Legacy standard-format invoice: { label, amount }
      // Distribute across labor/material by label matching
      for (const item of items) {
        const label = String(item.label ?? "").toLowerCase();
        const amt = Number(item.amount ?? 0);
        if (label.includes("labor")) laborPrev += amt;
        else if (label.includes("material")) materialPrev += amt;
        // Can't attribute to specific COs in legacy format
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
        // All non-draft AIA invoices, oldest first — used for "From Previous" and cutoff
        invoices: {
          where: { type: "AIA", status: { not: "DRAFT" } },
          select: { id: true, invoiceNumber: true, periodTo: true, date: true, lineItems: true },
          orderBy: { invoiceNumber: "asc" },
        },
        scheduleOfValues: { select: { rows: true, updatedAt: true, updatedBy: true } },
      },
    });

    if (!job) return new NextResponse("Not found", { status: 404 });

    // Most-recent invoice = cutoff for "this period" auto-fill
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

    // ── Scheduled value defaults (FIX 3) ──────────────────────────────────────
    // Use budgets when set; fall back to actual all-time cost so the table is meaningful
    const totalLaborHours = laborEntries.reduce((s, e) => s + e.hours, 0);
    const totalLaborCost = blendedRate != null ? totalLaborHours * blendedRate : 0;
    const totalMaterialCost = materials.reduce((s, m) => s + m.amount, 0);

    const laborBudget =
      job.laborBudgetHours != null && blendedRate != null
        ? job.laborBudgetHours * blendedRate
        : totalLaborCost;  // fallback: actual labor cost to date

    const materialBudget =
      job.materialBudget != null
        ? Number(job.materialBudget)
        : totalMaterialCost; // fallback: actual material cost to date

    // ── From Previous (FIX 5) ─────────────────────────────────────────────────
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

      // FIX 4: Always refresh CO descriptions + scheduled values from live CO data
      rows = rows.map(row => {
        if (row.type === "co" && row.coId) {
          const co = approvedCOs.find(c => c.id === row.coId);
          if (co) {
            return {
              ...row,
              description: coDescription(co),
              scheduledValue: row.scheduledValue || co.approvedValue, // keep user's value unless 0
            };
          }
        }
        return row;
      });
    } else {
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

    // ── Apply "From Previous" from invoice history (FIX 5) ───────────────────
    // Always recompute from live invoice data — don't rely on saved value
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
