export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { jobId } = body;

  if (!jobId) return new NextResponse("jobId is required", { status: 400 });

  const receipt = await prisma.receipt.findUnique({ where: { id } });
  if (!receipt) return new NextResponse("Not Found", { status: 404 });

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } });
  if (!job) return new NextResponse("Target job not found", { status: 404 });

  const updated = await prisma.receipt.update({
    where: { id },
    data: { jobId },
    include: {
      job: { select: { jobNumber: true, jobName: true } },
      uploadedBy: { select: { name: true } },
      vehicle: { select: { tag: true } },
    },
  });

  return NextResponse.json(updated);
}
