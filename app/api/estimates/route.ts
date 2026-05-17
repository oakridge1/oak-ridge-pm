export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const u = session?.user;
  if (!u?.active || (u.role !== "ADMIN" && !u.estimatingPermission)) return new NextResponse("Forbidden", { status: 403 });

  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      designFeeUser: { select: { id: true, name: true, email: true } },
      job: { select: { id: true, jobNumber: true } },
    },
  });

  return NextResponse.json(estimates);
}

export async function POST(req: Request) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active || (u.role !== "ADMIN" && !u.estimatingPermission)) return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { name, clientName, address } = body;
  if (!name?.trim()) return new NextResponse("Name required", { status: 400 });

  // Auto-generate estimate number
  const count = await prisma.estimate.count();
  const estimateNumber = `EST-${String(count + 1).padStart(3, "0")}`;

  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      name: name.trim(),
      clientName: clientName?.trim() || null,
      address: address?.trim() || null,
      createdById: u.id,
    },
  });

  return NextResponse.json(estimate, { status: 201 });
}
