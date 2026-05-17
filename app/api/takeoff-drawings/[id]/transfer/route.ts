export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcConduitRun, calcMcHomeRun } from "@/lib/estimating";
import type { Assembly, TakeoffItem, EstimateData } from "@/lib/estimating";

function canEstimate(u: { role?: string | null; estimatingPermission?: boolean | null } | undefined) {
  if (!u) return false;
  return u.role === "ADMIN" || u.estimatingPermission === true;
}

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;

  const drawing = await prisma.takeoffDrawing.findUnique({ where: { id } });
  if (!drawing) return new NextResponse("Drawing not found", { status: 404 });

  const estimate = await prisma.estimate.findUnique({ where: { id: drawing.estimateId } });
  if (!estimate) return new NextResponse("Estimate not found", { status: 404 });

  const body = await req.json();
  const { type, data } = body as { type: "conduitRun" | "mcHomeRun" | "counts"; data: any };

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
    takeoffItems: (estimate.takeoffItems as TakeoffItem[]) ?? [],
    assemblies: (estimate.assemblies as Assembly[]) ?? [],
    panelItems: [],
    permits: [],
    subs: [],
  };

  const currentAssemblies: Assembly[] = Array.isArray(estimate.assemblies)
    ? (estimate.assemblies as Assembly[])
    : [];
  const currentTakeoffItems: TakeoffItem[] = Array.isArray(estimate.takeoffItems)
    ? (estimate.takeoffItems as TakeoffItem[])
    : [];

  if (type === "conduitRun") {
    const result = calcConduitRun(
      {
        size: data.conduitSize ?? "3/4",
        footage: data.footage ?? 0,
        conductors: data.conductorCount ?? 2,
        wireSize: data.conductorSize ?? "12",
        difficulty: data.difficulty ?? 1.0,
      },
      estimateData
    );
    const assembly: Assembly = {
      id: newId(),
      type: "CONDUIT_RUN",
      label: data.label ?? `${data.conduitSize ?? "3/4"}" ${data.conduitType ?? "EMT"} — ${(data.footage ?? 0).toFixed(1)} ft`,
      params: {
        size: data.conduitSize ?? "3/4",
        footage: data.footage ?? 0,
        conductors: data.conductorCount ?? 2,
        wireSize: data.conductorSize ?? "12",
        difficulty: data.difficulty ?? 1.0,
        mat: result.mat,
        lhr: result.lhr,
        fromDrawingId: id,
      },
    };
    const updatedAssemblies = [...currentAssemblies, assembly];
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { assemblies: updatedAssemblies },
    });
  } else if (type === "mcHomeRun") {
    const result = calcMcHomeRun(
      {
        wireSize: data.mcSize ?? "12",
        footage: data.footage ?? 0,
        circuits: data.circuits ?? 1,
        hasBox: data.includeJBox ?? false,
      },
      estimateData
    );
    const assembly: Assembly = {
      id: newId(),
      type: "MC_HOME_RUN",
      label: data.label ?? `MC ${data.mcSize ?? "12/2"} — ${(data.footage ?? 0).toFixed(1)} ft × ${data.circuits ?? 1} circuits`,
      params: {
        wireSize: data.mcSize ?? "12",
        footage: data.footage ?? 0,
        circuits: data.circuits ?? 1,
        hasBox: data.includeJBox ?? false,
        mat: result.mat,
        lhr: result.lhr,
        fromDrawingId: id,
      },
    };
    const updatedAssemblies = [...currentAssemblies, assembly];
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { assemblies: updatedAssemblies },
    });
  } else if (type === "counts") {
    // data: { bomId: string; qty: number; note?: string }[]
    const newItems: TakeoffItem[] = Array.isArray(data)
      ? data.map((d: { bomId: string; qty: number; note?: string }) => ({
          id: newId(),
          bomId: d.bomId,
          qty: d.qty,
          note: d.note,
        }))
      : [];
    const updatedTakeoffItems = [...currentTakeoffItems, ...newItems];
    await prisma.estimate.update({
      where: { id: estimate.id },
      data: { takeoffItems: updatedTakeoffItems },
    });
  }

  return NextResponse.json({ success: true });
}
