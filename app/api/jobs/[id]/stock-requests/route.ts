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
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { jobId, orderDate: { gte: getStartOfToday() } };
  if (statusFilter) {
    where.status = statusFilter;
  }

  const requests = await prisma.stockRequest.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { name: true } },
      stockItem: { select: { name: true, category: true, lingo: true, isConsumable: true } },
    },
  });
  return NextResponse.json(requests);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  const { id: jobId } = await params;

  const body = await req.json();
  const {
    stockItemId,
    customItemName,
    customCategory,
    variables,
    quantity,
    quantityUnit,
    note,
    deliveryMethod,
    conductorGroupId,
    saveToMasterList,
    isConsumableOverride,
  } = body;

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
      conductorGroupId: conductorGroupId || null,
      saveToMasterList: saveToMasterList === true,
      isConsumableOverride: isConsumableOverride === true,
    },
    include: { user: { select: { name: true } }, stockItem: { select: { name: true, category: true, lingo: true, isConsumable: true } } },
  });

  return NextResponse.json(request);
}
