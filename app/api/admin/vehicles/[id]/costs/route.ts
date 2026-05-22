export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: vehicleId } = await params;

  const costs = await prisma.receipt.findMany({
    where: {
      vehicleId,
      isFuel: false,
      type: "vehicle_cost",
    },
    orderBy: { receiptDate: "desc" },
    take: 20,
    select: {
      id: true,
      category: true,
      amount: true,
      receiptDate: true,
      description: true,
      vendor: true,
      imageUrl: true,
    },
  });

  return NextResponse.json(costs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: vehicleId } = await params;

  const body = await req.json();
  const { costType, amount, date, description, receiptUrl } = body;

  if (!costType || amount == null) {
    return NextResponse.json({ error: "costType and amount are required" }, { status: 400 });
  }

  // Find the vehicle to get its tag
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { tag: true },
  });

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Find the Shop & Equipment system job (job number ending in -999)
  const shopJob = await prisma.job.findFirst({
    where: { jobNumber: { endsWith: "-999" } },
    select: { id: true },
  });

  const receipt = await prisma.receipt.create({
    data: {
      jobId: shopJob?.id ?? null,
      vehicleId,
      type: "vehicle_cost",
      vendor: vehicle.tag,
      category: costType,
      amount: parseFloat(String(amount)),
      receiptDate: date ? new Date(date) : new Date(),
      description: description ?? null,
      imageUrl: receiptUrl ?? null,
      uploadedById: session.user.id,
      isFuel: false,
    },
  });

  return NextResponse.json(receipt, { status: 201 });
}
