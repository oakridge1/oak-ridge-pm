export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_SUPPLIERS = [
  { name: "Granite City Electric (GCE)", pickupOnly: false },
  { name: "CED — Consolidated Electrical Distributors", pickupOnly: false },
  { name: "Rexel", pickupOnly: false },
  { name: "Northeast Electric", pickupOnly: false },
  { name: "State Electric", pickupOnly: false },
  { name: "Green Mountain Electric", pickupOnly: false },
  { name: "CES — Commercial Electric Supply", pickupOnly: false },
  { name: "Home Depot", pickupOnly: true },
  { name: "Amazon", pickupOnly: true },
  { name: "Lowes", pickupOnly: true },
];

async function ensureDefaultSuppliers() {
  const count = await prisma.supplier.count();
  if (count === 0) {
    await prisma.supplier.createMany({ data: DEFAULT_SUPPLIERS });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  await ensureDefaultSuppliers();
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(suppliers);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { name, email, phone, repName, accountNumber, deliveryNotes, pickupOnly, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      repName: repName?.trim() || null,
      accountNumber: accountNumber?.trim() || null,
      deliveryNotes: deliveryNotes?.trim() || null,
      pickupOnly: pickupOnly ?? false,
      notes: notes?.trim() || null,
    },
  });
  return NextResponse.json(supplier);
}
