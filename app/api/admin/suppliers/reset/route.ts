export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const NEW_SUPPLIERS = [
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

export async function POST() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  await prisma.supplier.deleteMany();
  await prisma.supplier.createMany({ data: NEW_SUPPLIERS });
  return NextResponse.json({ ok: true });
}
