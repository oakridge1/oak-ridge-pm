"use client";

import { useState, useTransition, useRef } from "react";
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  RotateCcw,
  User,
  Clock,
  ArrowRight,
  BookMarked,
  ClipboardList,
  FileDown,
  ChevronDown,
  ChevronUp,
  FilePlus,
} from "lucide-react";
import {
  addNote,
  addJobTask,
  completeTask,
  reopenTask,
  applySavedTaskToJob,
  deleteTask,
  createChangeOrder,
  updateChangeOrder,
  deleteChangeOrder,
} from "./notes-tasks-tab-actions";
import type { Role } from "@/app/generated/prisma/client";
import { parseLocalDate } from "@/lib/dateUtils";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  savedTaskId: string | null;
  assignee: { id: string; name: string | null } | null;
  creator: { name: string | null };
  ballInCourt: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  savedTask: { title: string; sortOrder: number } | null;
};

type Note = {
  id: string;
  content: string;
  createdAt: Date;
  user: { name: string | null; image: string | null };
};

type ChangeOrder = {
  id: string;
  coNumber: number | null;
  date: Date | string | null;
  description: string;
  location: string | null;
  reason: string | null;
  requestedByName: string | null;
  requestedBy: { name: string | null };
  estimatedHours: number | null;
  estimatedLaborCost: number | null;
  estimatedMaterials: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  adminNotes: string | null;
  approvedValue: number | null;
  createdAt: Date | string;
};

type SavedTaskTemplate = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

type FieldUser = { id: string; name: string | null; role: Role };

interface NotesTasksTabProps {
  job: {
    id: string;
    tasks: Task[];
    notes: Note[];
    changeOrders: ChangeOrder[];
  };
  role: Role;
  currentUserId: string;
  currentUserName: string;
  fieldUsers: FieldUser[];
  savedTasks: SavedTaskTemplate[];
}

type TaskSubTab = "saved" | "job";

const STATUS_STYLES: Record<string, { badge: string; text: string }> = {
  PENDING: { badge: "bg-amber-100 text-amber-700", text: "Pending" },
  APPROVED: { badge: "bg-green-100 text-green-700", text: "Approved" },
  REJECTED: { badge: "bg-red-100 text-red-700", text: "Rejected" },
};

const fmt$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return parseLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Task components ───────────────────────────────────────────────────────────

function parseBallInCourt(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    // Legacy plain-text value — return as single item
    return [raw];
  }
  return [];
}

