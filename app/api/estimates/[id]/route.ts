export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active || (u.role !== "ADMIN" && !u.estimatingPermission)) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      designFeeUser: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, jobNumber: true } },
    },
  });

  if (!estimate) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(estimate);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active || (u.role !== "ADMIN" && !u.estimatingPermission)) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;

  const body = await req.json();

  // Whitelist updatable fields
  const {
    name, clientName, address, status, notes, scopeOfWork, jobNumberAssigned,
    laborRate, bulkMarkup, lightMarkup, permitMarkup, subMarkup,
    overhead, profit, nonProd, designFeePct, designFeeUserId,
    conditionMult, heightAdj,
    takeoffItems, assemblies, panelItems, permits, subs,
  } = body;

  const estimate = await prisma.estimate.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(clientName !== undefined && { clientName }),
      ...(address !== undefined && { address }),
      ...(status !== undefined && { status }),
      ...(notes !== undefined && { notes }),
      ...(scopeOfWork !== undefined && { scopeOfWork }),
      ...(jobNumberAssigned !== undefined && { jobNumberAssigned }),
      ...(laborRate !== undefined && { laborRate }),
      ...(bulkMarkup !== undefined && { bulkMarkup }),
      ...(lightMarkup !== undefined && { lightMarkup }),
      ...(permitMarkup !== undefined && { permitMarkup }),
      ...(subMarkup !== undefined && { subMarkup }),
      ...(overhead !== undefined && { overhead }),
      ...(profit !== undefined && { profit }),
      ...(nonProd !== undefined && { nonProd }),
      ...(designFeePct !== undefined && { designFeePct }),
      ...(designFeeUserId !== undefined && { designFeeUserId: designFeeUserId || null }),
      ...(conditionMult !== undefined && { conditionMult }),
      ...(heightAdj !== undefined && { heightAdj }),
      ...(takeoffItems !== undefined && { takeoffItems }),
      ...(assemblies !== undefined && { assemblies }),
      ...(panelItems !== undefined && { panelItems }),
      ...(permits !== undefined && { permits }),
      ...(subs !== undefined && { subs }),
      // Set awardedAt when status changes to AWARDED
      ...(status === "AWARDED" && { awardedAt: new Date() }),
    },
  });

  return NextResponse.json(estimate);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  await prisma.estimate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
