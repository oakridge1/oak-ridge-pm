"use client";

import { useState, useTransition } from "react";
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Users,
} from "lucide-react";
import {
  addLaborEntries,
  updateLaborEntry,
  deleteLaborEntry,
  type DuplicateLaborEntry,
} from "./labor-tab-actions";
import type { Role } from "@/app/generated/prisma/client";
import { parseLocalDate } from "@/lib/dateUtils";

type LaborEntry = {
  id: string;
  date: Date;
  hours: number;
  submittedByName: string | null;
  user: { id: string; name: string | null };
};

type CrewMember = { id: string; name: string | null; role: Role };

interface LaborTabProps {
  job: {
    id: string;
    laborBudgetHours: number | null;
    laborEntries: LaborEntry[];
  };
  role: Role;
  fieldUsers: CrewMember[];
  currentUserId: string;
}

function fmtDate(d: Date | string) {
  return parseLocalDate(d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toDateInput(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

function EditableRow({
  entry,
  jobId,
  role,
}: {
  entry: LaborEntry;
  jobId: string;
  role: Role;
}) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(entry.hours));
  const [date, setDate] = useState(toDateInput(entry.date));
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    startTransition(async () => {
      await updateLaborEntry(entry.id, jobId, parseFloat(hours), date);
      setEditing(false);
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    startTransition(() => deleteLaborEntry(entry.id, jobId));
  }

  return (
    <div className={`flex items-center gap-3 py-2.5 border-b last:border-b-0 border-gray-100 ${pending ? "opacity-50" : ""}`}>
      {editing ? (
        <>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-[#002D72]"
          />
          <span className="text-sm text-gray-700 flex-1">{entry.user.name ?? "—"}</span>
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            step="0.25"
            min="0"
            className="border border-gray-300 rounded px-2 py-1 text-xs w-20 text-right focus:outline-none focus:ring-1 focus:ring-[#002D72]"
          />
          <span className="text-xs text-gray-400">hrs</span>
          <button onClick={handleSave} className="p-1 text-green-600 hover:bg-green-50 rounded">
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => setEditing(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">{entry.user.name ?? "—"}</span>
            {entry.submittedByName && entry.submittedByName !== entry.user.name && (
              <span className="text-xs text-gray-400 ml-2">via {entry.submittedByName}</span>
            )}
          </div>
          <span className="text-sm text-gray-600 tabular-nums">{entry.hours} hrs</span>
          {role === "ADMIN" && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="p-1 text-gray-400 hover:text-[#002D72] hover:bg-gray-100 rounded"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                onBlur={() => setConfirmDelete(false)}
                className={`p-1 rounded text-xs ${confirmDelete ? "bg-red-600 text-white px-2" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}
              >
                {confirmDelete ? "Confirm?" : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function LaborTab({ job, role, fieldUsers, currentUserId }: LaborTabProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [sharedHours, setSharedHours] = useState("8");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [individualMode, setIndividualMode] = useState(false);
  const [individualHours, setIndividualHours] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [duplicates, setDuplicates] = useState<DuplicateLaborEntry[] | null>(null);
  const [pendingEntries, setPendingEntries] = useState<{ userId: string; hours: number }[] | null>(null);

  // Normalize dates
  const entries = job.laborEntries.map((e) => ({ ...e, date: new Date(e.date) }));

  // Group by date
  const grouped = entries.reduce<Record<string, LaborEntry[]>>((acc, e) => {
    const key = e.date.toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const budget = job.laborBudgetHours;
  const remaining = budget != null ? budget - totalHours : null;

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function buildEntries() {
    return Array.from(selectedIds).map((userId) => {
      const h = individualMode ? parseFloat(individualHours[userId] || "0") : parseFloat(sharedHours);
      if (isNaN(h) || h <= 0) return null;
      return { userId, hours: h };
    }).filter(Boolean) as { userId: string; hours: number }[];
  }

  function handleSubmit() {
    setError(null);
    if (!selectedIds.size) { setError("Select at least one crew member."); return; }
    if (!date) { setError("Date is required."); return; }

    const entriesToSubmit = buildEntries();
    if (!entriesToSubmit.length) { setError("Hours must be greater than 0."); return; }

    startTransition(async () => {
      try {
        const result = await addLaborEntries(job.id, date, entriesToSubmit, "check");
        if (result?.duplicates && result.duplicates.length > 0) {
          setDuplicates(result.duplicates);
          setPendingEntries(entriesToSubmit);
          return;
        }
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  function resetForm() {
    setSelectedIds(new Set());
    setIndividualHours({});
    setShowForm(false);
    setDuplicates(null);
    setPendingEntries(null);
  }

  function handleDuplicateChoice(mode: "add" | "replace") {
    if (!pendingEntries) return;
    startTransition(async () => {
      try {
        await addLaborEntries(job.id, date, pendingEntries, mode);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
        setDuplicates(null);
        setPendingEntries(null);
      }
    });
  }

  return (
    <div className="p-5">
      {/* Duplicate Labor Warning Modal */}
      {duplicates && duplicates.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#002D72] text-base mb-2">Duplicate Hours Detected</h3>
            <p className="text-sm text-gray-600 mb-4">
              The following crew members already have hours logged for this date:
            </p>
            <ul className="mb-4 space-y-1">
              {duplicates.map((d) => (
                <li key={d.userId} className="text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <span className="font-medium">{d.userName}</span>
                  <span className="text-gray-500"> — {d.existingHours} hrs already logged</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleDuplicateChoice("add")}
                disabled={pending}
                className="w-full bg-[#002D72] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-900 disabled:opacity-60 transition-colors"
              >
                Add Hours (keep both)
              </button>
              <button
                onClick={() => handleDuplicateChoice("replace")}
                disabled={pending}
                className="w-full bg-[#FF5910] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                Replace Existing Hours
              </button>
              <button
                onClick={() => { setDuplicates(null); setPendingEntries(null); }}
                className="w-full border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Totals bar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Total Logged</p>
          <p className="text-xl font-bold text-[#002D72]">{totalHours.toFixed(1)} <span className="text-sm font-normal text-gray-500">hrs</span></p>
        </div>
        {(role === "ADMIN" || role === "OFFICE") && budget != null && (
          <>
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex-1 min-w-[120px]">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Budget</p>
              <p className="text-xl font-bold text-gray-700">{budget} <span className="text-sm font-normal text-gray-500">hrs</span></p>
            </div>
            <div className={`rounded-xl px-4 py-3 flex-1 min-w-[120px] ${remaining != null && remaining < 0 ? "bg-red-50" : "bg-gray-50"}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Remaining</p>
              <p className={`text-xl font-bold ${remaining != null && remaining < 0 ? "text-red-600" : "text-green-700"}`}>
                {remaining != null ? remaining.toFixed(1) : "—"} <span className="text-sm font-normal text-gray-500">hrs</span>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Add entry form */}
      {showForm ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#002D72]" />
              Log Hours
            </h3>
            <button onClick={() => { setShowForm(false); setError(null); }} className="p-1 text-gray-400 hover:text-gray-700">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1.5 rounded">{error}</p>
          )}

          {/* Date + shared hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
            </div>
            {!individualMode && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hours (all)</label>
                <input
                  type="number"
                  value={sharedHours}
                  onChange={(e) => setSharedHours(e.target.value)}
                  step="0.25"
                  min="0"
                  placeholder="8"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                />
              </div>
            )}
          </div>

          {/* Individual hours toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndividualMode((v) => !v)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                individualMode
                  ? "bg-[#002D72] text-white border-[#002D72]"
                  : "text-gray-500 border-gray-300 hover:border-gray-400"
              }`}
            >
              Individual hours
            </button>
            <span className="text-xs text-gray-400">Toggle to enter different hours per person</span>
          </div>

          {/* Crew checklist */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Select Crew <span className="text-red-500">*</span>
            </label>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {fieldUsers.map((u) => {
                const checked = selectedIds.has(u.id);
                return (
                  <label
                    key={u.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                      checked ? "bg-[#002D72]/10 border border-[#002D72]/20" : "bg-white border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(u.id)}
                      className="w-4 h-4 accent-[#002D72] shrink-0"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-900">{u.name ?? u.id}</span>
                    <span className="text-xs text-gray-400">{u.role}</span>
                    {individualMode && checked && (
                      <input
                        type="number"
                        value={individualHours[u.id] ?? sharedHours}
                        onChange={(e) =>
                          setIndividualHours((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        step="0.25"
                        min="0"
                        onClick={(e) => e.preventDefault()}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#002D72]"
                      />
                    )}
                    {individualMode && checked && (
                      <span className="text-xs text-gray-400">hrs</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-400">{selectedIds.size} selected</span>
            <button
              onClick={handleSubmit}
              disabled={pending}
              className="bg-[#002D72] text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
            >
              {pending ? "Saving…" : "Log Hours"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 text-sm text-[#002D72] hover:text-[#003d99] font-medium transition-colors mb-6"
        >
          <Plus className="w-4 h-4" />
          Log Hours
        </button>
      )}

      {/* Log */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No hours logged yet.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((dateKey) => {
            const dayEntries = grouped[dateKey];
            const dayTotal = dayEntries.reduce((s, e) => s + e.hours, 0);
            return (
              <div key={dateKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">
                    {fmtDate(dayEntries[0].date)}
                  </span>
                  <span className="text-xs text-gray-500 font-medium tabular-nums">
                    {dayTotal.toFixed(1)} hrs total
                  </span>
                </div>
                <div className="px-4">
                  {dayEntries.map((entry) => (
                    <EditableRow key={entry.id} entry={entry} jobId={job.id} role={role} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
