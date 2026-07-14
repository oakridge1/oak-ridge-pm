export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { buildOpenCircuitRows, phasesFromSystem } from "@/lib/panel-schedules";

function canManage(role?: string) {
  return role === "ADMIN" || role === "OFFICE" || role === "FOREMAN";
}

// PATCH — update panel specs; handle circuit-count grow/shrink.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (!canManage(u.role)) return new NextResponse("Forbidden", { status: 403 });

  const { panelId } = await params;
  const body = await req.json();

  const panel = await prisma.panelSchedule.findUnique({
    where: { id: panelId },
    select: { id: true, circuitCount: true },
  });
  if (!panel) return new NextResponse("Panel not found", { status: 404 });

  const data: Prisma.PanelScheduleUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.panelType !== undefined) data.panelType = body.panelType;
  if (body.system !== undefined) {
    data.system = body.system;
    data.phases = phasesFromSystem(body.system);
  }
  if (body.busAmps !== undefined) data.busAmps = Number(body.busAmps);
  if (body.mainType !== undefined) data.mainType = body.mainType;
  if (body.mainAmps !== undefined) data.mainAmps = body.mainAmps === null || body.mainAmps === "" ? null : Number(body.mainAmps);
  if (body.fedAmps !== undefined) data.fedAmps = body.fedAmps === null || body.fedAmps === "" ? null : Number(body.fedAmps);
  if (body.fedFrom !== undefined) data.fedFrom = body.fedFrom?.trim() || null;
  if (body.location !== undefined) data.location = body.location?.trim() || null;
  if (body.breakerType !== undefined) data.breakerType = body.breakerType?.trim() || null;
  if (body.catalogNumber !== undefined) data.catalogNumber = body.catalogNumber?.trim() || null;
  if (body.afc !== undefined) data.afc = body.afc?.trim() || null;
  if (body.aicRating !== undefined) data.aicRating = body.aicRating?.trim() || null;
  if (body.enclosure !== undefined) data.enclosure = body.enclosure?.trim() || null;
  if (body.integralTVSS !== undefined) data.integralTVSS = !!body.integralTVSS;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

  // Circuit count change — grow appends OPEN rows; shrink requires the removed rows to be empty.
  let newCount: number | undefined;
  if (body.circuitCount !== undefined) {
    newCount = Number(body.circuitCount);
    if (!Number.isInteger(newCount) || newCount % 2 !== 0 || newCount < 12 || newCount > 84) {
      return new NextResponse("Circuit count must be an even number between 12 and 84", { status: 400 });
    }
    if (newCount < panel.circuitCount) {
      // Rows being removed: ckt > newCount. Only allowed if all are OPEN or SPACE with no description.
      const blocking = await prisma.panelCircuit.findMany({
        where: {
          panelScheduleId: panelId,
          ckt: { gt: newCount },
          NOT: [
            { status: "OPEN" },
            { AND: [{ status: "SPACE" }, { OR: [{ description: null }, { description: "" }] }] },
          ],
        },
        orderBy: { ckt: "asc" },
        select: { ckt: true },
      });
      if (blocking.length > 0) {
        const ckts = blocking.map((c) => c.ckt);
        const lo = ckts[0];
        const hi = ckts[ckts.length - 1];
        const range = lo === hi ? `Circuit ${lo}` : `Circuits ${lo}-${hi}`;
        return NextResponse.json(
          { error: `${range} have data; clear them first.` },
          { status: 400 }
        );
      }
    }
    data.circuitCount = newCount;
  }

  await prisma.$transaction(async (tx) => {
    await tx.panelSchedule.update({ where: { id: panelId }, data });
    if (newCount !== undefined && newCount !== panel.circuitCount) {
      if (newCount > panel.circuitCount) {
        await tx.panelCircuit.createMany({
          data: buildOpenCircuitRows(panelId, panel.circuitCount + 1, newCount),
        });
      } else {
        await tx.panelCircuit.deleteMany({ where: { panelScheduleId: panelId, ckt: { gt: newCount } } });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

// DELETE — ADMIN only. Cascade removes circuits.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (u.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { panelId } = await params;
  await prisma.panelSchedule.delete({ where: { id: panelId } });

  return NextResponse.json({ ok: true });
}
