export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcConduitRun, calcMCHR } from "@/lib/estimating";
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
    const condType = (data.conduitType as string) ?? "EMT";
    const condSize = (data.conduitSize as string) ?? "3/4";
    const numCond = (data.conductorCount as number) ?? 2;
    const wireSize = `#${data.conductorSize ?? "12"}`;
    const footage = (data.footage as number) ?? 0;
    const diff = (data.difficulty as number) ?? 1.0;
    const result = calcConduitRun(condType, condSize, numCond, wireSize, "Cu", "1-Hole Strap", footage, 2, 1, false, diff);
    const assembly: Assembly = {
      id: newId(),
      type: "CONDUIT_RUN",
      label: data.label ?? `${condSize}" ${condType} — ${footage.toFixed(1)} ft`,
      params: { condType, condSize, numCond, wireSize, footage, diff, fromDrawingId: id },
      mat: result.mat,
      lab: result.lab,
      lines: result.lines,
    };
    const updatedAssemblies = [...currentAssemblies, assembly];
    await prisma.estimate.update({ where: { id: estimate.id }, data: { assemblies: updatedAssemblies } });
  } else if (type === "mcHomeRun") {
    const wireSize = (data.mcSize as string) ?? "12";
    const footage = (data.footage as number) ?? 0;
    const circuits = (data.circuits as number) ?? 1;
    const result = calcMCHR(wireSize, 2, "20", "CJ6", footage, 12, 1.0);
    const label = data.label ?? `MC #${wireSize}/2 — ${footage.toFixed(1)} ft × ${circuits} circuit${circuits > 1 ? "s" : ""}`;
    const assembly: Assembly = {
      id: newId(),
      type: "MC_HOME_RUN",
      label,
      params: { wireSize, footage, circuits, fromDrawingId: id },
      mat: result.mat,
      lab: result.lab,
      lines: result.lines,
    };
    const updatedAssemblies = [...currentAssemblies, assembly];
    await prisma.estimate.update({ where: { id: estimate.id }, data: { assemblies: updatedAssemblies } });
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
