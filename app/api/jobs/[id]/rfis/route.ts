import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rfis = await prisma.rfi.findMany({
    where: { jobId: id },
    orderBy: { rfiNumber: "desc" },
    include: { submittedBy: { select: { name: true } } },
  });
  return NextResponse.json(rfis);
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const last = await prisma.rfi.findFirst({ where: { jobId: id }, orderBy: { rfiNumber: "desc" } });
  const rfiNumber = (last?.rfiNumber ?? 0) + 1;
  const rfi = await prisma.rfi.create({
    data: {
      id: crypto.randomUUID(),
      jobId: id,
      submittedById: session.user.id,
      rfiNumber,
      subject: body.subject,
      description: body.description || null,
      submittedTo: body.submittedTo || null,
      submittedToEmail: body.submittedToEmail || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      updatedAt: new Date(),
    },
  });
  return NextResponse.json(rfi);
}

export async function PATCH(req: Request, { params }: Params) {
  const { id: _jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rfiId = new URL(req.url).searchParams.get("rfiId");
  if (!rfiId) return NextResponse.json({ error: "Missing rfiId" }, { status: 400 });
  const body = await req.json();
  const updated = await prisma.rfi.update({
    where: { id: rfiId },
    data: { answer: body.answer, status: "ANSWERED", answeredDate: new Date(), updatedAt: new Date() },
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
  const rfiId = new URL(req.url).searchParams.get("rfiId");
  if (!rfiId) return NextResponse.json({ error: "Missing rfiId" }, { status: 400 });
  await prisma.rfi.delete({ where: { id: rfiId } });
  return NextResponse.json({ ok: true });
}
