export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { EstimatePdfDoc } from "@/lib/estimate-pdf";
import { calcBid } from "@/lib/estimating";
import type { EstimateData } from "@/lib/estimating";
import { createElement } from "react";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active || (u.role !== "ADMIN" && !u.estimatingPermission)) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      designFeeUser: { select: { name: true } },
    },
  });
  if (!estimate) return new NextResponse("Not found", { status: 404 });

  const data: EstimateData = {
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

  const totals = calcBid(data);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = await renderToBuffer(createElement(EstimatePdfDoc, { estimate, totals, data }) as any);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${estimate.estimateNumber}-bid-summary.pdf"`,
    },
  });
}
