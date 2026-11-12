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

// Every array in an EstimatorState blob that holds estimate lines. If any is
// non-empty (or any takeoffCounts value is > 0), the job "has lines".
const LINE_ARRAYS = [
  "takeoff",
  "takeoffAreas",
  "asms",
  "savedPanels",
  "savedRuns",
  "savedRacks",
  "savedMCHR",
  "savedThreeWay",
  "savedData",
  "savedFA",
  "savedCans",
  "savedGear",
  "savedCustomDev",
  "savedTM",
  "savedLV",
  "savedCustomAsm",
  "savedHAR",
  "savedFloorBox",
  "permits",
  "subs",
  "lightingSchedule",
  "gearSchedule",
] as const;

function hasLines(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  for (const key of LINE_ARRAYS) {
    const v = d[key];
    if (Array.isArray(v) && v.length > 0) return true;
  }
  const counts = d.takeoffCounts;
  if (counts && typeof counts === "object") {
    for (const n of Object.values(counts as Record<string, unknown>)) {
      if (typeof n === "number" && n > 0) return true;
    }
  }
  return false;
}

// POST — save a job by (userId, jobId).
// Body: { jobId, jobName, jobNumber, data, baseUpdatedAt?, force? }
//   baseUpdatedAt — the cloud updatedAt this copy was based on. If the cloud
//                   row has changed since, the save is refused (409 stale).
//   force         — true skips ONLY the empty-over-full guard.
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !session.user.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { jobId, jobName, jobNumber, data, baseUpdatedAt, force } = body ?? {};
  if (!jobId || typeof jobId !== "string") {
    return new NextResponse("jobId required", { status: 400 });
  }

  let base: Date | null = null;
  if (baseUpdatedAt !== undefined && baseUpdatedAt !== null) {
    base = new Date(baseUpdatedAt);
    if (typeof baseUpdatedAt !== "string" || isNaN(base.getTime())) {
      return new NextResponse("baseUpdatedAt must be an ISO date string", { status: 400 });
    }
  } else {
    console.warn("estimator save without baseUpdatedAt", jobId);
  }

  const fields = {
    jobName:   jobName   ?? "",
    jobNumber: jobNumber ?? "",
    data:      data ?? {},
  };

  const existing = await prisma.estimatorJob.findUnique({
    where: { userId_jobId: { userId, jobId } },
    select: { updatedAt: true, data: true },
  });

  // No cloud row yet.
  if (!existing) {
    // The client had a cloud copy, so the job was deleted elsewhere. Don't recreate it.
    if (base) return NextResponse.json({ error: "deleted" }, { status: 410 });
    try {
      const created = await prisma.estimatorJob.create({
        data: { jobId, userId, ...fields },
        select: { updatedAt: true },
      });
      return NextResponse.json({ ok: true, updatedAt: created.updatedAt });
    } catch {
      // Another save created it at the same moment.
      return NextResponse.json({ error: "stale", cloudUpdatedAt: null }, { status: 409 });
    }
  }

  const cloudUpdatedAt = existing.updatedAt;

  if (base && base.getTime() !== cloudUpdatedAt.getTime()) {
    return NextResponse.json({ error: "stale", cloudUpdatedAt }, { status: 409 });
  }

  if (force !== true && hasLines(existing.data) && !hasLines(fields.data)) {
    return NextResponse.json({ error: "empty_over_full", cloudUpdatedAt }, { status: 409 });
  }

  // Conditional write: only if the row is still the version checked above.
  const updatedAt = new Date();
  const result = await prisma.estimatorJob.updateMany({
    where: { userId, jobId, updatedAt: cloudUpdatedAt },
    data:  { ...fields, updatedAt },
  });
  if (result.count === 0) {
    const now = await prisma.estimatorJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
      select: { updatedAt: true },
    });
    if (!now) return NextResponse.json({ error: "deleted" }, { status: 410 });
    return NextResponse.json({ error: "stale", cloudUpdatedAt: now.updatedAt }, { status: 409 });
  }

  return NextResponse.json({ ok: true, updatedAt });
}
