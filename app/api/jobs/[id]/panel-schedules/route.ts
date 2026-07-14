export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Single source of truth for a circuit row's status-dependent defaults.
// Rule: amps is null for SPACE and DEVICE rows; otherwise defaults to 20.
export function circuitDefaults(status: string): { poles: number; amps: number | null } {
  const ampsNull = status === "SPACE" || status === "DEVICE";
  return { poles: 1, amps: ampsNull ? null : 20 };
}

// Build the full grid of OPEN circuit rows for a panel (ckt start..end inclusive).
export function buildOpenCircuitRows(panelScheduleId: string, start: number, end: number) {
  const rows = [];
  for (let ckt = start; ckt <= end; ckt++) {
    const { poles, amps } = circuitDefaults("OPEN");
    rows.push({ panelScheduleId, ckt, status: "OPEN", poles, amps, flags: [] as string[] });
  }
  return rows;
}

// Phases derive from the voltage system: "3PH" → 3, otherwise 1.
export function phasesFromSystem(system: string): number {
  return /3PH/i.test(system) ? 3 : 1;
}

function canManage(role?: string) {
  return role === "ADMIN" || role === "OFFICE" || role === "FOREMAN";
}

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
  if (!canManage(u.role)) return new NextResponse("Forbidden", { status: 403 });

  const { id: jobId } = await params;
  const body = await req.json();

  const name = (body.name as string)?.trim();
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
        fedAmps: body.fedAmps != null && body.fedAmps !== "" ? Number(body.fedAmps) : null,
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
