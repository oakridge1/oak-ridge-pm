"use client";

import { useState, useTransition } from "react";
import { runAutoLogForDate, type RunSummary } from "./actions";

export function RunButton({
  targetDate,
  eligibleCount,
  disabledReason,
}: {
  targetDate: string;
  eligibleCount: number;
  disabledReason: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RunSummary | null>(null);

  const disabled = pending || !!disabledReason || eligibleCount === 0;

  function run() {
    if (
      !window.confirm(
        `Create ${eligibleCount} auto-logged hour entries for ${targetDate}? Only jobs in AUTO_LOG_JOB_NUMBERS.`,
      )
    ) return;
    startTransition(async () => {
      setResult(await runAutoLogForDate(targetDate));
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        className="px-3 py-1.5 text-sm rounded bg-[#1e3a8a] text-white hover:bg-[#1e40af] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Running..." : "Run for this date"}
      </button>
      {disabledReason ? (
        <div className="text-xs text-gray-500">{disabledReason}</div>
      ) : eligibleCount === 0 ? (
        <div className="text-xs text-gray-500">Nothing eligible to log for this date.</div>
      ) : null}
      {result && (
        <div className="text-sm border border-gray-200 rounded px-3 py-2 bg-gray-50">
          {!result.ok ? (
            <span className="text-red-600">{result.message}</span>
          ) : result.blocked ? (
            <span className="text-gray-700">
              Nothing run: {result.blocked === "disabled" ? "AUTO_LOG_JOB_NUMBERS is not set" : "date is before AUTO_LOG_START_DATE"}.
            </span>
          ) : (
            <span className="text-gray-700">
              Logged {result.logged}, skipped {result.skipped}, errors {result.errors}.
              {result.errorDetails.length > 0 && (
                <span className="block text-red-600 text-xs mt-1">{result.errorDetails.join("; ")}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
