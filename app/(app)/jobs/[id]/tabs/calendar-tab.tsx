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
import { submitCalendarRequest, reviewCalendarRequest } from "./calendar-request-actions";
import type { Role, CalendarEventType, CalendarRequestStatus, InspectionType, InspectionResult } from "@/app/generated/prisma/client";
import { parseLocalDate } from "@/lib/dateUtils";

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

type JobInspection = {
  id: string;
  dateScheduled: Date | null;
  type: InspectionType;
  result: InspectionResult | null;
  notes: string | null;
};

type AllJobEvent = CalEvent & {
  job: { id: string; jobName: string; jobNumber: string; calendarColor: string | null } | null;
};

type CalendarRequest = {
  id: string;
  date: Date;
  timeOfDay: string | null;
  description: string;
  reason: string | null;
  status: CalendarRequestStatus;
  requestedBy: { name: string | null; email: string };
  createdAt: Date;
};

interface CalendarTabProps {
  job: {
    id: string;
    jobNumber: string;
    foremanId?: string | null;
    completionDate: Date | null;
    calendarEvents: CalEvent[];
    calendarRequests?: CalendarRequest[];
    tasks: Task[];
    inspections?: JobInspection[];
  };
  role: Role;
  currentUserId: string;
  allCalendarEvents?: AllJobEvent[];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  MILESTONE:   "bg-purple-500",
  TASK_DUE:    "bg-orange-400",
  COMPLETION:  "bg-blue-500",
  DAY_OFF:     "bg-red-400",
  CUSTOM:      "bg-gray-500",
  INSPECTION:  "bg-amber-500",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  MILESTONE:   "Milestone",
  TASK_DUE:    "Task Due",
  COMPLETION:  "Completion",
  DAY_OFF:     "Day Off",
  CUSTOM:      "Custom",
  INSPECTION:  "Inspection",
};

