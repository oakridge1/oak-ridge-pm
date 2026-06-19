export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// GET — fetch one job (full data) belonging to the current user
export async function GET(_req: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session.user.active) return new NextResponse("Unauthorized", { status: 401 });

  const { jobId } = await params;

  const job = await prisma.estimatorJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!job) return new NextResponse("Not found", { status: 404 });

  return NextResponse.json(job);
}

// DELETE — delete one job belonging to the current user
export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session.user.active) return new NextResponse("Unauthorized", { status: 401 });

  const { jobId } = await params;

  await prisma.estimatorJob.deleteMany({
    where: { userId, jobId },
  });

  return NextResponse.json({ ok: true });
}
