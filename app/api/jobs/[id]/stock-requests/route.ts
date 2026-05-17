export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function getStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  const { id: jobId } = await params;

  const requests = await prisma.stockRequest.findMany({
    where: { jobId, orderDate: { gte: getStartOfToday() } },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } }, stockItem: { select: { name: true, category: true, lingo: true } } },
  });
  return NextResponse.json(requests);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  const { id: jobId } = await params;

  const body = await req.json();
  const { stockItemId, customItemName, customCategory, variables, quantity, quantityUnit, note, deliveryMethod } = body;

  if (!stockItemId && !customItemName) {
    return NextResponse.json({ error: "Stock item or custom item name required" }, { status: 400 });
  }

  const request = await prisma.stockRequest.create({
    data: {
      jobId,
      userId: session.user.id,
      stockItemId: stockItemId || null,
      customItemName: customItemName || null,
      customCategory: customCategory || null,
      variables: variables || null,
      quantity: Number(quantity) || 1,
      quantityUnit: quantityUnit || null,
      note: note || null,
      deliveryMethod: deliveryMethod || "PICKUP",
      status: "PENDING",
      orderDate: new Date(),
    },
    include: { user: { select: { name: true } }, stockItem: { select: { name: true, category: true, lingo: true } } },
  });

  return NextResponse.json(request);
}
