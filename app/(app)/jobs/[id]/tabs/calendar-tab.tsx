"use client";

import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Calendar,
} from "lucide-react";
import { addCalendarEvent, deleteCalendarEvent } from "./calendar-tab-actions";
import type { Role, CalendarEventType } from "@/app/generated/prisma/client";

type CalEvent = {
  id: string;
  type: CalendarEventType;
  title: string;
  date: Date;
  note: string | null;
  recurrence: string | null;
  recurrenceEndDate: Date | null;
  user: { name: string | null };
};

type Task = {
  id: string;
  title: string;
  dueDate: Date | null;
  status: string;
};

type AllJobEvent = CalEvent & {
  job: { id: string; jobName: string; jobNumber: string; calendarColor: string | null } | null;
};

interface CalendarTabProps {
  job: {
    id: string;
    jobNumber: string;
    completionDate: Date | null;
    calendarEvents: CalEvent[];
    tasks: Task[];
  };
  role: Role;
  currentUserId: string;
  allCalendarEvents?: AllJobEvent[];
}

const EVENT_TYPE_COLORS: Record<CalendarEventType, string> = {
  MILESTONE: "bg-purple-500",
  TASK_DUE: "bg-orange-400",
  COMPLETION: "bg-blue-500",
  DAY_OFF: "bg-red-400",
  CUSTOM: "bg-gray-500",
};

const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  MILESTONE: "Milestone",
  TASK_DUE: "Task Due",
  COMPLETION: "Completion",
  DAY_OFF: "Day Off",
  CUSTOM: "Custom",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type DisplayEvent = {
  id: string; type: CalendarEventType; title: string; date: Date;
  note: string | null; user: { name: string | null } | null;
  isAuto: boolean; sourceId: string;
};

function expandEvent(ev: CalEvent & { date: Date }, year: number, month: number): DisplayEvent[] {
  const recurrence = ev.recurrence ?? "NONE";
  if (recurrence === "NONE") {
    if (ev.date.getFullYear() === year && ev.date.getMonth() === month) {
      return [{ ...ev, isAuto: false, sourceId: ev.id }];
    }
    return [];
  }
  const intervalDays = recurrence === "WEEKLY" ? 7 : 14;
  const endDate = ev.recurrenceEndDate ? new Date(ev.recurrenceEndDate) : new Date(year + 5, 11, 31);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const results: DisplayEvent[] = [];
  let cur = new Date(ev.date);
  while (cur < monthStart && cur <= endDate) {
    cur = new Date(cur.getTime() + intervalDays * 86400000);
  }
  while (cur <= monthEnd && cur <= endDate) {
    results.push({ ...ev, date: new Date(cur), isAuto: false, sourceId: ev.id,
      id: `${ev.id}_${cur.getTime()}` });
    cur = new Date(cur.getTime() + intervalDays * 86400000);
  }
  return results;
}

function buildAllEvents(
  calendarEvents: CalEvent[],
  tasks: Task[],
  completionDate: Date | null,
  year: number,
  month: number
): DisplayEvent[] {
  const normalized = calendarEvents.map((e) => ({ ...e, date: new Date(e.date), recurrenceEndDate: e.recurrenceEndDate ? new Date(e.recurrenceEndDate) : null }));
  const events: DisplayEvent[] = normalized.flatMap((e) => expandEvent(e, year, month));

  if (completionDate) {
    const cd = new Date(completionDate);
    if (cd.getFullYear() === year && cd.getMonth() === month) {
      events.push({ id: "__completion", type: "COMPLETION", title: "Project Completion",
        date: cd, note: null, user: null, isAuto: true, sourceId: "__completion" });
    }
  }

  tasks.filter((t) => t.dueDate && t.status !== "COMPLETED").forEach((t) => {
    const dd = new Date(t.dueDate!);
    if (dd.getFullYear() === year && dd.getMonth() === month) {
      events.push({ id: `__task_${t.id}`, type: "TASK_DUE", title: t.title,
        date: dd, note: null, user: null, isAuto: true, sourceId: `__task_${t.id}` });
    }
  });

  return events;
}

