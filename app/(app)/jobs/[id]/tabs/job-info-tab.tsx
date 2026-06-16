"use client";

import { useState, useTransition } from "react";
import type { Job, Role } from "@/app/generated/prisma/client";
import { updateJobInfo, archiveJob, unarchiveJob, deleteJob } from "../actions";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  User,
  ClipboardCheck,
  Pencil,
  Save,
  X,
  Archive,
  ArchiveRestore,
  Trash2,
} from "lucide-react";

type JobInfoTabProps = {
  job: Job & { foreman: { id: string; name: string | null } | null; archived: boolean };
  role: Role;
  fieldUsers: { id: string; name: string | null; role: Role }[];
};

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-800 flex items-start gap-2">
        {icon && <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>}
        {value}
      </dd>
    </div>
  );
}

function InputField({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
}) {
  const cls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] bg-white";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          rows={4}
          className={cls + " resize-y"}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={
            type === "date" && defaultValue
              ? new Date(defaultValue).toISOString().split("T")[0]
              : (defaultValue ?? "")
          }
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}

export function JobInfoTab({ job, role, fieldUsers }: JobInfoTabProps) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archivePending, startArchiveTransition] = useTransition();
  const [excludeFromPL, setExcludeFromPL] = useState(job.excludeFromPL);
  const canEdit = role === "ADMIN" || role === "OFFICE" || role === "FOREMAN";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await updateJobInfo(job.id, fd);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed.");
      }
    });
  };

  if (editing) {
    return (
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-4 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <InputField
            label="Job Number"
            name="jobNumber"
            defaultValue={job.jobNumber}
            placeholder="e.g. 2025-042"
          />
          <InputField
            label="Job Name"
            name="jobName"
            defaultValue={job.jobName}
            placeholder="Project name"
          />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <select
              name="status"
              defaultValue={job.status}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] bg-white"
            >
              <option value="ESTIMATING">Estimating</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="BILLED">Billed</option>
              <option value="COMPLETED">Completed</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Foreman
            </label>
            <select
              name="foremanId"
              defaultValue={job.foremanId ?? ""}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a8a] bg-white"
            >
              <option value="">— Unassigned —</option>
              {fieldUsers.filter(u => u.role === "FOREMAN" || u.role === "ADMIN").map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-full">
            <hr className="border-gray-100 my-1" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-3">
              Financial
            </p>
          </div>
          <InputField
            label="Contract Value $"
            name="contractValue"
            type="number"
            defaultValue={job.contractValue ? job.contractValue.toString() : ""}
            placeholder="0.00"
          />

          <div className="col-span-full">
            <hr className="border-gray-100 my-1" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-3">
              Site Address
            </p>
          </div>
          <div className="col-span-full">
            <InputField
              label="Street Address"
              name="address"
              defaultValue={job.address}
              placeholder="123 Main St"
            />
          </div>
          <InputField
            label="City"
            name="city"
            defaultValue={job.city}
            placeholder="City"
          />
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="State"
              name="state"
              defaultValue={job.state}
              placeholder="TN"
            />
            <InputField
              label="Zip"
              name="zip"
              defaultValue={job.zip}
              placeholder="37830"
            />
          </div>

          <div className="col-span-full">
            <hr className="border-gray-100 my-1" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-3">
              General Contractor
            </p>
          </div>
          <InputField
            label="GC Company"
            name="gcCompany"
            defaultValue={job.gcCompany}
          />
          <InputField
            label="GC Contact Name"
            name="gcContactName"
            defaultValue={job.gcContactName}
          />
          <InputField
            label="GC Phone"
            name="gcPhone"
            defaultValue={job.gcPhone}
            type="tel"
          />
          <InputField
            label="GC Email"
            name="gcEmail"
            defaultValue={job.gcEmail}
            type="email"
          />

          <div className="col-span-full">
            <hr className="border-gray-100 my-1" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-3">
              Owner / Client
            </p>
          </div>
          <InputField
            label="Owner Name"
            name="ownerName"
            defaultValue={job.ownerName}
          />
          <InputField
            label="Owner Phone"
            name="ownerPhone"
            defaultValue={job.ownerPhone}
            type="tel"
          />
          <div className="col-span-full">
            <InputField
              label="Owner Email"
              name="ownerEmail"
              defaultValue={job.ownerEmail}
              type="email"
            />
          </div>

          <div className="col-span-full">
            <hr className="border-gray-100 my-1" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-3 mb-3">
              Schedule & Permits
            </p>
          </div>
          <InputField
            label="Contract Start Date"
            name="contractStartDate"
            defaultValue={job.contractStartDate?.toISOString()}
            type="date"
          />
          <InputField
            label="Substantial Completion"
            name="completionDate"
            defaultValue={job.completionDate?.toISOString()}
            type="date"
          />
          <InputField
            label="Permit Number"
            name="permitNumber"
            defaultValue={job.permitNumber}
          />
          <InputField
            label="Inspection Contact"
            name="inspectionContact"
            defaultValue={job.inspectionContact}
          />
          <div className="col-span-full sm:col-span-1">
            <InputField
              label="Inspection Phone"
              name="inspectionPhone"
              defaultValue={job.inspectionPhone}
              type="tel"
            />
          </div>

          <div className="col-span-full">
            <InputField
              label="Scope of Work"
              name="scopeOfWork"
              defaultValue={job.scopeOfWork}
              textarea
              placeholder="Describe the scope of work for this job…"
            />
          </div>

          {role === "ADMIN" && (
            <div className="col-span-full">
              <hr className="border-gray-100 my-1" />
              <div className="flex items-center justify-between py-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Exclude from P&amp;L</label>
                  <p className="text-xs text-gray-400">Mark as test/training job — excluded from all financial reporting</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExcludeFromPL(v => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${excludeFromPL ? "bg-orange-500" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${excludeFromPL ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <input type="hidden" name="excludeFromPL" value={excludeFromPL ? "true" : "false"} />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e3a8a] text-white text-sm font-medium hover:bg-blue-900 disabled:opacity-60 transition-colors"
          >
            <Save className="w-4 h-4" />
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    );
  }

  // View mode
  const fmt = (d: Date | null | undefined) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#1e3a8a] hover:bg-blue-50 transition-colors border border-[#1e3a8a]/20"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      )}

      <dl className="grid gap-5 sm:grid-cols-2">
        <Field label="Foreman" value={job.foreman?.name} icon={<User className="w-3.5 h-3.5" />} />

        <div className="col-span-full sm:col-span-2">
          <hr className="border-gray-100 my-1" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">
            Site Address
          </p>
        </div>
        <Field
          label="Address"
          value={
            [job.address, job.city, job.state, job.zip]
              .filter(Boolean)
              .join(", ") || null
          }
          icon={<MapPin className="w-3.5 h-3.5" />}
        />

        <div className="col-span-full sm:col-span-2">
          <hr className="border-gray-100 my-1" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">
            General Contractor
          </p>
        </div>
        <Field label="Company" value={job.gcCompany} icon={<Building2 className="w-3.5 h-3.5" />} />
        <Field label="Contact" value={job.gcContactName} icon={<User className="w-3.5 h-3.5" />} />
        <Field label="GC Phone" value={job.gcPhone} icon={<Phone className="w-3.5 h-3.5" />} />
        <Field label="GC Email" value={job.gcEmail} icon={<Mail className="w-3.5 h-3.5" />} />

        <div className="col-span-full sm:col-span-2">
          <hr className="border-gray-100 my-1" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">
            Owner / Client
          </p>
        </div>
        <Field label="Owner" value={job.ownerName} icon={<User className="w-3.5 h-3.5" />} />
        <Field label="Owner Phone" value={job.ownerPhone} icon={<Phone className="w-3.5 h-3.5" />} />
        <Field label="Owner Email" value={job.ownerEmail} icon={<Mail className="w-3.5 h-3.5" />} />

        <div className="col-span-full sm:col-span-2">
          <hr className="border-gray-100 my-1" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">
            Schedule & Permits
          </p>
        </div>
        <Field
          label="Contract Start"
          value={fmt(job.contractStartDate)}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        <Field
          label="Substantial Completion"
          value={fmt(job.completionDate)}
          icon={<Calendar className="w-3.5 h-3.5" />}
        />
        <Field label="Permit Number" value={job.permitNumber} icon={<FileText className="w-3.5 h-3.5" />} />
        <Field
          label="Inspection Contact"
          value={
            job.inspectionContact
              ? `${job.inspectionContact}${job.inspectionPhone ? ` · ${job.inspectionPhone}` : ""}`
              : null
          }
          icon={<ClipboardCheck className="w-3.5 h-3.5" />}
        />

        {job.scopeOfWork && (
          <>
            <div className="col-span-full sm:col-span-2">
              <hr className="border-gray-100 my-1" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-4 mb-3">
                Scope of Work
              </p>
            </div>
            <div className="col-span-full">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {job.scopeOfWork}
              </p>
            </div>
          </>
        )}

        {!job.address &&
          !job.gcCompany &&
          !job.ownerName &&
          !job.scopeOfWork &&
          canEdit && (
            <div className="col-span-full text-center py-8 text-gray-400 text-sm">
              No details entered yet.{" "}
              <button
                onClick={() => setEditing(true)}
                className="text-[#1e3a8a] underline"
              >
                Add them now
              </button>
            </div>
          )}
      </dl>

      {/* ADMIN: Archive / Delete */}
      {role === "ADMIN" && (
        <div className="mt-8 pt-6 border-t border-red-100">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-4">Danger Zone</p>

          {/* Archive toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50 mb-3">
            <div>
              <p className="text-sm font-medium text-amber-900">
                {job.archived ? "Archived" : "Archive this job"}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {job.archived ? "Restore to active jobs list." : "Removes from dashboard. Data is preserved."}
              </p>
            </div>
            <button
              disabled={archivePending}
              onClick={() => startArchiveTransition(() => job.archived ? unarchiveJob(job.id) : archiveJob(job.id))}
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-60 transition-colors"
            >
              {job.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {archivePending ? "…" : job.archived ? "Unarchive" : "Archive"}
            </button>
          </div>

          {/* Delete */}
          {!showDelete ? (
            <div className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50">
              <div>
                <p className="text-sm font-medium text-red-900">Delete this job</p>
                <p className="text-xs text-red-600 mt-0.5">Permanently removes all data. Cannot be undone.</p>
              </div>
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-100 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-red-300 bg-red-50 space-y-3">
              <p className="text-sm font-semibold text-red-900">Confirm deletion</p>
              <p className="text-xs text-red-700">
                Type <span className="font-mono font-bold">{job.jobName}</span> to confirm.
              </p>
              {deleteError && <p className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">{deleteError}</p>}
              <input
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder={job.jobName}
                className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); setDeleteError(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                <button
                  disabled={deletePending || deleteConfirm !== job.jobName}
                  onClick={() => {
                    setDeleteError(null);
                    startDeleteTransition(async () => {
                      try { await deleteJob(job.id, deleteConfirm); }
                      catch (e) { setDeleteError(e instanceof Error ? e.message : "Delete failed."); }
                    });
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deletePending ? "Deleting…" : "Delete Permanently"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
