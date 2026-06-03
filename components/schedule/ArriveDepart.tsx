"use client";

import { useState, useEffect, useTransition } from "react";
import { clockIn, clockOut } from "@/app/(app)/schedule/actions";
import { formatTime12 } from "@/lib/dateUtils";

interface ClockEntryData {
  arrivedAt:    string | null;
  departedAt:   string | null;
  hoursWorked:  number | null;
  lunchDeducted: boolean;
}

interface ArriveDepartProps {
  scheduleId:        string;
  initialClockEntry: ClockEntryData | null;
}

export function ArriveDepart({ scheduleId, initialClockEntry }: ArriveDepartProps) {
  const [entry, setEntry]             = useState<ClockEntryData | null>(initialClockEntry);
  const [lunchDeducted, setLunch]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [elapsed, setElapsed]         = useState("");
  const [pending, startTransition]    = useTransition();

  // Running clock while arrived but not yet departed
  useEffect(() => {
    if (!entry?.arrivedAt || entry.departedAt) return;
    function tick() {
      const ms = Date.now() - new Date(entry!.arrivedAt!).getTime();
      const h  = Math.floor(ms / 3_600_000);
      const m  = Math.floor((ms % 3_600_000) / 60_000);
      setElapsed(`${h}h ${m.toString().padStart(2, "0")}m`);
    }
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [entry?.arrivedAt, entry?.departedAt]);

  function handleArrive() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await clockIn(scheduleId);
        setEntry({ arrivedAt: res.arrivedAt, departedAt: null, hoursWorked: null, lunchDeducted: false });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clock in");
      }
    });
  }

  function handleDepart() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await clockOut(scheduleId, lunchDeducted);
        setEntry((prev) =>
          prev
            ? { ...prev, departedAt: new Date().toISOString(), hoursWorked: res.hoursWorked, lunchDeducted }
            : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clock out");
      }
    });
  }

  // ── Clocked out ────────────────────────────────────────────────────────────
  if (entry?.departedAt) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-green-600 font-medium">✓ Clocked out</span>
        <span className="text-gray-500 text-xs">
          {entry.hoursWorked?.toFixed(2)} hrs
          {entry.lunchDeducted ? " (–30 min lunch)" : ""}
        </span>
      </div>
    );
  }

  // ── Clocked in (arrived, not departed) ────────────────────────────────────
  if (entry?.arrivedAt) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>In at {formatTime12(entry.arrivedAt)}</span>
          {elapsed && (
            <span className="font-mono bg-blue-50 text-[#002D72] px-2 py-0.5 rounded font-medium">
              {elapsed}
            </span>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={lunchDeducted}
            onChange={(e) => setLunch(e.target.checked)}
            className="rounded border-gray-300 text-[#002D72] focus:ring-[#002D72]"
          />
          Deduct 30-min lunch
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleDepart}
          disabled={pending}
          className="w-full bg-orange-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {pending ? "…" : "Depart"}
        </button>
      </div>
    );
  }

  // ── Not yet arrived ────────────────────────────────────────────────────────
  return (
    <div className="mt-2">
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <button
        onClick={handleArrive}
        disabled={pending}
        className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
      >
        {pending ? "…" : "Arrive"}
      </button>
    </div>
  );
}

