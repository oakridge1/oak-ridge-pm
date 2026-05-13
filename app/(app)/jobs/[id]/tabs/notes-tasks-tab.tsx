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
} from "lucide-react";
import {
  addNote,
  addJobTask,
  completeTask,
  reopenTask,
  applySavedTaskToJob,
  deleteTask,
} from "./notes-tasks-tab-actions";
import type { Role } from "@/app/generated/prisma/client";

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
  };
  role: Role;
  currentUserId: string;
  currentUserName: string;
  fieldUsers: FieldUser[];
  savedTasks: SavedTaskTemplate[];
}

type TaskSubTab = "saved" | "job";

function TaskRow({
  task,
  role,
  jobId,
}: {
  task: Task;
  role: Role;
  jobId: string;
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
        className="mt-0.5 shrink-0 text-gray-400 hover:text-[#002D72] transition-colors"
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
          {task.ballInCourt && (
            <span className="flex items-center gap-1 text-xs text-[#FF5910] font-medium">
              <ArrowRight className="w-3 h-3" />
              {task.ballInCourt}
            </span>
          )}
          {task.dueDate && !isDone && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              Due {new Date(task.dueDate).toLocaleDateString()}
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Assignee
          </label>
          <select
            name="assigneeId"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Ball in Court (who owns it now)
        </label>
        <input
          name="ballInCourt"
          placeholder="e.g. GC, Owner, Foreman…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#002D72]"
        />
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
          className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
        >
          {pending ? "Adding…" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

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
  const [noteText, setNoteText] = useState("");
  const [notePending, startNoteTransition] = useTransition();
  const [noteError, setNoteError] = useState<string | null>(null);
  const [applyPending, startApplyTransition] = useTransition();

  const savedTaskInstances = job.tasks.filter((t) => t.savedTaskId !== null);
  const jobTaskInstances = job.tasks.filter((t) => t.savedTaskId === null);

  // Templates not yet applied
  const appliedTemplateIds = new Set(savedTaskInstances.map((t) => t.savedTaskId));
  const unappliedTemplates = savedTasks.filter(
    (st) => !appliedTemplateIds.has(st.id)
  );

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
            <ClipboardList className="w-4 h-4 text-[#002D72]" />
            Tasks
          </h2>
        </div>

        {/* Sub-tab bar */}
        <div className="flex gap-1 mb-4 border-b border-gray-200">
          <button
            onClick={() => setTaskSubTab("saved")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              taskSubTab === "saved"
                ? "text-[#002D72] border-[#002D72]"
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
                ? "text-[#002D72] border-[#002D72]"
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
                  <a href="/admin/saved-tasks" className="text-[#002D72] underline">
                    Add templates in Admin.
                  </a>
                )}
              </p>
            )}
            {savedTaskInstances.map((task) => (
              <TaskRow key={task.id} task={task} role={role} jobId={job.id} />
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
                        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-[#002D72] hover:text-[#002D72] hover:bg-blue-50 transition-colors disabled:opacity-50"
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
              <TaskRow key={task.id} task={task} role={role} jobId={job.id} />
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
                className="mt-3 flex items-center gap-1.5 text-sm text-[#002D72] hover:text-[#003d99] font-medium transition-colors"
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
            className="w-4 h-4 text-[#002D72]"
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
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={notePending || !noteText.trim()}
              className="bg-[#002D72] text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-[#003d99] disabled:opacity-60 transition-colors"
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
                <div className="w-8 h-8 rounded-full bg-[#002D72] flex items-center justify-center text-white text-xs font-bold shrink-0">
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
    </div>
  );
}
