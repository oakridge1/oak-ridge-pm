import { prisma } from "@/lib/prisma";

// Suggest the next job number in the dominant "YY-NNN" format (e.g. "26-190").
// Excludes system jobs (year-end close creates YY-000 / YY-999 which would poison
// the max). Non-matching numbers (e.g. "26-test2") are ignored. Purely advisory —
// the field stays editable and the unique constraint + P2002 catch is the backstop.
export async function getNextJobNumber(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(-2);
  const jobs = await prisma.job.findMany({
    where: { isSystemJob: false, jobNumber: { startsWith: `${yy}-` } },
    select: { jobNumber: true },
  });

  let max = 0;
  for (const j of jobs) {
    const m = /^\d{2}-(\d{3})/.exec(j.jobNumber);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }

  return `${yy}-${String(max + 1).padStart(3, "0")}`;
}
