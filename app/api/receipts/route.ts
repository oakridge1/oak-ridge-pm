export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId") ?? undefined;
  const type = searchParams.get("type") ?? undefined;
  const flagged = searchParams.get("flagged") === "true" ? true : undefined;
  const unreviewed = searchParams.get("unreviewed") === "true";
  const vehicleId = searchParams.get("vehicleId") ?? undefined;
  const uploadedById = searchParams.get("uploadedById") ?? undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (jobId) where.jobId = jobId;
  if (type) where.type = type;
  if (flagged !== undefined) where.flagged = flagged;
  if (unreviewed) where.reviewedAt = null;
  if (vehicleId) where.vehicleId = vehicleId;
  if (uploadedById) where.uploadedById = uploadedById;

  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      job: { select: { jobNumber: true, jobName: true } },
      uploadedBy: { select: { name: true } },
      vehicle: { select: { tag: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(receipts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const {
    jobId,
    type,
    vendor,
    amount,
    receiptDate,
    description,
    imageUrl,
    vehicleId,
    mileage,
    isFuel,
    notes,
  } = body;

  const receipt = await prisma.receipt.create({
    data: {
      jobId: jobId ?? null,
      type: type ?? "job",
      vendor: vendor ?? null,
      amount: amount !== undefined ? Number(amount) : null,
      receiptDate: receiptDate ? new Date(receiptDate) : null,
      description: description ?? null,
      imageUrl: imageUrl ?? null,
      vehicleId: vehicleId ?? null,
      mileage: mileage !== undefined ? Number(mileage) : null,
      isFuel: isFuel ?? false,
      notes: notes ?? null,
      uploadedById: session.user.id,
    },
  });

  return NextResponse.json(receipt, { status: 201 });
}
