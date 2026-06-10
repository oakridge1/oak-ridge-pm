"use client";

import { useState, useTransition } from "react";
import {
  ClipboardCheck,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  FileDown,
  Pencil,
} from "lucide-react";
import {
  createInspection,
  updateInspection,
  deleteInspection,
} from "./inspections-tab-actions";
import type { Role, InspectionType, InspectionResult } from "@/app/generated/prisma/client";
import { formatLocalDate, toDateInput } from "@/lib/dateUtils";

const INSPECTION_TYPES: { value: InspectionType; label: string }[] = [
  { value: "UNDERGROUND", label: "Underground" },
  { value: "ROUGH_IN", label: "Rough-In" },
  { value: "SERVICE", label: "Service" },
  { value: "FIRE_ALARM", label: "Fire Alarm" },
  { value: "SPECIAL", label: "Special Inspection" },
  { value: "FINAL", label: "Final" },
];

function typeLabel(t: InspectionType) {
  return INSPECTION_TYPES.find((x) => x.value === t)?.label ?? t;
}

function fmt(d: Date | string | null | undefined) {
  return formatLocalDate(d, { month: "short", day: "numeric", year: "numeric" });
}

type Inspection = {
  id: string;
  type: InspectionType;
  dateCalled: Date | null;
  dateScheduled: Date | null;
  inspectorName: string | null;
  inspectorPhone: string | null;
  result: InspectionResult | null;
  correctionNotes: string | null;
  reinspectDate: Date | null;
  notes: string | null;
  createdAt: Date;
  createdBy: { name: string | null };
};

interface InspectionsTabProps {
  job: { id: string; inspections: Inspection[] };
  role: Role;
  canAddInspections?: boolean;
}

