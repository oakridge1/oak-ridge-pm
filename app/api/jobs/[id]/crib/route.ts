import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [stockItems, pendingRequests, recentOrders] = await Promise.all([
    prisma.stockItem.findMany({
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.stockRequest.findMany({
      where: { jobId: id, status: { in: ["PENDING", "ORDERED"] } },
      include: {
        stockItem: { select: { name: true, category: true, unitOfMeasure: true } },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.stockOrder.findMany({
      where: { jobId: id },
      orderBy: { sentAt: "desc" },
      take: 10,
      include: { sentBy: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({ stockItems, pendingRequests, recentOrders });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const request = await prisma.stockRequest.create({
    data: {
      id: crypto.randomUUID(),
      jobId: id,
      userId: session.user.id,
      stockItemId: body.stockItemId || null,
      customItemName: body.customItemName || null,
      customCategory: body.customCategory || null,
      quantity: body.quantity ?? 1,
      quantityUnit: body.quantityUnit || null,
      note: body.note || null,
      deliveryMethod: body.deliveryMethod || "PICKUP",
      status: "PENDING",
      orderDate: new Date(),
      createdAt: new Date(),
    },
  });
  return NextResponse.json(request);
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE" && session.user.role !== "FOREMAN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const { supplierName, supplierEmail, deliveryMethod, poNumber, deliveryNotes, requestIds, items } = body;

  // Create stock order
  const order = await prisma.stockOrder.create({
    data: {
      id: crypto.randomUUID(),
      jobId: id,
      supplierName: supplierName || null,
      supplierEmail: supplierEmail || null,
      deliveryMethod: deliveryMethod || null,
      poNumber: poNumber || null,
      deliveryNotes: deliveryNotes || null,
      items: JSON.stringify(items),
      sentAt: new Date(),
      sentById: session.user.id,
      createdAt: new Date(),
    },
  });

  // Update requests to ORDERED
  if (requestIds?.length) {
    await prisma.stockRequest.updateMany({
      where: { id: { in: requestIds } },
      data: { status: "ORDERED" },
    });
  }

  return NextResponse.json(order);
}

export async function DELETE(req: Request, { params }: Params) {
  const { id: _jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reqId = new URL(req.url).searchParams.get("reqId");
  if (!reqId) return NextResponse.json({ error: "Missing reqId" }, { status: 400 });
  await prisma.stockRequest.delete({ where: { id: reqId } });
  return NextResponse.json({ ok: true });
}
