"use client";

import { useState, useTransition } from "react";
import {
  HelpCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Pencil,
  Mail,
  CheckCircle,
  Clock,
} from "lucide-react";
import { createRfi, updateRfi, deleteRfi } from "./rfi-tab-actions";
import type { Role, RfiStatus } from "@/app/generated/prisma/client";

function fmt(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

type Rfi = {
  id: string;
  rfiNumber: number;
  subject: string;
  description: string | null;
  submittedTo: string | null;
  submittedToEmail: string | null;
  status: RfiStatus;
  dueDate: Date | null;
  answeredDate: Date | null;
  answer: string | null;
  fileUrl: string | null;
  fileName: string | null;
  createdAt: Date;
  submittedBy: { name: string | null };
};

interface RfiTabProps {
  job: {
    id: string;
    jobName: string;
    gcContactName: string | null;
    gcEmail: string | null;
    rfis: Rfi[];
  };
  role: Role;
  currentUserName: string;
}

function AddRfiForm({
  job,
  onClose,
}: {
  job: { id: string; gcContactName: string | null; gcEmail: string | null };
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await createRfi(job.id, {
          subject: fd.get("subject") as string,
          description: fd.get("description") as string | null,
          submittedTo: fd.get("submittedTo") as string | null,
          submittedToEmail: fd.get("submittedToEmail") as string | null,
          dueDate: (fd.get("dueDate") as string) || null,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save RFI.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 space-y-3"
    >
      <h3 className="font-semibold text-[#002D72] text-sm">New RFI</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Subject *
          </label>
          <input
            type="text"
            name="subject"
            required
            placeholder="Brief description of the question"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Description
          </label>
          <textarea
            name="description"
            rows={3}
            placeholder="Detailed description..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Submitted To
          </label>
          <input
            type="text"
            name="submittedTo"
            defaultValue={job.gcContactName ?? ""}
            placeholder="GC contact name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Contact Email
          </label>
          <input
            type="email"
            name="submittedToEmail"
            defaultValue={job.gcEmail ?? ""}
            placeholder="email@example.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Due Date
          </label>
          <input
            type="date"
            name="dueDate"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30"
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-[#FF5910] text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Submit RFI"}
        </button>
      </div>
    </form>
  );
}

function RfiCard({
  rfi,
  job,
  role,
}: {
  rfi: Rfi;
  job: { id: string; jobName: string };
  role: Role;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rfiLabel = `RFI-${String(rfi.rfiNumber).padStart(3, "0")}`;
  const isAnswered = rfi.status === "ANSWERED";
  const canEdit = role === "ADMIN" || role === "OFFICE";

  const mailtoLink = rfi.submittedToEmail
    ? `mailto:${rfi.submittedToEmail}?subject=${encodeURIComponent(`${rfiLabel} — ${job.jobName}`)}&body=${encodeURIComponent(`Hi ${rfi.submittedTo ?? ""},\n\nPlease see RFI-${String(rfi.rfiNumber).padStart(3, "0")} for ${job.jobName}.\n\nSubject: ${rfi.subject}\n\n${rfi.description ?? ""}\n\nThank you,\nOak Ridge Electrical LLC`)}`
    : null;

  function handleAnswerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updateRfi(rfi.id, {
          status: "ANSWERED",
          answer: fd.get("answer") as string | null,
          answeredDate: new Date().toISOString().slice(0, 10),
        });
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update RFI.");
      }
    });
  }

  function handleReopenTransition() {
    setError(null);
    startTransition(async () => {
      try {
        await updateRfi(rfi.id, { status: "OPEN", answer: null, answeredDate: null });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reopen RFI.");
      }
    });
  }

  return (
    <div
      className={`border-2 rounded-xl overflow-hidden ${
        isAnswered
          ? "border-green-300 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <button
        onClick={() => { setExpanded((v) => !v); setEditing(false); }}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isAnswered ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircle className="w-3.5 h-3.5" /> Answered
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full shrink-0">
              <Clock className="w-3.5 h-3.5" /> Open
            </span>
          )}
          <span className="font-mono text-xs text-gray-500 shrink-0">{rfiLabel}</span>
          <span className="font-semibold text-sm text-gray-900 truncate">{rfi.subject}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200/60">
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-gray-500">Submitted To</dt>
              <dd className="font-medium">{rfi.submittedTo ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Due Date</dt>
              <dd className="font-medium">{fmt(rfi.dueDate)}</dd>
            </div>
            {rfi.description && (
              <div className="col-span-2">
                <dt className="text-xs text-gray-500 mb-1">Description</dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap">{rfi.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-gray-500">Submitted by</dt>
              <dd className="text-sm">{rfi.submittedBy.name ?? "Unknown"}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Date</dt>
              <dd className="text-sm">{fmt(rfi.createdAt)}</dd>
            </div>
            {isAnswered && (
              <>
                <div>
                  <dt className="text-xs text-gray-500">Answered</dt>
                  <dd className="text-sm">{fmt(rfi.answeredDate)}</dd>
                </div>
                {rfi.answer && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500 mb-1">Answer</dt>
                    <dd className="bg-green-100 border border-green-200 rounded-lg px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                      {rfi.answer}
                    </dd>
                  </div>
                )}
              </>
            )}
          </dl>

          {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

          {/* Answer form */}
          {editing && canEdit && !isAnswered && (
            <form onSubmit={handleAnswerSubmit} className="mt-3 border-t pt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Answer</label>
                <textarea
                  name="answer"
                  rows={3}
                  placeholder="Enter the response..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]/30 resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Mark Answered"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <a
              href={`/api/jobs/${job.id}/pdf/rfi/${rfi.id}`}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#002D72] border border-gray-200 hover:border-[#002D72]/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" /> Download PDF
            </a>
            {mailtoLink && (
              <a
                href={mailtoLink}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#FF5910] border border-gray-200 hover:border-orange-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Mail className="w-3.5 h-3.5" /> Email GC
              </a>
            )}
            {canEdit && !isAnswered && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 border border-green-300 hover:border-green-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Answer
              </button>
            )}
            {canEdit && isAnswered && (
              <button
                onClick={handleReopenTransition}
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-orange-700 hover:text-orange-900 border border-orange-300 hover:border-orange-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" /> Reopen
              </button>
            )}
            {role === "ADMIN" && (
              <button
                onClick={() =>
                  startTransition(async () => {
                    if (!confirm("Delete this RFI?")) return;
                    await deleteRfi(rfi.id).catch((err) => setError(err.message));
                  })
                }
                disabled={isPending}
                className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function RfiTab({ job, role, currentUserName }: RfiTabProps) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#002D72]" />
          <h2 className="font-semibold text-[#002D72]">RFI Log</h2>
          <span className="text-xs text-gray-400">({job.rfis.length})</span>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#002D72] hover:text-[#003d99] border border-[#002D72]/30 hover:border-[#002D72] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> New RFI
          </button>
        )}
      </div>

      {showForm && (
        <AddRfiForm job={job} onClose={() => setShowForm(false)} />
      )}

      {job.rfis.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 py-6 text-center">No RFIs submitted yet.</p>
      )}

      <div className="space-y-3">
        {job.rfis.map((rfi) => (
          <RfiCard key={rfi.id} rfi={rfi} job={job} role={role} />
        ))}
      </div>
    </div>
  );
}