function TaskRow({
  task,
  role,
  jobId,
  fieldUsers,
}: {
  task: Task;
  role: Role;
  jobId: string;
  fieldUsers: FieldUser[];
}) {
  const [pending, startTransition] = useTransition();
  const isDone = task.status === "COMPLETED";

  return (
    <div
      className={`flex items-start gap-3 py-3 border-b last:border-b-0 border-gray-100 ${
        isDone ? "opacity-60" : ""
      } ${pending ? "opacity-50 pointer-events-none" : ""}`}
    >
      <button
        onClick={() =>
          startTransition(async () => {
            if (isDone) {
              if (role === "ADMIN" || role === "OFFICE")
                await reopenTask(task.id);
            } else {
              await completeTask(task.id);
            }
          })
        }
        className="mt-0.5 shrink-0 text-gray-400 hover:text-[#1e3a8a] transition-colors"
        title={isDone ? "Reopen task" : "Mark complete"}
      >
        {isDone ? (
          <CheckSquare className="w-5 h-5 text-green-600" />
        ) : (
          <Square className="w-5 h-5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium text-gray-900 ${
            isDone ? "line-through text-gray-400" : ""
          }`}
        >
          {task.title}
        </p>
        {task.description && !isDone && (
          <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {task.assignee?.name && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <User className="w-3 h-3" />
              {task.assignee.name}
            </span>
          )}
          {parseBallInCourt(task.ballInCourt).map((id) => {
            const u = fieldUsers.find((f) => f.id === id);
            const label = u?.name ?? id;
            return (
              <span key={id} className="flex items-center gap-1 text-xs text-[#FF5910] font-medium bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                <ArrowRight className="w-3 h-3" />
                {label}
              </span>
            );
          })}
          {task.dueDate && !isDone && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              Due {parseLocalDate(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {isDone && task.completedBy && (
            <span className="text-xs text-green-600">
              Completed by {task.completedBy}
              {task.completedAt
                ? ` on ${new Date(task.completedAt).toLocaleDateString()}`
                : ""}
            </span>
          )}
        </div>
      </div>

      {role === "ADMIN" && (
        <button
          onClick={() => startTransition(() => deleteTask(task.id))}
          className="shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function AddJobTaskForm({
  jobId,
  fieldUsers,
  onDone,
}: {
  jobId: string;
  fieldUsers: FieldUser[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await addJobTask(jobId, fd);
        formRef.current?.reset();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add task.");
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-3 space-y-3"
    >
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
          {error}
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Task Title <span className="text-red-500">*</span>
        </label>
        <input
          name="title"
          required
          placeholder="Describe the task…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Assignee
          </label>
          <select
            name="assigneeId"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          >
            <option value="">— None —</option>
            {fieldUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.id}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Due Date
          </label>
          <input
            name="dueDate"
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Ball in Court
        </label>
        <div className="border border-gray-300 rounded-lg px-3 py-2 bg-white space-y-1.5 max-h-36 overflow-y-auto">
          {fieldUsers.map((u) => (
            <label key={u.id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="ballInCourt"
                value={u.id}
                className="rounded border-gray-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
              />
              <span className="text-sm text-gray-700">{u.name ?? u.id}</span>
            </label>
          ))}
          {fieldUsers.length === 0 && (
            <p className="text-xs text-gray-400">No active users</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-[#1e3a8a] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
        >
          {pending ? "Adding…" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

// ── Change Order components ───────────────────────────────────────────────────

function AddChangeOrderForm({
  jobId,
  currentUserName,
  onDone,
}: {
  jobId: string;
  currentUserName: string;
  onDone: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [requestedByName, setRequestedByName] = useState(currentUserName);
  const [estimatedHours, setEstimatedHours] = useState("");
  const [estimatedLaborCost, setEstimatedLaborCost] = useState("");
  const [estimatedMaterials, setEstimatedMaterials] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const estimatedTotal =
    (parseFloat(estimatedLaborCost) || 0) + (parseFloat(estimatedMaterials) || 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createChangeOrder(jobId, {
          description,
          date: date || null,
          location: location || null,
          reason: reason || null,
          requestedByName: requestedByName || null,
          estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
          estimatedLaborCost: estimatedLaborCost ? parseFloat(estimatedLaborCost) : null,
          estimatedMaterials: estimatedMaterials ? parseFloat(estimatedMaterials) : null,
        });
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit change order.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-orange-50 border border-[#FF5910]/20 rounded-xl p-4 mt-3 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#FF5910] flex items-center gap-2">
          <FilePlus className="w-4 h-4" /> New Change Order
        </h3>
        <button type="button" onClick={onDone} className="text-sm text-gray-400 hover:text-gray-700">
          Cancel
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded">
          {error}
        </p>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Describe the extra work requested…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910] resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Requested By</label>
          <input
            type="text"
            value={requestedByName}
            onChange={(e) => setRequestedByName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Area or room"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this needed?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Est. Hours</label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Est. Labor Cost</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={estimatedLaborCost}
            onChange={(e) => setEstimatedLaborCost(e.target.value)}
            placeholder="$0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Est. Materials</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={estimatedMaterials}
            onChange={(e) => setEstimatedMaterials(e.target.value)}
            placeholder="$0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5910]"
          />
        </div>
      </div>

      {estimatedTotal > 0 && (
        <p className="text-sm font-semibold text-gray-700">
          Estimated Total: <span className="text-[#FF5910]">{fmt$(estimatedTotal)}</span>
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !description.trim()}
          className="flex items-center gap-1.5 bg-[#FF5910] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          <FilePlus className="w-3.5 h-3.5" />
          {pending ? "Submitting…" : "Submit Change Order"}
        </button>
      </div>
    </form>
  );
}

function ChangeOrderCard({
  co,
  jobId,
  role,
}: {
  co: ChangeOrder;
  jobId: string;
  role: Role;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reviewStatus, setReviewStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">(co.status);
  const [approvedValue, setApprovedValue] = useState(co.approvedValue != null ? String(co.approvedValue) : "");
  const [adminNotes, setAdminNotes] = useState(co.adminNotes ?? "");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const statusStyle = STATUS_STYLES[co.status] ?? { badge: "bg-gray-100 text-gray-600", text: co.status };
  const estimatedTotal = (co.estimatedLaborCost ?? 0) + (co.estimatedMaterials ?? 0);

  function handleSaveReview() {
    setReviewError(null);
    startTransition(async () => {
      try {
        await updateChangeOrder(co.id, {
          status: reviewStatus,
          approvedValue: approvedValue ? parseFloat(approvedValue) : null,
          adminNotes: adminNotes || null,
        });
      } catch (err) {
        setReviewError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); setDeleteError(null); return; }
    startTransition(async () => {
      try {
        await deleteChangeOrder(co.id);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Delete failed.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <div className={`border rounded-xl mb-3 overflow-hidden ${pending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        {/* CO number badge */}
        <div className="w-8 h-8 rounded-full bg-[#1e3a8a] text-white flex items-center justify-center text-xs font-bold shrink-0">
          {co.coNumber ?? "?"}
        </div>

        {/* Status badge */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${statusStyle.badge}`}>
          {statusStyle.text}
        </span>

        {/* Description */}
        <span className="flex-1 text-sm text-gray-800 font-medium truncate">
          {co.description}
        </span>

        {/* Date */}
        <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
          {fmtDate(co.date ?? co.createdAt)}
        </span>

        {/* Estimated total */}
        {estimatedTotal > 0 && (
          <span className="text-xs font-medium text-gray-600 shrink-0">
            {fmt$(estimatedTotal)}
          </span>
        )}

        {/* PDF download */}
        <a
          href={`/api/jobs/${jobId}/pdf/co/${co.id}`}
          download
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 p-1 text-gray-400 hover:text-[#1e3a8a] hover:bg-blue-50 rounded transition-colors"
          title="Download CO PDF"
        >
          <FileDown className="w-4 h-4" />
        </a>

        {/* Chevron */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-4">
          {/* Details grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-4 text-sm">
            {co.requestedByName && (
              <div>
                <p className="text-xs text-gray-400">Requested By</p>
                <p className="font-medium text-gray-800">{co.requestedByName}</p>
              </div>
            )}
            {co.date && (
              <div>
                <p className="text-xs text-gray-400">Date</p>
                <p className="font-medium text-gray-800">{fmtDate(co.date)}</p>
              </div>
            )}
            {co.location && (
              <div>
                <p className="text-xs text-gray-400">Location</p>
                <p className="font-medium text-gray-800">{co.location}</p>
              </div>
            )}
            {co.reason && (
              <div>
                <p className="text-xs text-gray-400">Reason</p>
                <p className="font-medium text-gray-800">{co.reason}</p>
              </div>
            )}
            {co.estimatedHours != null && (
              <div>
                <p className="text-xs text-gray-400">Est. Hours</p>
                <p className="font-medium text-gray-800">{co.estimatedHours}</p>
              </div>
            )}
            {co.estimatedLaborCost != null && (
              <div>
                <p className="text-xs text-gray-400">Est. Labor Cost</p>
                <p className="font-medium text-gray-800">{fmt$(co.estimatedLaborCost)}</p>
              </div>
            )}
            {co.estimatedMaterials != null && (
              <div>
                <p className="text-xs text-gray-400">Est. Materials</p>
                <p className="font-medium text-gray-800">{fmt$(co.estimatedMaterials)}</p>
              </div>
            )}
            {estimatedTotal > 0 && (
              <div>
                <p className="text-xs text-gray-400">Est. Total</p>
                <p className="font-bold text-gray-900">{fmt$(estimatedTotal)}</p>
              </div>
            )}
            {co.status === "APPROVED" && co.approvedValue != null && (
              <div>
                <p className="text-xs text-gray-400">Approved Value</p>
                <p className="font-bold text-green-700">{fmt$(co.approvedValue)}</p>
              </div>
            )}
          </div>

          {co.adminNotes && co.status !== "PENDING" && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Admin Notes</p>
              <p className="text-sm text-gray-700">{co.adminNotes}</p>
            </div>
          )}

          {/* Admin review panel */}
          {role === "ADMIN" && (
            <div className="border border-[#1e3a8a]/20 rounded-lg p-3 bg-blue-50 space-y-3">
              <p className="text-xs font-semibold text-[#1e3a8a]">Admin Review</p>
              {reviewError && (
                <p className="text-xs text-red-600">{reviewError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value as "PENDING" | "APPROVED" | "REJECTED")}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Approved Value ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={approvedValue}
                    onChange={(e) => setApprovedValue(e.target.value)}
                    placeholder="0.00"
                    disabled={reviewStatus !== "APPROVED"}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional notes…"
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] resize-none"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
                  <button
                    type="button"
                    onClick={handleDelete}
                    onBlur={() => setConfirmDelete(false)}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      confirmDelete ? "bg-red-600 text-white" : "text-red-500 hover:bg-red-50"
                    }`}
                  >
                    {confirmDelete ? "Confirm delete?" : "Delete CO"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleSaveReview}
                  disabled={pending}
                  className="bg-[#1e3a8a] text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
                >
                  {pending ? "Saving…" : "Save Review"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotesTasksTab({
  job,
  role,
  currentUserId,
  currentUserName,
  fieldUsers,
  savedTasks,
}: NotesTasksTabProps) {
  const [taskSubTab, setTaskSubTab] = useState<TaskSubTab>("saved");
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddCO, setShowAddCO] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notePending, startNoteTransition] = useTransition();
  const [noteError, setNoteError] = useState<string | null>(null);
  const [applyPending, startApplyTransition] = useTransition();

  const savedTaskInstances = job.tasks.filter((t) => t.savedTaskId !== null);
  const jobTaskInstances = job.tasks.filter((t) => t.savedTaskId === null);

  const appliedTemplateIds = new Set(savedTaskInstances.map((t) => t.savedTaskId));
  const unappliedTemplates = savedTasks.filter(
    (st) => !appliedTemplateIds.has(st.id)
  );

  const pendingCOs = job.changeOrders.filter((co) => co.status === "PENDING");

  function handleNoteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNoteError(null);
    startNoteTransition(async () => {
      try {
        await addNote(job.id, noteText);
        setNoteText("");
      } catch (err) {
        setNoteError(err instanceof Error ? err.message : "Failed to add note.");
      }
    });
  }

  return (
    <div className="p-5 space-y-8">
      {/* ── SECTION A: TASKS ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-[#1e3a8a]" />
            Tasks
          </h2>
        </div>

        {/* Sub-tab bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => setTaskSubTab("saved")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              taskSubTab === "saved"
                ? "text-[#1e3a8a] border-[#1e3a8a]"
                : "text-gray-500 border-transparent hover:text-gray-900"
            }`}
          >
            <BookMarked className="w-4 h-4" />
            Saved Tasks
            <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {savedTaskInstances.length}
            </span>
          </button>
          <button
            onClick={() => setTaskSubTab("job")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              taskSubTab === "job"
                ? "text-[#1e3a8a] border-[#1e3a8a]"
                : "text-gray-500 border-transparent hover:text-gray-900"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            Job Tasks
            <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
              {jobTaskInstances.length}
            </span>
          </button>
        </div>

        {/* Saved Tasks panel */}
        {taskSubTab === "saved" && (
          <div>
            {savedTaskInstances.length === 0 && unappliedTemplates.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">
                No saved task templates exist yet.{" "}
                {role === "ADMIN" && (
                  <a href="/admin/saved-tasks" className="text-[#1e3a8a] underline">
                    Add templates in Admin.
                  </a>
                )}
              </p>
            )}
            {savedTaskInstances.map((task) => (
              <TaskRow key={task.id} task={task} role={role} jobId={job.id} fieldUsers={fieldUsers} />
            ))}

            {/* Apply unapplied templates */}
            {(role === "ADMIN" || role === "OFFICE") &&
              unappliedTemplates.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                  <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
                    Available templates — click to apply
                  </p>
                  <div className="space-y-1.5">
                    {unappliedTemplates.map((st) => (
                      <button
                        key={st.id}
                        onClick={() =>
                          startApplyTransition(() =>
                            applySavedTaskToJob(job.id, st.id)
                          )
                        }
                        disabled={applyPending}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-[#1e3a8a] hover:text-[#1e3a8a] hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        {st.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Job Tasks panel */}
        {taskSubTab === "job" && (
          <div>
            {jobTaskInstances.length === 0 && !showAddTask && (
              <p className="text-sm text-gray-400 text-center py-4">
                No job tasks yet.
              </p>
            )}
            {jobTaskInstances.map((task) => (
              <TaskRow key={task.id} task={task} role={role} jobId={job.id} fieldUsers={fieldUsers} />
            ))}
            {showAddTask ? (
              <AddJobTaskForm
                jobId={job.id}
                fieldUsers={fieldUsers}
                onDone={() => setShowAddTask(false)}
              />
            ) : (
              <button
                onClick={() => setShowAddTask(true)}
                className="mt-3 flex items-center gap-1.5 text-sm text-[#1e3a8a] hover:text-[#003d99] font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── SECTION B: NOTES ── */}
      <section>
        <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <svg
            className="w-4 h-4 text-[#1e3a8a]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h6m-6 4h8M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"
            />
          </svg>
          Notes
        </h2>

        {/* Add note form */}
        <form onSubmit={handleNoteSubmit} className="mb-6">
          {noteError && (
            <p className="text-xs text-red-600 mb-1">{noteError}</p>
          )}
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={notePending || !noteText.trim()}
              className="bg-[#1e3a8a] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
            >
              {notePending ? "Posting…" : "Post Note"}
            </button>
          </div>
        </form>

        {/* Note feed */}
        <div className="space-y-4">
          {job.notes.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No notes yet.
            </p>
          )}
          {job.notes.map((note) => (
            <div key={note.id} className="flex gap-3">
              {note.user.image ? (
                <img
                  src={note.user.image}
                  alt={note.user.name ?? ""}
                  className="w-8 h-8 rounded-full shrink-0 border border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(note.user.name ?? "?").slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">
                    {note.user.name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(note.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION C: CHANGE ORDERS ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <FilePlus className="w-4 h-4 text-[#FF5910]" />
            Change Orders
            {job.changeOrders.length > 0 && (
              <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full font-medium">
                {job.changeOrders.length}
              </span>
            )}
            {pendingCOs.length > 0 && role === "ADMIN" && (
              <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full font-medium">
                {pendingCOs.length} pending
              </span>
            )}
          </h2>
          {!showAddCO && (
            <button
              onClick={() => setShowAddCO(true)}
              className="flex items-center gap-1.5 text-sm text-[#FF5910] hover:text-orange-600 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New CO
            </button>
          )}
        </div>

        {showAddCO && (
          <AddChangeOrderForm
            jobId={job.id}
            currentUserName={currentUserName}
            onDone={() => setShowAddCO(false)}
          />
        )}

        {job.changeOrders.length === 0 && !showAddCO && (
          <p className="text-sm text-gray-400 text-center py-6">
            No change orders yet.
          </p>
        )}

        {job.changeOrders.map((co) => (
          <ChangeOrderCard key={co.id} co={co} jobId={job.id} role={role} />
        ))}
      </section>
    </div>
  );
}
