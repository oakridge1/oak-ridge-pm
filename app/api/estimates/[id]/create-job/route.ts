export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcBid } from "@/lib/estimating";
import type { EstimateData } from "@/lib/estimating";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({ where: { id } });
  if (!estimate) return new NextResponse("Not found", { status: 404 });
  if (estimate.status !== "AWARDED") return new NextResponse("Estimate must be AWARDED", { status: 400 });
  if (!estimate.jobNumberAssigned) return new NextResponse("No job number assigned", { status: 400 });

  // Check for duplicate job number
  const existingJob = await prisma.job.findUnique({ where: { jobNumber: estimate.jobNumberAssigned } });
  if (existingJob) return new NextResponse("Job number already exists", { status: 409 });

  // Compute bid totals
  const estimateData: EstimateData = {
    laborRate: estimate.laborRate,
    bulkMarkup: estimate.bulkMarkup,
    lightMarkup: estimate.lightMarkup,
    permitMarkup: estimate.permitMarkup,
    subMarkup: estimate.subMarkup,
    overhead: estimate.overhead,
    profit: estimate.profit,
    nonProd: estimate.nonProd,
    designFeePct: estimate.designFeePct,
    conditionMult: estimate.conditionMult,
    heightAdj: estimate.heightAdj,
    takeoffItems: (estimate.takeoffItems as any) ?? [],
    assemblies: (estimate.assemblies as any) ?? [],
    panelItems: (estimate.panelItems as any) ?? [],
    permits: (estimate.permits as any) ?? [],
    subs: (estimate.subs as any) ?? [],
  };

  const totals = calcBid(estimateData);

  // Create job
  const job = await prisma.job.create({
    data: {
      jobNumber: estimate.jobNumberAssigned,
      jobName: estimate.name,
      address: estimate.address ?? undefined,
      status: "ACTIVE",
      jobType: "BID",
      contractValue: totals.grandWithSubs,
      laborBudgetDollars: totals.rawLabor,
      materialBudget: totals.rawMat,
      createdById: session.user.id!,
    },
  });

  // Link estimate to job
  await prisma.estimate.update({
    where: { id },
    data: { jobId: job.id },
  });

  return NextResponse.json({ jobId: job.id });
}
