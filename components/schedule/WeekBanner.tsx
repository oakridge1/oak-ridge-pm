"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getMySchedule } from "@/app/(app)/schedule/actions";
import { formatHHMM } from "@/lib/dateUtils";
import { ArriveDepart } from "./ArriveDepart";

type ScheduleItem = Awaited<ReturnType<typeof getMySchedule>>[number];

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Date helpers ──────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day  = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekLabel(mon: Date, sun: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WeekBanner() {
  const today = new Date();

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(today));
  const [schedules, setSchedules]  = useState<ScheduleItem[]>([]);
  const [loading, setLoading]      = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => toYMD(today));

  // Reload when week changes
  useEffect(() => {
    setLoading(true);
    getMySchedule(toYMD(weekStart))
      .then((data) => { setSchedules(data); setLoading(false); })
      .catch(()    => setLoading(false));
  }, [weekStart]);

  // Build Mon-Sun array for this week
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const sunday = days[6];

  const todayStr = toYMD(today);

  function schedulesOn(dateStr: string) {
    return schedules.filter((s) => s.date === dateStr);
  }

  function prevWeek() {
    setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; });
  }
  function nextWeek() {
    setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; });
  }

  const selected = selectedDay ? schedulesOn(selectedDay) : [];

  return (
    <div className="mb-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

        {/* ── Header: week label + navigation ─────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <button
            onClick={prevWeek}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-xs font-semibold text-gray-600">
            {weekLabel(days[0], sunday)}
          </span>
          <button
            onClick={nextWeek}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Day strip ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dateStr    = toYMD(day);
            const isToday    = dateStr === todayStr;
            const isSelected = dateStr === selectedDay;
            const hasSched   = schedulesOn(dateStr).length > 0;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`flex flex-col items-center py-3 px-1 transition-colors ${
                  isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                } ${i < 6 ? "border-r border-gray-100" : ""}`}
              >
                <span className="text-[10px] font-medium text-gray-400 mb-1">
                  {DAY_SHORT[i]}
                </span>
                <span
                  className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday
                      ? "bg-[#002D72] text-white"
                      : isSelected
                      ? "text-[#002D72]"
                      : "text-gray-800"
                  }`}
                >
                  {day.getDate()}
                </span>
                {/* Schedule dot */}
                {hasSched && (
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#002D72]" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Selected-day panel ───────────────────────────────────────────── */}
        {selectedDay && (
          <div className="border-t border-gray-100">
            {loading ? (
              <p className="px-4 py-3 text-xs text-gray-400">Loading…</p>
            ) : selected.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-400">No shifts scheduled for this day.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {selected.map((s) => (
                  <div key={s.scheduleId} className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">{s.job.name}</p>
                    <p className="text-xs text-gray-500">
                      {s.job.number}
                      {s.startTime ? ` · ${formatHHMM(s.startTime)}` : ""}
                      {s.endTime   ? ` – ${formatHHMM(s.endTime)}`   : ""}
                    </p>
                    {s.job.address && (
                      <p className="text-xs text-gray-400 mt-0.5">{s.job.address}</p>
                    )}
                    {s.notes && (
                      <p className="text-xs text-gray-500 italic mt-0.5">{s.notes}</p>
                    )}
                    <ArriveDepart
                      scheduleId={s.scheduleId}
                      initialClockEntry={s.clockEntry}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
