export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canEstimate(u: any) {
  return u?.role === "ADMIN" || u?.estimatingPermission === true;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;

  const areas = await prisma.counterArea.findMany({
    where: { estimateId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(areas.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  })));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const { name } = body;
  if (!name?.trim()) return new NextResponse("name required", { status: 400 });

  // Determine sort order
  const count = await prisma.counterArea.count({ where: { estimateId: id } });

  const area = await prisma.counterArea.create({
    data: { estimateId: id, name: name.trim(), sortOrder: count },
  });

  return NextResponse.json({
    ...area,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString(),
  }, { status: 201 });
}
