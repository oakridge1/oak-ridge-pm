"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMySchedule } from "@/app/(app)/schedule/actions";
import { formatHHMM } from "@/lib/dateUtils";
import { ArriveDepart } from "./ArriveDepart";
import { ScheduleModal } from "./ScheduleModal";

type ScheduleItem = Awaited<ReturnType<typeof getMySchedule>>[number];

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day  = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/** Returns "YYYY-MM-DD" using LOCAL date parts to avoid UTC-offset shift. */
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekLabel(mon: Date, sun: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WeekBanner() {
  console.log("WeekBanner rendering");

  // Initialise dates client-side only to avoid SSR/hydration mismatch.
  const [todayStr, setTodayStr]       = useState<string>("");
  const [weekStart, setWeekStart]     = useState<Date | null>(null);
  const [schedules, setSchedules]     = useState<ScheduleItem[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showModal, setShowModal]     = useState(false);
  const [modalDate, setModalDate]     = useState<string>("");

  // Set client-side dates once on mount
  useEffect(() => {
    const today = new Date();
    const mon   = getMondayOf(today);
    setTodayStr(toYMD(today));
    setWeekStart(mon);
    setSelectedDay(toYMD(today));
  }, []);

  // Reload schedules whenever the week changes
  useEffect(() => {
    if (!weekStart) return;
    setLoading(true);
    getMySchedule(toYMD(weekStart))
      .then((data) => {
        setSchedules(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("WeekBanner load error:", err);
        setSchedules([]);
        setLoading(false);
      });
  }, [weekStart]);

  // Build Mon–Sun array (use a stable placeholder until weekStart is set)
  const baseDate = weekStart ?? new Date();
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    return d;
  });
  const sunday = days[6];

  function schedulesOn(dateStr: string) {
    return schedules.filter((s) => s.date.slice(0, 10) === dateStr);
  }

  function prevWeek() {
    setWeekStart((w) => {
      const base = w ?? new Date();
      const d = new Date(base);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }
  function nextWeek() {
    setWeekStart((w) => {
      const base = w ?? new Date();
      const d = new Date(base);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  const selected = selectedDay ? schedulesOn(selectedDay) : [];

  return (
    <div className="mb-6">
      <div className="bg-[#1e3a8a] rounded-2xl shadow-sm overflow-hidden">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={prevWeek}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="text-center">
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">
              This Week
            </p>
            <p className="text-xs font-semibold text-white mt-0.5">
              {weekLabel(days[0], sunday)}
            </p>
          </div>
          <button
            onClick={nextWeek}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* ── Day strip ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-7 border-t border-white/10">
          {days.map((day, i) => {
            const dateStr    = toYMD(day);
            const isToday    = todayStr !== "" && dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const hasSched   = schedulesOn(dateStr).length > 0;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`flex flex-col items-center py-3 px-1 transition-colors ${
                  isSelected ? "bg-white/15" : "hover:bg-white/10"
                } ${i < 6 ? "border-r border-white/10" : ""}`}
              >
                <span className="text-[10px] font-medium text-white/50 mb-1">
                  {DAY_SHORT[i]}
                </span>
                <span
                  className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-white text-[#1e3a8a]"
                      : isSelected
                      ? "text-white ring-1 ring-white/50"
                      : "text-white/90"
                  }`}
                >
                  {day.getDate()}
                </span>
                {hasSched && (
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#FF5910]" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Selected-day panel ───────────────────────────────────────────── */}
        {selectedDay && (
          <div className="border-t border-white/10 bg-white/5">
            {loading ? (
              <p className="px-4 py-3 text-xs text-white/50">Loading…</p>
            ) : selected.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 px-4">
                <p className="text-white/60 text-sm">No shifts scheduled for this day.</p>
                <button
                  onClick={() => {
                    setModalDate(selectedDay ?? "");
                    setShowModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-white/30 text-white hover:bg-white/10 transition-colors"
                >
                  + Schedule Crew
                </button>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {selected.map((s) => (
                  <div key={s.scheduleId} className="px-4 py-3">
                    <p className="text-sm font-semibold text-white">{s.job.name}</p>
                    <p className="text-xs text-white/60">
                      {s.job.number}
                      {s.startTime ? ` · ${formatHHMM(s.startTime)}` : ""}
                      {s.endTime   ? ` – ${formatHHMM(s.endTime)}`   : ""}
                    </p>
                    {s.job.address && (
                      <p className="text-xs text-white/50 mt-0.5">{s.job.address}</p>
                    )}
                    {s.notes && (
                      <p className="text-xs text-white/50 italic mt-0.5">{s.notes}</p>
                    )}
                    <ArriveDepart
                      scheduleId={s.scheduleId}
                      initialClockEntry={s.clockEntry}
                    />
                  </div>
                ))}
                <div className="px-4 py-2">
                  <button
                    onClick={() => {
                      setModalDate(selectedDay ?? "");
                      setShowModal(true);
                    }}
                    className="mt-2 text-xs text-white/60 hover:text-white underline transition-colors"
                  >
                    + Add another shift
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && modalDate && (
        <ScheduleModal
          date={modalDate}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            if (weekStart) {
              getMySchedule(toYMD(weekStart))
                .then(setSchedules)
                .catch(console.error);
            }
          }}
        />
      )}
    </div>
  );
}
