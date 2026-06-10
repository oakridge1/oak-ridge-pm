"use client";

import { useState, useEffect, useTransition } from "react";
import { X, Trash2, Users } from "lucide-react";
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getActiveUsers,
  getActiveJobs,
} from "@/app/(app)/schedule/actions";

type User = { id: string; name: string | null; role: string };
type Job  = { id: string; jobName: string; jobNumber: string };

interface ExistingSchedule {
  id:        string;
  date:      string;
  startTime: string | null;
  endTime:   string | null;
  notes:     string | null;
  assignees: { id: string; name: string }[];
}

interface ScheduleModalProps {
  /** Required when editing; omit when creating from WeekBanner to show a job picker. */
  jobId?:    string;
  jobName?:  string;
  /** Pass from parent to avoid a refetch; omit to fetch internally. */
  users?:    User[];
  /** Pre-fill date */
  date?:     string;
  /** Populated when editing an existing schedule */
  schedule?: ExistingSchedule;
  onClose:   () => void;
  /** Called after a successful save instead of onClose; if omitted, onClose is called. */
  onSaved?:  () => void;
}

export function ScheduleModal({
  jobId:   propJobId,
  jobName: propJobName,
  users:   propUsers,
  date,
  schedule,
  onClose,
  onSaved,
}: ScheduleModalProps) {
  const isEdit = !!schedule;

  // Form fields
  const [dateVal, setDate]            = useState(schedule?.date      ?? date ?? "");
  const [startTime, setStartTime]     = useState(schedule?.startTime ?? "");
  const [endTime, setEndTime]         = useState(schedule?.endTime   ?? "");
  const [notes, setNotes]             = useState(schedule?.notes     ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(schedule?.assignees.map((a) => a.id) ?? [])
  );

  // Job picker — only used when no jobId was provided (creating from WeekBanner)
  const needsJobPicker = !propJobId && !isEdit;
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [pickedJobId, setPickedJobId] = useState("");
  const [pickedJobName, setPickedJobName] = useState("");

  // Users — use passed list or fetch internally
  const [users, setUsers] = useState<User[]>(propUsers ?? []);

  const [error, setError]          = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete]    = useTransition();

  // Fetch jobs for the picker when needed
  useEffect(() => {
    if (!needsJobPicker) return;
    getActiveJobs().then(setJobs).catch(console.error);
  }, [needsJobPicker]);

  // Fetch users when not provided by the parent
  useEffect(() => {
    if (propUsers) return;
    getActiveUsers().then(setUsers).catch(console.error);
  }, [propUsers]);

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const effectiveJobId   = propJobId   ?? pickedJobId;
  const effectiveJobName = propJobName ?? pickedJobName;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateVal)         { setError("Date is required.");        return; }
    if (!effectiveJobId)  { setError("Please select a job.");     return; }
    setError(null);

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateSchedule(schedule!.id, {
            date:      dateVal,
            startTime: startTime,
            endTime:   endTime,
            notes:     notes,
            userIds:   [...selectedIds],
          });
        } else {
          await createSchedule({
            jobId:     effectiveJobId,
            date:      dateVal,
            startTime: startTime || "",
            endTime:   endTime   || "",
            notes:     notes     || "",
            userIds:   [...selectedIds],
          });
        }
        // onSaved takes priority; fall back to onClose
        if (onSaved) {
          onSaved();
        } else {
          onClose();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save schedule.");
      }
    });
  }

  function handleDelete() {
    if (!isEdit) return;
    startDelete(async () => {
      try {
        await deleteSchedule(schedule!.id);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? "Edit Schedule" : "Schedule Crew"}
            </h2>
            {effectiveJobName && (
              <p className="text-xs text-gray-400 mt-0.5">{effectiveJobName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form id="schedule-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          {/* Job picker — shown when no jobId was pre-set */}
          {needsJobPicker && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Job <span className="text-red-500">*</span>
              </label>
              <select
                value={pickedJobId}
                onChange={(e) => {
                  const selected = jobs.find((j) => j.id === e.target.value);
                  setPickedJobId(selected?.id ?? "");
                  setPickedJobName(selected ? `${selected.jobNumber} — ${selected.jobName}` : "");
                }}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              >
                <option value="">Select a job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} — {j.jobName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={dateVal}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
            />
          </div>

          {/* Team members */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-gray-500" />
              <label className="text-xs font-medium text-gray-600">Assign Team Members</label>
            </div>

            {users.length === 0 ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
                {users.map((u) => {
                  const checked = selectedIds.has(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleUser(u.id)}
                        className="rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                      />
                      <span className="text-sm text-gray-800">{u.name ?? u.id}</span>
                      <span className="ml-auto text-[10px] text-gray-400 uppercase tracking-wide">
                        {u.role}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-gray-100 flex items-center gap-3">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 disabled:opacity-60 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="schedule-form"
            disabled={pending}
            className="bg-[#1e3a8a] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
          >
            {pending ? "Saving…" : isEdit ? "Save Changes" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
