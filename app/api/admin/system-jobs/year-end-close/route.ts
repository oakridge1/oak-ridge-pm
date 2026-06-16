export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function nextJobNumbers(currentJobs: { jobNumber: string }[]): {
  nextOffice: string;
  nextShop: string;
  nextPrefix: string;
} {
  // Extract numeric prefixes from job numbers like "26-000", "26-999"
  const prefixes = currentJobs
    .map((j) => parseInt(j.jobNumber.split("-")[0], 10))
    .filter((n) => !isNaN(n));

  const currentPrefix = prefixes.length > 0 ? Math.max(...prefixes) : new Date().getFullYear() % 100;
  const nextPrefix = currentPrefix + 1;
  const nextYY = String(nextPrefix).padStart(2, "0");

  return {
    nextPrefix: nextYY,
    nextOffice: `${nextYY}-000`,
    nextShop: `${nextYY}-999`,
  };
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  // Find all current active system jobs
  const currentSystemJobs = await prisma.job.findMany({
    where: { isSystemJob: true, status: "IN_PROGRESS" },
    select: { id: true, jobNumber: true, jobName: true },
  });

  if (currentSystemJobs.length === 0) {
    return NextResponse.json({ error: "No active system jobs found to close." }, { status: 400 });
  }

  const { nextOffice, nextShop, nextPrefix } = nextJobNumbers(currentSystemJobs);

  // Guard: check next-year jobs don't already exist
  const existing = await prisma.job.findFirst({
    where: { jobNumber: { in: [nextOffice, nextShop] } },
  });
  if (existing) {
    return NextResponse.json(
      {
        error: `Year-end jobs already exist (${nextOffice} / ${nextShop}). Close may have already been run.`,
      },
      { status: 409 }
    );
  }

  // Set current system jobs to COMPLETED
  await prisma.job.updateMany({
    where: { id: { in: currentSystemJobs.map((j) => j.id) } },
    data: { status: "COMPLETED" },
  });

  // Create next-year system jobs
  const created = await prisma.$transaction([
    prisma.job.create({
      data: {
        jobNumber: nextOffice,
        jobName: "Office & Overhead",
        isSystemJob: true,
        status: "IN_PROGRESS",
        jobType: "SYSTEM",
      },
    }),
    prisma.job.create({
      data: {
        jobNumber: nextShop,
        jobName: "Shop & Equipment",
        isSystemJob: true,
        status: "IN_PROGRESS",
        jobType: "SYSTEM",
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    archived: currentSystemJobs.length,
    created: created.map((j) => ({ jobNumber: j.jobNumber, jobName: j.jobName })),
  });
}
