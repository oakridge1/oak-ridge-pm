export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canEstimate(u: { role?: string | null; estimatingPermission?: boolean | null } | undefined) {
  if (!u) return false;
  return u.role === "ADMIN" || u.estimatingPermission === true;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const drawing = await prisma.takeoffDrawing.findUnique({ where: { id } });
  if (!drawing) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(drawing);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const { markups, runTypes, assemblies, pageScales, pdfData, pageCount, name } = body;

  const drawing = await prisma.takeoffDrawing.update({
    where: { id },
    data: {
      ...(markups !== undefined && { markups }),
      ...(runTypes !== undefined && { runTypes }),
      ...(assemblies !== undefined && { assemblies }),
      ...(pageScales !== undefined && { pageScales }),
      ...(pdfData !== undefined && { pdfData }),
      ...(pageCount !== undefined && { pageCount }),
      ...(name !== undefined && { name }),
    },
  });

  return NextResponse.json(drawing);
}

// Keep PUT as alias for PATCH for backward compat
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return PATCH(req, { params });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const { id } = await params;
  await prisma.takeoffDrawing.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
