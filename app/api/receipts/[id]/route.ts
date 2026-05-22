export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const role = session.user.role;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      job: { select: { jobNumber: true, jobName: true } },
      uploadedBy: { select: { name: true } },
      vehicle: { select: { tag: true } },
    },
  });

  if (!receipt) return new NextResponse("Not Found", { status: 404 });

  // Field crew: can only see their own receipts
  if (role !== "ADMIN" && role !== "OFFICE") {
    if (receipt.uploadedById !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return NextResponse.json(receipt);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const role = session.user.role;

  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) return new NextResponse("Not Found", { status: 404 });

  // Field crew can only edit their own receipts
  if (role !== "ADMIN" && role !== "OFFICE") {
    if (receipt.uploadedById !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  const body = await req.json();

  // Sanitize: strip fields that should not be user-editable for field crew
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = { ...body };
  if (role !== "ADMIN" && role !== "OFFICE") {
    // Remove admin-only fields
    delete data.flagged;
    delete data.flagReason;
    delete data.reviewedBy;
    delete data.reviewedAt;
    delete data.uploadedById;
    delete data.jobId;
  }

  // Coerce types
  if (data.amount !== undefined) data.amount = Number(data.amount);
  if (data.mileage !== undefined) data.mileage = Number(data.mileage);
  if (data.receiptDate !== undefined) data.receiptDate = data.receiptDate ? new Date(data.receiptDate) : null;

  const updated = await prisma.receipt.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  await prisma.receipt.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