const INSP_TYPE_LABELS: Record<string, string> = {
  UNDERGROUND: "Underground",
  ROUGH_IN:    "Rough-In",
  SERVICE:     "Service",
  FIRE_ALARM:  "Fire Alarm",
  SPECIAL:     "Special",
  FINAL:       "Final",
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
  id: string; type: CalendarEventType | 'INSPECTION'; title: string; date: Date;
  note: string | null; user: { name: string | null } | null;
  isAuto: boolean; sourceId: string; colorClass?: string;
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
  month: number,
  inspections: JobInspection[] = []
): DisplayEvent[] {
  const normalized = calendarEvents.map((e) => ({ ...e, date: parseLocalDate(e.date), recurrenceEndDate: e.recurrenceEndDate ? parseLocalDate(e.recurrenceEndDate) : null }));
  const events: DisplayEvent[] = normalized.flatMap((e) => expandEvent(e, year, month));

  if (completionDate) {
    const cd = parseLocalDate(completionDate);
    if (cd.getFullYear() === year && cd.getMonth() === month) {
      events.push({ id: "__completion", type: "COMPLETION", title: "Project Completion",
        date: cd, note: null, user: null, isAuto: true, sourceId: "__completion" });
    }
  }

  tasks.filter((t) => t.dueDate && t.status !== "COMPLETED").forEach((t) => {
    const dd = parseLocalDate(t.dueDate!);
    if (dd.getFullYear() === year && dd.getMonth() === month) {
      events.push({ id: `__task_${t.id}`, type: "TASK_DUE", title: t.title,
        date: dd, note: null, user: null, isAuto: true, sourceId: `__task_${t.id}` });
    }
  });

  inspections.filter((i) => i.dateScheduled).forEach((i) => {
    const d = parseLocalDate(i.dateScheduled!);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const colorClass = i.result === "FAIL" ? "bg-red-500"
                       : i.result === "PASS" ? "bg-green-500"
                       : "bg-amber-500";
      events.push({
        id: `__insp_${i.id}`,
        type: "INSPECTION",
        title: `Inspection: ${INSP_TYPE_LABELS[i.type] ?? i.type}`,
        date: d,
        note: i.notes ?? null,
        user: null,
        isAuto: true,
        sourceId: `__insp_${i.id}`,
        colorClass,
      });
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
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [recurrenceType, setRecurrenceType] = useState("NONE");
  const [viewMode, setViewMode] = useState<"job" | "company">("job");
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const isTeammate = role === "TEAMMATE";
  const isForemanOnJob = role === "FOREMAN" && job.foremanId === currentUserId;
  const canReviewRequests = role === "ADMIN" || isForemanOnJob;
  const pendingRequests = (job.calendarRequests ?? []).filter((r) => r.status === "PENDING");

  // Build company-wide events by adapting AllJobEvent to CalEvent
  const companyCalEvents: CalEvent[] = allCalendarEvents.map((e) => ({
    ...e,
    title: e.job ? `${e.job.jobNumber} — ${e.title}` : e.title,
  }));

  const activeEvents = viewMode === "company" ? companyCalEvents : job.calendarEvents;
  const activeTasks = viewMode === "company" ? [] : job.tasks;
  const activeCompletionDate = viewMode === "company" ? null : job.completionDate;
  const activeInspections = viewMode === "company" ? [] : (job.inspections ?? []);

  const allEvents = buildAllEvents(activeEvents, activeTasks, activeCompletionDate, year, month, activeInspections);

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
                      ev.colorClass ?? EVENT_TYPE_COLORS[ev.type] ?? "bg-gray-400"
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
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ev.colorClass ?? EVENT_TYPE_COLORS[ev.type] ?? "bg-gray-400"}`}
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
                  {!ev.isAuto && (role === "ADMIN" || role === "FOREMAN") && (
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

      {/* Pending calendar requests — visible to ADMIN and assigned FOREMAN */}
      {canReviewRequests && pendingRequests.length > 0 && (
        <div className="mt-4 border border-amber-200 rounded-xl overflow-hidden">
          <div className="bg-amber-50 px-4 py-2 border-b border-amber-200">
            <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Pending Calendar Requests ({pendingRequests.length})
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingRequests.map((req) => (
              <div key={req.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {parseLocalDate(req.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      {req.timeOfDay && <span className="text-gray-500 ml-1">· {req.timeOfDay}</span>}
                    </p>
                    <p className="text-sm text-gray-700 mt-0.5">{req.description}</p>
                    {req.reason && <p className="text-xs text-gray-500 mt-0.5 italic">{req.reason}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Requested by {req.requestedBy.name ?? req.requestedBy.email}
                    </p>
                  </div>
                  {reviewingId === req.id ? (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => startTransition(async () => {
                          try { await reviewCalendarRequest(req.id, "APPROVED"); setReviewingId(null); }
                          catch { setReviewingId(null); }
                        })}
                        disabled={pending}
                        className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => startTransition(async () => {
                          try { await reviewCalendarRequest(req.id, "DENIED"); setReviewingId(null); }
                          catch { setReviewingId(null); }
                        })}
                        disabled={pending}
                        className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60"
                      >
                        ✗ Deny
                      </button>
                      <button
                        onClick={() => setReviewingId(null)}
                        className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewingId(req.id)}
                      className="text-xs px-3 py-1.5 border border-amber-300 text-amber-700 rounded-lg font-medium hover:bg-amber-100 shrink-0"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add event / Request event */}
      <div className="mt-4">
        {isTeammate ? (
          // TEAMMATE: request flow
          !showRequestForm ? (
            <button
              onClick={() => setShowRequestForm(true)}
              className="flex items-center gap-1.5 text-sm text-[#FF5910] hover:text-orange-600 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Request Calendar Event
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setRequestError(null);
                const fd = new FormData(e.currentTarget);
                const form = e.currentTarget;
                startTransition(async () => {
                  try {
                    await submitCalendarRequest(job.id, {
                      date: fd.get("date") as string,
                      timeOfDay: (fd.get("timeOfDay") as string | null) ?? undefined,
                      description: fd.get("description") as string,
                      reason: (fd.get("reason") as string | null) ?? undefined,
                    });
                    setShowRequestForm(false);
                    form.reset();
                  } catch (err) {
                    setRequestError(err instanceof Error ? err.message : "Failed to submit request.");
                  }
                });
              }}
              className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3"
            >
              <h4 className="text-sm font-semibold text-orange-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF5910]" />
                Request Calendar Event
              </h4>
              <p className="text-xs text-orange-700">Your request will be sent to your foreman and admin for approval.</p>
              {requestError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">{requestError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
                  <input name="date" type="date" required
                    defaultValue={selectedDay?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time (optional)</label>
                  <input name="timeOfDay" type="text" placeholder="e.g. 9:00 AM"
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                <input name="description" required placeholder="What is this event?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
                <input name="reason" placeholder="Why is this needed?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => { setShowRequestForm(false); setRequestError(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
                <button type="submit" disabled={pending}
                  className="bg-[#FF5910] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors">
                  {pending ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          )
        ) : (
          // ADMIN / FOREMAN / OFFICE: direct add flow
          !showAddForm ? (
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
                  defaultValue="MILESTONE"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                >
                  {(role === "ADMIN" || role === "FOREMAN") && (
                    <>
                      <option value="MILESTONE">Milestone</option>
                      <option value="CUSTOM">Custom</option>
                    </>
                  )}
                  <option value="TASK_DUE">Task Due</option>
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
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Legend
        </p>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(EVENT_TYPE_COLORS) as string[]).map((type) => (
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
