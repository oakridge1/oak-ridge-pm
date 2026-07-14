export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CIRCUIT_FLAGS, CIRCUIT_STATUSES } from "@/lib/panel-schedules";

// GET — full circuit library, most-used first.
export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const entries = await prisma.circuitLibrary.findMany({
    orderBy: [{ useCount: "desc" }, { label: "asc" }],
  });
  return NextResponse.json(entries);
}

// POST — save a new circuit preset to the library from the field. Any active user.
export async function POST(req: Request) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const label = (body.label as string)?.trim().toUpperCase();
  if (!label) return new NextResponse("Label is required", { status: 400 });

  const existing = await prisma.circuitLibrary.findUnique({ where: { label }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: `"${label}" is already in the library.` }, { status: 409 });
  }

  const poles = Number(body.defaultPoles ?? 1);
  const amps = Number(body.defaultAmps ?? 20);
  const flagsIn = Array.isArray(body.defaultFlags) ? body.defaultFlags.map(String) : [];
  const flags = flagsIn.filter((f: string) => CIRCUIT_FLAGS.includes(f as (typeof CIRCUIT_FLAGS)[number]));
  const status = String(body.defaultStatus ?? "ASSIGNED");
  const defaultStatus = CIRCUIT_STATUSES.includes(status as (typeof CIRCUIT_STATUSES)[number]) ? status : "ASSIGNED";
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

  const entry = await prisma.circuitLibrary.create({
    data: {
      label,
      defaultPoles: Number.isInteger(poles) && poles >= 1 && poles <= 3 ? poles : 1,
      defaultAmps: Number.isFinite(amps) ? amps : 20,
      defaultFlags: flags,
      defaultStatus,
      tags,
      isSeeded: false,
      createdById: u.id,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