function AddInspectionForm({
  jobId,
  onClose,
}: {
  jobId: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = fd.get("type") as InspectionType;
    const dateCalled = fd.get("dateCalled") as string | null;
    const dateScheduled = fd.get("dateScheduled") as string | null;
    const inspectorName = fd.get("inspectorName") as string | null;
    const inspectorPhone = fd.get("inspectorPhone") as string | null;
    const result = (fd.get("result") as InspectionResult | null) || null;
    const correctionNotes = fd.get("correctionNotes") as string | null;
    const reinspectDate = fd.get("reinspectDate") as string | null;
    const notes = fd.get("notes") as string | null;

    setError(null);
    startTransition(async () => {
      try {
        await createInspection(jobId, {
          type,
          dateCalled: dateCalled || null,
          dateScheduled: dateScheduled || null,
          inspectorName,
          inspectorPhone,
          result: result || null,
          correctionNotes,
          reinspectDate: reinspectDate || null,
          notes,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save inspection.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3"
    >
      <h3 className="font-semibold text-[#1e3a8a] text-sm">New Inspection</h3>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Inspection Type *
          </label>
          <select
            name="type"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          >
            {INSPECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Result
          </label>
          <select
            name="result"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          >
            <option value="">Pending</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Date Called
          </label>
          <input
            type="date"
            name="dateCalled"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Date Scheduled
          </label>
          <input
            type="date"
            name="dateScheduled"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Inspector Name
          </label>
          <input
            type="text"
            name="inspectorName"
            placeholder="Inspector name"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Inspector Phone
          </label>
          <input
            type="tel"
            name="inspectorPhone"
            placeholder="Phone number"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Correction Notes
          </label>
          <textarea
            name="correctionNotes"
            rows={2}
            placeholder="Items requiring correction..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Re-Inspect Date
          </label>
          <input
            type="date"
            name="reinspectDate"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            placeholder="Additional notes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 resize-none"
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
          className="px-4 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Add Inspection"}
        </button>
      </div>
    </form>
  );
}

function EditInspectionForm({
  inspection,
  onClose,
}: {
  inspection: Inspection;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toInputDate(d: Date | string | null | undefined) {
    return toDateInput(d);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updateInspection(inspection.id, {
          dateCalled: (fd.get("dateCalled") as string) || null,
          dateScheduled: (fd.get("dateScheduled") as string) || null,
          inspectorName: fd.get("inspectorName") as string | null,
          inspectorPhone: fd.get("inspectorPhone") as string | null,
          result: ((fd.get("result") as string) || null) as InspectionResult | null,
          correctionNotes: fd.get("correctionNotes") as string | null,
          reinspectDate: (fd.get("reinspectDate") as string) || null,
          notes: fd.get("notes") as string | null,
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update inspection.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 border-t pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Result</label>
          <select
            name="result"
            defaultValue={inspection.result ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          >
            <option value="">Pending</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date Called</label>
          <input
            type="date"
            name="dateCalled"
            defaultValue={toInputDate(inspection.dateCalled)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date Scheduled</label>
          <input
            type="date"
            name="dateScheduled"
            defaultValue={toInputDate(inspection.dateScheduled)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Inspector Name</label>
          <input
            type="text"
            name="inspectorName"
            defaultValue={inspection.inspectorName ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Inspector Phone</label>
          <input
            type="tel"
            name="inspectorPhone"
            defaultValue={inspection.inspectorPhone ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Re-Inspect Date</label>
          <input
            type="date"
            name="reinspectDate"
            defaultValue={toInputDate(inspection.reinspectDate)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Correction Notes</label>
          <textarea
            name="correctionNotes"
            rows={2}
            defaultValue={inspection.correctionNotes ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 resize-none"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={inspection.notes ?? ""}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 resize-none"
          />
        </div>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-[#1e3a8a] text-white text-sm font-medium rounded-lg hover:bg-[#003d99] disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

function InspectionCard({
  inspection,
  jobId,
  role,
}: {
  inspection: Inspection;
  jobId: string;
  role: Role;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const isPassed = inspection.result === "PASS";
  const isFailed = inspection.result === "FAIL";
  const isPending = !inspection.result;

  const resultColor = isFailed
    ? "border-red-400 bg-red-50"
    : isPassed
    ? "border-green-400 bg-green-50"
    : "border-gray-200 bg-white";

  const resultBadge = isFailed ? (
    <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
      <XCircle className="w-3.5 h-3.5" /> FAIL
    </span>
  ) : isPassed ? (
    <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3.5 h-3.5" /> PASS
    </span>
  ) : (
    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Pending
    </span>
  );

  const canEdit = role === "ADMIN" || role === "OFFICE" || role === "FOREMAN";

  return (
    <div className={`border-2 rounded-xl overflow-hidden ${resultColor}`}>
      <button
        onClick={() => { setExpanded((v) => !v); setEditing(false); }}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {resultBadge}
          <span className="font-semibold text-sm text-gray-900 truncate">
            {typeLabel(inspection.type)}
          </span>
          {inspection.dateScheduled && (
            <span className="text-xs text-gray-500 hidden sm:inline">
              {fmt(inspection.dateScheduled)}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200/60">
          {editing ? (
            <EditInspectionForm
              inspection={inspection}
              onClose={() => setEditing(false)}
            />
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Date Called</dt>
                  <dd className="font-medium">{fmt(inspection.dateCalled)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Date Scheduled</dt>
                  <dd className="font-medium">{fmt(inspection.dateScheduled)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Inspector</dt>
                  <dd className="font-medium">{inspection.inspectorName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Phone</dt>
                  <dd className="font-medium">
                    {inspection.inspectorPhone ? (
                      <a href={`tel:${inspection.inspectorPhone}`} className="text-[#1e3a8a] hover:underline">
                        {inspection.inspectorPhone}
                      </a>
                    ) : "—"}
                  </dd>
                </div>
                {inspection.reinspectDate && (
                  <div>
                    <dt className="text-xs text-gray-500">Re-Inspect Date</dt>
                    <dd className="font-medium text-orange-600">{fmt(inspection.reinspectDate)}</dd>
                  </div>
                )}
                {inspection.correctionNotes && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500 mb-1">Corrections Needed</dt>
                    <dd className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
                      {inspection.correctionNotes}
                    </dd>
                  </div>
                )}
                {inspection.notes && (
                  <div className="col-span-2">
                    <dt className="text-xs text-gray-500 mb-1">Notes</dt>
                    <dd className="text-sm text-gray-700 whitespace-pre-wrap">{inspection.notes}</dd>
                  </div>
                )}
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500">Logged by</dt>
                  <dd className="text-xs text-gray-500">
                    {inspection.createdBy.name ?? "Unknown"} ·{" "}
                    {fmt(inspection.createdAt)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <a
                  href={`/api/jobs/${jobId}/pdf/inspection/${inspection.id}`}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1e3a8a] border border-gray-200 hover:border-[#1e3a8a]/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> Download PDF
                </a>
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1e3a8a] border border-gray-200 hover:border-[#1e3a8a]/30 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                )}
                {role === "ADMIN" && (
                  <button
                    onClick={() =>
                      startDelete(async () => {
                        if (!confirm("Delete this inspection?")) return;
                        await deleteInspection(inspection.id);
                      })
                    }
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function InspectionsTab({ job, role, canAddInspections = false }: InspectionsTabProps) {
  const [showForm, setShowForm] = useState(false);
  const canAdd = role === "ADMIN" || role === "OFFICE" || role === "FOREMAN" || canAddInspections;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#1e3a8a]" />
          <h2 className="font-semibold text-[#1e3a8a]">Inspection Log</h2>
          <span className="text-xs text-gray-400">({job.inspections.length})</span>
        </div>
        {canAdd && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#1e3a8a] hover:text-[#003d99] border border-[#1e3a8a]/30 hover:border-[#1e3a8a] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Inspection
          </button>
        )}
      </div>

      {showForm && (
        <AddInspectionForm jobId={job.id} onClose={() => setShowForm(false)} />
      )}

      {job.inspections.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 py-6 text-center">
          No inspections logged yet.
        </p>
      )}

      <div className="space-y-3">
        {job.inspections.map((insp) => (
          <InspectionCard
            key={insp.id}
            inspection={insp}
            jobId={job.id}
            role={role}
          />
        ))}
      </div>
    </div>
  );
}
