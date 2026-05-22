export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import {
  TaxPackagePDF,
  TaxPackageData,
  fmt as _fmt,
  getQuarterDates,
  getOverheadForPeriod,
} from "./_template";

// suppress unused-import warning — fmt is re-exported for template use
void _fmt;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = (await req.json()) as { quarter?: number; year?: number; notes?: string };
  const now = new Date();
  const quarter = body.quarter ?? Math.ceil((now.getMonth() + 1) / 3);
  const year = body.year ?? now.getFullYear();
  const notes = body.notes ?? "";
  const qNames = ["Q1", "Q2", "Q3", "Q4"];
  const label = `${qNames[quarter - 1]} ${year}`;

  const { start, end } = getQuarterDates(quarter, year);

  // Revenue
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        date: { gte: start, lte: end },
        status: { not: "DRAFT" },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      select: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        date: { gte: start, lte: end },
        job: { excludeFromPL: false, isSystemJob: false },
      },
      select: { amount: true },
    }),
  ]);

  const toNum = (v: unknown) =>
    typeof v === "object" && v !== null && "toNumber" in v
      ? (v as { toNumber: () => number }).toNumber()
      : Number(v ?? 0);

  const totalInvoiced = invoices.reduce((s, inv) => s + toNum(inv.amount), 0);
  const totalCollected = payments.reduce((s, p) => s + toNum(p.amount), 0);
  const outstanding = Math.max(0, totalInvoiced - totalCollected);

  // Direct costs (excluding test/excluded jobs)
  const jobs = await prisma.job.findMany({
    where: { isSystemJob: false, excludeFromPL: false },
    include: {
      laborEntries: {
        where: { date: { gte: start, lte: end } },
        include: { user: { include: { wage: true } } },
      },
      materials: {
        where: { createdAt: { gte: start, lte: end } },
        select: { amount: true },
      },
      invoices: {
        where: { date: { gte: start, lte: end }, status: { not: "DRAFT" } },
        select: { amount: true },
      },
    },
  });

  let totalLabor = 0;
  let totalMaterials = 0;
  let totalSubcontractors = 0;
  let totalEquipment = 0;
  let totalOther = 0;
  const jobRows: TaxPackageData["jobs"] = [];

  for (const job of jobs) {
    const hasActivity = job.laborEntries.length > 0 || job.materials.length > 0;

    let jobLabor = 0;
    for (const entry of job.laborEntries) {
      const wage = entry.user.wage;
      if (!wage) continue;
      jobLabor += entry.hours * wage.hourlyWage * (1 + wage.burdenRate);
    }
    totalLabor += jobLabor;

    const jobMaterials = job.materials.reduce((s, m) => s + toNum(m.amount), 0);
    totalMaterials += jobMaterials;

    let jobSubs = 0;
    let jobEquip = 0;
    let jobOther = 0;

    if (hasActivity) {
      jobSubs = toNum(job.subcontractorCost);
      totalSubcontractors += jobSubs;
      const equipCost = toNum(job.equipmentCost);
      const equipBillPct = job.equipmentBillPct ?? 0;
      jobEquip = equipCost * (equipBillPct / 100);
      totalEquipment += jobEquip;

      if (Array.isArray(job.otherCosts)) {
        for (const oc of job.otherCosts as Array<{ amount?: number }>) {
          const a = typeof oc.amount === "number" ? oc.amount : 0;
          jobOther += a;
          totalOther += a;
        }
      }
    }

    const jobDirectCosts = jobLabor + jobMaterials + jobSubs + jobEquip + jobOther;
    const jobInvoiced = job.invoices.reduce((s, inv) => s + toNum(inv.amount), 0);
    const jobGrossProfit = jobInvoiced - jobDirectCosts;
    const jobMarginPct = jobInvoiced > 0 ? (jobGrossProfit / jobInvoiced) * 100 : 0;

    if (hasActivity || jobInvoiced > 0) {
      jobRows.push({
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        status: job.status,
        invoiced: jobInvoiced,
        directCosts: jobDirectCosts,
        grossProfit: jobGrossProfit,
        marginPct: jobMarginPct,
      });
    }
  }

  jobRows.sort((a, b) => b.invoiced - a.invoiced);

  const directCostsTotal = totalLabor + totalMaterials + totalSubcontractors + totalEquipment + totalOther;
  const grossProfit = totalInvoiced - directCostsTotal;
  const grossMarginPct = totalInvoiced > 0 ? (grossProfit / totalInvoiced) * 100 : 0;

  // Overhead
  const allOverheadCosts = await prisma.overheadCost.findMany();
  const { byCategory: overheadByCategory, total: overheadTotal } = getOverheadForPeriod(
    allOverheadCosts,
    start,
    end
  );

  // Distributions
  const [draws, contractorPayments] = await Promise.all([
    prisma.ownerDraw.findMany({
      where: { drawDate: { gte: start, lte: end } },
      include: { user: { select: { name: true } } },
    }),
    prisma.contractorPayment.findMany({
      where: { paymentDate: { gte: start, lte: end } },
      include: { user: { select: { name: true } } },
    }),
  ]);

  const drawMap = new Map<string, number>();
  for (const d of draws) {
    const name = d.user.name ?? "Unknown";
    drawMap.set(name, (drawMap.get(name) ?? 0) + d.amount);
  }
  const drawsList = Array.from(drawMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const drawsTotal = drawsList.reduce((s, d) => s + d.amount, 0);

  const contractorMap = new Map<string, number>();
  for (const cp of contractorPayments) {
    const name = cp.user.name ?? "Unknown";
    contractorMap.set(name, (contractorMap.get(name) ?? 0) + cp.amountUSD);
  }
  const contractorsList = Array.from(contractorMap.entries())
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const contractorsTotal = contractorsList.reduce((s, c) => s + c.amount, 0);

  const distributionsTotal = drawsTotal + contractorsTotal;
  const netProfit = grossProfit - overheadTotal - distributionsTotal;
  const netMarginPct = totalInvoiced > 0 ? (netProfit / totalInvoiced) * 100 : 0;

  const generated = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const data: TaxPackageData = {
    quarter,
    year,
    label,
    generated,
    notes,
    revenue: { totalInvoiced, totalCollected, outstanding },
    directCosts: {
      labor: totalLabor,
      materials: totalMaterials,
      subcontractors: totalSubcontractors,
      equipment: totalEquipment,
      other: totalOther,
      total: directCostsTotal,
    },
    grossProfit,
    grossMarginPct,
    overhead: { byCategory: overheadByCategory, total: overheadTotal },
    distributions: {
      draws: drawsList,
      contractors: contractorsList,
      drawsTotal,
      contractorsTotal,
      total: distributionsTotal,
    },
    netProfit,
    netMarginPct,
    jobs: jobRows,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfBuffer = await renderToBuffer(React.createElement(TaxPackagePDF, { data }) as any);

  const filename = `OakRidge_${label.replace(/\s+/g, "_")}_Financial_Summary.pdf`;
  const uint8 = new Uint8Array(pdfBuffer);

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(uint8.length),
    },
  });
}
