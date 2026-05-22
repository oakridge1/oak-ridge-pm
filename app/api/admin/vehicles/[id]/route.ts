export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return new NextResponse("Not Found", { status: 404 });
  return NextResponse.json(vehicle);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { tag, year, make, model, plate, primaryDriver, notes, isActive } = body;

  if (!tag?.trim()) return NextResponse.json({ error: "Tag is required" }, { status: 400 });

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      tag: tag.trim(),
      year: year?.trim() || null,
      make: make?.trim() || null,
      model: model?.trim() || null,
      plate: plate?.trim() || null,
      primaryDriver: primaryDriver?.trim() || null,
      notes: notes?.trim() || null,
      isActive: isActive ?? true,
    },
  });

  return NextResponse.json(vehicle);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;

  // Check if vehicle has any receipts — soft delete if so, hard delete if not
  const receiptCount = await prisma.receipt.count({ where: { vehicleId: id } });

  if (receiptCount > 0) {
    // Soft delete — preserve receipts integrity
    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, softDeleted: true, vehicle });
  }

  await prisma.vehicle.delete({ where: { id } });
  return NextResponse.json({ ok: true, softDeleted: false });
}
