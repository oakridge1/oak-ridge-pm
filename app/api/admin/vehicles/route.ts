export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const vehicles = await prisma.vehicle.findMany({
    orderBy: { tag: "asc" },
  });

  return NextResponse.json(vehicles);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { tag, year, make, model, plate, primaryDriver, notes } = body;

  if (!tag) return new NextResponse("tag is required", { status: 400 });

  const vehicle = await prisma.vehicle.create({
    data: {
      tag,
      year: year ?? null,
      make: make ?? null,
      model: model ?? null,
      plate: plate ?? null,
      primaryDriver: primaryDriver ?? null,
      notes: notes ?? null,
    },
  });

  return NextResponse.json(vehicle, { status: 201 });
}
