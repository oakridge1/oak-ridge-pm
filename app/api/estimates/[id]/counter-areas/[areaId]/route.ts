export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canEstimate(u: any) {
  return u?.role === "ADMIN" || u?.estimatingPermission === true;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id, areaId } = await params;
  const body = await req.json();

  const area = await prisma.counterArea.findFirst({ where: { id: areaId, estimateId: id } });
  if (!area) return new NextResponse("Not found", { status: 404 });

  const updated = await prisma.counterArea.update({
    where: { id: areaId },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.counts !== undefined ? { counts: body.counts } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; areaId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id, areaId } = await params;

  // Must keep at least 1 area
  const count = await prisma.counterArea.count({ where: { estimateId: id } });
  if (count <= 1) return new NextResponse("Cannot delete the last area", { status: 400 });

  await prisma.counterArea.delete({ where: { id: areaId } });
  return new NextResponse(null, { status: 204 });
}
