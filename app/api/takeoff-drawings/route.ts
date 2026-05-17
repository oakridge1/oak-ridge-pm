export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function canEstimate(u: { role?: string | null; estimatingPermission?: boolean | null } | undefined) {
  if (!u) return false;
  return u.role === "ADMIN" || u.estimatingPermission === true;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const estimateId = searchParams.get("estimateId");
  if (!estimateId) return new NextResponse("estimateId required", { status: 400 });

  const drawings = await prisma.takeoffDrawing.findMany({
    where: { estimateId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(drawings);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user as any)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { estimateId, name } = body;
  if (!estimateId || !name) return new NextResponse("estimateId and name required", { status: 400 });

  const drawing = await prisma.takeoffDrawing.create({
    data: { estimateId, name },
  });

  return NextResponse.json(drawing, { status: 201 });
}
