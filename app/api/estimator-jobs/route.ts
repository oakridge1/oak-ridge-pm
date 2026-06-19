export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET — list current user's estimator jobs (metadata only, no data blob)
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session.user.active) return new NextResponse("Unauthorized", { status: 401 });

  const jobs = await prisma.estimatorJob.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      jobId: true,
      jobName: true,
      jobNumber: true,
      savedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(jobs);
}

// POST — upsert a job by (userId, jobId)
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session.user.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { jobId, jobName, jobNumber, data } = body ?? {};
  if (!jobId || typeof jobId !== "string") {
    return new NextResponse("jobId required", { status: 400 });
  }

  const saved = await prisma.estimatorJob.upsert({
    where: { userId_jobId: { userId, jobId } },
    create: {
      jobId,
      userId,
      jobName:   jobName   ?? "",
      jobNumber: jobNumber ?? "",
      data:      data ?? {},
    },
    update: {
      jobName:   jobName   ?? "",
      jobNumber: jobNumber ?? "",
      data:      data ?? {},
    },
    select: { id: true, jobId: true, savedAt: true },
  });

  return NextResponse.json(saved);
}
