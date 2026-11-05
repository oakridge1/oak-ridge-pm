"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { runAutoLog } from "@/lib/autolog/runAutoLog";

export type RunSummary = {
  ok: boolean;
  message?: string;
  blocked?: string | null;
  logged: number;
  skipped: number;
  errors: number;
  errorDetails: string[];
};

const fail = (message: string): RunSummary => ({
  ok: false, message, logged: 0, skipped: 0, errors: 0, errorDetails: [],
});

// ADMIN only, checked here on the server (the page check alone is not enough for an action).
export async function runAutoLogForDate(targetDate: string): Promise<RunSummary> {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return fail("Not allowed");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return fail("Bad date");

  const r = await runAutoLog(targetDate);

  for (const jobId of new Set(r.logged.map((i) => i.jobId))) revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/autolog-preview");

  return {
    ok: true,
    blocked: r.blocked,
    logged: r.logged.length,
    skipped: r.skipped.length,
    errors: r.errors.length,
    errorDetails: r.errors.map((e) => `${e.userName}: ${e.message}`),
  };
}