export function CalendarTab({ job, role, currentUserId, allCalendarEvents = [] }: CalendarTabProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [recurrenceType, setRecurrenceType] = useState("NONE");
  const [viewMode, setViewMode] = useState<"job" | "company">("job");

  // Build company-wide events by adapting AllJobEvent to CalEvent
  const companyCalEvents: CalEvent[] = allCalendarEvents.map((e) => ({
    ...e,
    title: e.job ? `${e.job.jobNumber} — ${e.title}` : e.title,
  }));

  const activeEvents = viewMode === "company" ? companyCalEvents : job.calendarEvents;
  const activeTasks = viewMode === "company" ? [] : job.tasks;
  const activeCompletionDate = viewMode === "company" ? null : job.completionDate;

  const allEvents = buildAllEvents(activeEvents, activeTasks, activeCompletionDate, year, month);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  // Build grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsOnDay(day: number) {
    return allEvents.filter((e) => e.date.getDate() === day);
  }

  const selectedDayEvents = selectedDay
    ? allEvents.filter((e) => isSameDay(e.date, selectedDay))
    : [];

  function handleAddEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await addCalendarEvent(job.id, fd);
        setShowAddForm(false);
        setRecurrenceType("NONE");
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add event.");
      }
    });
  }

  return (
    <div className="p-5">
      {/* View toggle */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode("job")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "job" ? "bg-white text-[#002D72] shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          This Job
        </button>
        <button
          onClick={() => setViewMode("company")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            viewMode === "company" ? "bg-white text-[#002D72] shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          All Jobs
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="font-semibold text-gray-900">
          {MONTHS[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div
            key={d}
            className="text-center text-xs font-medium text-gray-400 py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 border-t border-l border-gray-200 rounded-lg overflow-hidden">
        {cells.map((day, idx) => {
          if (day === null) {
            return (
              <div
                key={`empty-${idx}`}
                className="border-b border-r border-gray-100 bg-gray-50 min-h-[60px]"
              />
            );
          }
          const dayEvents = eventsOnDay(day);
          const isToday =
            today.getFullYear() === year &&
            today.getMonth() === month &&
            today.getDate() === day;
          const isSelected =
            selectedDay?.getFullYear() === year &&
            selectedDay?.getMonth() === month &&
            selectedDay?.getDate() === day;

          return (
            <button
              key={day}
              onClick={() =>
                setSelectedDay(
                  isSelected ? null : new Date(year, month, day)
                )
              }
              className={`border-b border-r border-gray-200 min-h-[60px] p-1 text-left transition-colors ${
                isSelected
                  ? "bg-blue-50 border-[#002D72]"
                  : "hover:bg-gray-50"
              }`}
            >
              <span
                className={`text-xs font-medium block mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? "bg-[#002D72] text-white"
                    : isSelected
                    ? "text-[#002D72]"
                    : "text-gray-700"
                }`}
              >
                {day}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={`block w-full text-[10px] text-white px-1 py-0.5 rounded truncate ${
                      EVENT_TYPE_COLORS[ev.type]
                    }`}
                  >
                    {ev.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-gray-400">
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm text-gray-900">
              {selectedDay.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="p-1 text-gray-400 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {selectedDayEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No events on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedDayEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2"
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${EVENT_TYPE_COLORS[ev.type]}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {ev.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {EVENT_TYPE_LABELS[ev.type]}
                      {ev.user?.name ? ` · ${ev.user.name}` : ""}
                    </p>
                    {ev.note && (
                      <p className="text-xs text-gray-600 mt-0.5">{ev.note}</p>
                    )}
                  </div>
                  {!ev.isAuto && role === "ADMIN" && (
                    <button
                      onClick={() =>
                        startTransition(() =>
                          deleteCalendarEvent(ev.sourceId, job.id)
                        )
                      }
                      className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add event */}
      <div className="mt-4">
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 text-sm text-[#002D72] hover:text-[#003d99] font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        ) : (
          <form
            onSubmit={handleAddEvent}
            className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3"
          >
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#002D72]" />
              Add Calendar Event
            </h4>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Type
                </label>
                <select
                  name="type"
                  defaultValue={role === "FIELD" ? "DAY_OFF" : "MILESTONE"}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                >
                  {role === "ADMIN" && (
                    <>
                      <option value="MILESTONE">Milestone</option>
                      <option value="CUSTOM">Custom</option>
                    </>
                  )}
                  {(role === "ADMIN" || role === "OFFICE") && (
                    <option value="TASK_DUE">Task Due</option>
                  )}
                  <option value="DAY_OFF">Day Off</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  name="date"
                  type="date"
                  required
                  defaultValue={
                    selectedDay?.toISOString().slice(0, 10) ??
                    new Date().toISOString().slice(0, 10)
                  }
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                name="title"
                required
                placeholder="Event title…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
              <input name="note" placeholder="Optional note…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recurrence</label>
              <select name="recurrence" value={recurrenceType} onChange={e => setRecurrenceType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]">
                <option value="NONE">Does not repeat</option>
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Bi-Weekly</option>
              </select>
            </div>
            {recurrenceType !== "NONE" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date (optional)</label>
                <input name="recurrenceEndDate" type="date"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]" />
                <p className="text-xs text-gray-400 mt-1">Leave blank to repeat indefinitely.</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setShowAddForm(false); setError(null); setRecurrenceType("NONE"); }}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
              <button type="submit" disabled={pending}
                className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors">
                {pending ? "Adding…" : "Add Event"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Legend
        </p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(EVENT_TYPE_COLORS) as CalendarEventType[]).map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span
                className={`w-3 h-3 rounded-full ${EVENT_TYPE_COLORS[type]}`}
              />
              <span className="text-xs text-gray-600">
                {EVENT_TYPE_LABELS[type]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
