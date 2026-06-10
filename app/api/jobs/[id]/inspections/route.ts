import { generateId } from '@/lib/utils/uuid';
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const inspections = await prisma.inspection.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return NextResponse.json(inspections);
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const inspection = await prisma.inspection.create({
    data: {
      id: generateId(),
      jobId: id,
      createdById: session.user.id,
      type: body.type,
      dateCalled: body.dateCalled ? new Date(body.dateCalled) : null,
      dateScheduled: body.dateScheduled ? new Date(body.dateScheduled) : null,
      inspectorName: body.inspectorName || null,
      inspectorPhone: body.inspectorPhone || null,
      notes: body.notes || null,
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(inspection);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id: _jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const inspectionId = url.searchParams.get("inspectionId");
  if (!inspectionId) return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
  const body = await req.json();
  const updated = await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      result: body.result || null,
      correctionNotes: body.correctionNotes || null,
      reinspectDate: body.reinspectDate ? new Date(body.reinspectDate) : null,
      notes: body.notes ?? undefined,
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: Params) {
  const { id: _jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const inspectionId = new URL(req.url).searchParams.get("inspectionId");
  if (!inspectionId) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.inspection.delete({ where: { id: inspectionId } });
  return NextResponse.json({ ok: true });
}
