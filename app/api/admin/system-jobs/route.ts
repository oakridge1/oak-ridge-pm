export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const jobs = await prisma.job.findMany({
    where: { isSystemJob: true, status: "IN_PROGRESS" },
    orderBy: { jobNumber: "asc" },
    select: { id: true, jobNumber: true, jobName: true },
  });

  return NextResponse.json(jobs);
}
