export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const { receiptId, splits } = body as {
    receiptId: string;
    splits: Array<{ jobId: string; percentage: number }>;
  };

  if (!receiptId || !Array.isArray(splits) || splits.length === 0) {
    return new NextResponse("receiptId and splits are required", { status: 400 });
  }

  const totalPct = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    return new NextResponse("Split percentages must sum to 100", { status: 400 });
  }

  const original = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!original) return new NextResponse("Receipt not found", { status: 404 });

  const baseAmount = original.amount ?? 0;

  // Create split receipts
  const created = await Promise.all(
    splits.map((split) =>
      prisma.receipt.create({
        data: {
          jobId: split.jobId,
          type: original.type,
          vendor: original.vendor,
          amount: Math.round(baseAmount * (split.percentage / 100) * 100) / 100,
          receiptDate: original.receiptDate,
          description: original.description,
          imageUrl: original.imageUrl,
          vehicleId: original.vehicleId,
          mileage: original.mileage,
          isFuel: original.isFuel,
          notes: `Split ${split.percentage}% from receipt ${receiptId}${original.notes ? ` — ${original.notes}` : ""}`,
          uploadedById: original.uploadedById,
        },
      })
    )
  );

  // Archive original
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { archivedToVault: true },
  });

  return NextResponse.json(created, { status: 201 });
}
