import { NextResponse } from "next/server";
import { yesterdayEastern } from "@/lib/autolog/computeAutoLog";
import { runAutoLog } from "@/lib/autolog/runAutoLog";
import { parseJobNumberAllowlist } from "@/lib/autolog/autologGuards";
import { checkCronAuth, shouldSendSummary } from "@/lib/autolog/cronHelpers";
import { sendAutoLogSummary } from "@/lib/autolog/sendAutoLogSummary";

// Nightly auto-log (06:00 UTC). Fails closed on the secret. Logs only for jobs in
// AUTO_LOG_JOB_NUMBERS (empty = nothing) on/after AUTO_LOG_START_DATE; safe to re-run.
export async function GET(req: Request) {
  const auth = checkCronAuth(process.env.CRON_SECRET, req.headers.get("authorization"));
  if (!auth.ok) {
    if (auth.status === 500) console.error("[autolog] CRON_SECRET is not set; refusing to run.");
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // "Yesterday" is an America/New_York calendar date, never the server's UTC date.
  const date = yesterdayEastern(new Date());

  let result;
  try {
    result = await runAutoLog(date);
  } catch (err) {
    console.error("[autolog] run failed:", err);
    return NextResponse.json(
      { date, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  // The email must never undo or fail the labor entries that were already written.
  if (shouldSendSummary(result)) {
    try {
      await sendAutoLogSummary(
        { targetDate: date, logged: result.logged, skipped: result.skipped, errors: result.errors },
        parseJobNumberAllowlist(process.env.AUTO_LOG_JOB_NUMBERS),
      );
    } catch (err) {
      console.error("[autolog] summary email failed:", err);
    }
  }

  console.log(
    `[autolog] ${date}: logged ${result.logged.length}, skipped ${result.skipped.length}, errors ${result.errors.length}` +
      (result.blocked ? ` (blocked: ${result.blocked})` : ""),
  );

  return NextResponse.json({
    date,
    logged: result.logged.length,
    skipped: result.skipped.length,
    errors: result.errors.length,
    ...(result.blocked ? { blocked: result.blocked } : {}),
  });
}
