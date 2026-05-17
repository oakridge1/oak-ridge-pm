export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  const { id: jobId } = await params;

  const approvals = await prisma.stockApprovalRequest.findMany({
    where: { jobId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      requestedBy: { select: { name: true, email: true } },
      requests: {
        include: {
          stockItem: { select: { name: true, lingo: true, unitOfMeasure: true } },
          user: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(approvals);
}
