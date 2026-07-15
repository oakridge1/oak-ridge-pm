export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildOpenCircuitRows, phasesFromSystem, validateFedAmps, canManagePanels } from "@/lib/panel-schedules";

// GET — list panels for a job, ordered by name, with circuit counts.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;

  const panels = await prisma.panelSchedule.findMany({
    where: { jobId },
    orderBy: { name: "asc" },
    include: { _count: { select: { circuits: true } } },
  });

  return NextResponse.json(panels);
}

// POST — create a panel + its full OPEN circuit grid.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;
  if (!(await canManagePanels(u, jobId))) return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();

  const name = (body.name as string)?.trim().toUpperCase();
  const circuitCount = Number(body.circuitCount);

  if (!name) return new NextResponse("Panel name is required", { status: 400 });
  if (!body.panelType || !body.system || !body.mainType) {
    return new NextResponse("panelType, system, and mainType are required", { status: 400 });
  }
  if (!Number.isInteger(circuitCount) || circuitCount % 2 !== 0 || circuitCount < 12 || circuitCount > 84) {
    return new NextResponse("Circuit count must be an even number between 12 and 84", { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return new NextResponse("Job not found", { status: 404 });

  // Unique panel name per job.
  const existing = await prisma.panelSchedule.findFirst({
    where: { jobId, name },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: `A panel named "${name}" already exists on this job.` }, { status: 409 });
  }

  const mainType = body.mainType as string;
  const mainAmps = mainType === "MB" && body.mainAmps != null ? Number(body.mainAmps) : null;
  const fedAmps = body.fedAmps != null && body.fedAmps !== "" ? Number(body.fedAmps) : null;

  const fedErr = validateFedAmps({ mainType, mainAmps, busAmps: Number(body.busAmps) || 0, fedAmps });
  if (fedErr) return NextResponse.json({ error: fedErr }, { status: 400 });

  const panel = await prisma.$transaction(async (tx) => {
    const created = await tx.panelSchedule.create({
      data: {
        jobId,
        name,
        panelType: body.panelType,
        system: body.system,
        phases: phasesFromSystem(body.system),
        busAmps: Number(body.busAmps) || 0,
        mainType,
        mainAmps,
        fedAmps,
        fedFrom: body.fedFrom?.trim() || null,
        location: body.location?.trim() || null,
        breakerType: body.breakerType?.trim() || null,
        catalogNumber: body.catalogNumber?.trim() || null,
        circuitCount,
        afc: body.afc?.trim() || null,
        aicRating: body.aicRating?.trim() || null,
        enclosure: body.enclosure?.trim() || null,
        integralTVSS: !!body.integralTVSS,
        notes: body.notes?.trim() || null,
        createdById: u.id,
      },
      select: { id: true },
    });

    await tx.panelCircuit.createMany({ data: buildOpenCircuitRows(created.id, 1, circuitCount) });
    return created;
  });

  return NextResponse.json({ panelId: panel.id }, { status: 201 });
}
