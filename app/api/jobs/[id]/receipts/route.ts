export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;
  const role = session.user.role;

  // Verify job exists
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const receipts = await prisma.receipt.findMany({
    where: { jobId },
    include: {
      uploadedBy: { select: { name: true } },
      vehicle: { select: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ receipts });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: jobId } = await params;

  // Verify job exists
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await req.json();
  const {
    imageUrl,
    amount,
    vendor,
    receiptDate,
    description,
    isFuel,
    vehicleId,
    mileage,
    notes,
  } = body as {
    imageUrl?: string;
    amount?: number;
    vendor?: string;
    receiptDate?: string;
    description?: string;
    isFuel?: boolean;
    vehicleId?: string;
    mileage?: number;
    notes?: string;
  };

  const receipt = await prisma.receipt.create({
    data: {
      jobId,
      uploadedById: session.user.id,
      type: "job",
      imageUrl: imageUrl ?? null,
      amount: amount !== undefined ? Number(amount) : null,
      vendor: vendor ?? null,
      receiptDate: receiptDate ? new Date(receiptDate) : null,
      description: description ?? null,
      isFuel: isFuel ?? false,
      vehicleId: isFuel && vehicleId ? vehicleId : null,
      mileage: isFuel && mileage != null ? Number(mileage) : null,
      notes: notes ?? null,
    },
    include: {
      uploadedBy: { select: { name: true } },
      vehicle: { select: { tag: true } },
    },
  });

  // Archive to Document Vault
  if (imageUrl) {
    const vendorName = vendor ?? "Receipt";
    const dateStr = receiptDate
      ? new Date(receiptDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    await prisma.document.create({
      data: {
        jobId,
        uploadedById: session.user.id,
        category: "RECEIPTS",
        name: `${dateStr} — ${vendorName}`,
        fileUrl: imageUrl,
        fileName: `receipt-${dateStr}.jpg`,
        fileSize: null,
      },
    });
  }

  return NextResponse.json({ receipt }, { status: 201 });
}
