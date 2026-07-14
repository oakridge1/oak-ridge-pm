export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeCircuitInput, computeClaim } from "@/lib/panel-schedules";

// PATCH — update a circuit. ANY active user (crew tag circuits in the field).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; panelId: string; circuitId: string }> }
) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { panelId, circuitId } = await params;
  const body = await req.json();

  const circuit = await prisma.panelCircuit.findUnique({
    where: { id: circuitId },
    select: { id: true, ckt: true, poles: true, panelScheduleId: true, panelSchedule: { select: { circuitCount: true } } },
  });
  if (!circuit || circuit.panelScheduleId !== panelId) {
    return new NextResponse("Circuit not found", { status: 404 });
  }

  let sane;
  try {
    sane = sanitizeCircuitInput(body);
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : "Invalid circuit data", { status: 400 });
  }

  const circuitCount = circuit.panelSchedule.circuitCount;
  const updatedByName = u.name ?? u.email ?? "Unknown";

  // Compute new + old claimed continuations (same-side slots claimed by a multi-pole anchor).
  const { continuations: newClaim, overrun } = computeClaim(circuit.ckt, sane.poles, circuitCount);
  if (overrun) {
    return NextResponse.json(
      { error: `A ${sane.poles}-pole breaker on circuit ${circuit.ckt} runs past the last circuit on this side.` },
      { status: 400 }
    );
  }

  const { continuations: oldClaim } = computeClaim(circuit.ckt, circuit.poles, circuitCount);

  // Validate the newly claimed slots are empty (OPEN, or SPACE with no data).
  if (newClaim.length > 0) {
    const claimed = await prisma.panelCircuit.findMany({
      where: { panelScheduleId: panelId, ckt: { in: newClaim } },
      select: { ckt: true, status: true, description: true },
    });
    const blocking = claimed.filter(
      (c) => !(c.status === "OPEN" || (c.status === "SPACE" && !c.description))
    );
    if (blocking.length > 0) {
      const ckts = blocking.map((c) => c.ckt).sort((a, b) => a - b);
      const label = ckts.length === 1 ? `Circuit ${ckts[0]}` : `Circuits ${ckts.join(", ")}`;
      return NextResponse.json(
        { error: `${label} already have data; clear them before setting a ${sane.poles}-pole breaker here.` },
        { status: 400 }
      );
    }
  }

  // Slots to release: claimed under old poles but not new poles → back to OPEN.
  const released = oldClaim.filter((ckt) => !newClaim.includes(ckt));

  await prisma.$transaction(async (tx) => {
    await tx.panelCircuit.update({
      where: { id: circuitId },
      data: {
        status: sane.status,
        description: sane.description,
        poles: sane.poles,
        amps: sane.amps,
        flags: sane.flags,
        updatedByName,
      },
    });
    // Newly claimed continuations → OPEN placeholders (rendered as continuations client-side).
    if (newClaim.length > 0) {
      await tx.panelCircuit.updateMany({
        where: { panelScheduleId: panelId, ckt: { in: newClaim } },
        data: { status: "OPEN", description: null, poles: 1, amps: 20 },
      });
    }
    // Released slots → OPEN (defensive; they were already OPEN as continuations).
    if (released.length > 0) {
      await tx.panelCircuit.updateMany({
        where: { panelScheduleId: panelId, ckt: { in: released } },
        data: { status: "OPEN", description: null, poles: 1, amps: 20 },
      });
    }
  });

  // Best-effort useCount bump when the edit came from a library entry.
  if (body.libraryEntryId) {
    await prisma.circuitLibrary
      .update({ where: { id: body.libraryEntryId }, data: { useCount: { increment: 1 } } })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
