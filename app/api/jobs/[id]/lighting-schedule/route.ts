export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;

  const items = await prisma.lightingScheduleItem.findMany({
    where: { jobId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(items);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;
  const body = await req.json() as { itemId: string; qty: number };

  const { itemId, qty } = body;
  if (!itemId || typeof qty !== "number") {
    return new NextResponse("itemId and qty are required", { status: 400 });
  }

  const item = await prisma.lightingScheduleItem.findUnique({ where: { id: itemId } });
  if (!item || item.jobId !== jobId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const updated = await prisma.lightingScheduleItem.update({
    where: { id: itemId },
    data: { qty },
  });

  return NextResponse.json(updated);
}
