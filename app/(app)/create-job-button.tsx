"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createJob } from "./actions";
import { useRouter } from "next/navigation";

export function CreateJobButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createJob(fd);
      if (result.error) {
        setError(result.error);
      } else if (result.jobId) {
        setOpen(false);
        router.push(`/jobs/${result.jobId}`);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#FF5910] hover:bg-orange-600 active:scale-[0.97] text-white font-medium text-sm px-4 py-2.5 rounded-xl shadow-sm transition-all"
      >
        <Plus className="w-4 h-4" />
        New Job
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-[#002D72] text-lg">New Job</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Job Number *
                  </label>
                  <input
                    name="jobNumber"
                    required
                    placeholder="e.g. 2025-042"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue="ACTIVE"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72] bg-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Job Type
                </label>
                <select
                  name="jobType"
                  defaultValue="BID"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72] bg-white"
                >
                  <option value="BID">Bid</option>
                  <option value="TIME_AND_MATERIALS">Time &amp; Materials</option>
                  <option value="ESTIMATE">Estimate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Job Name *
                </label>
                <input
                  name="jobName"
                  required
                  placeholder="e.g. Main Street Office Renovation"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Labor Budget (hrs)
                  </label>
                  <input
                    name="laborBudgetHours"
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Material Budget ($)
                  </label>
                  <input
                    name="materialBudget"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Contract Value ($)
                </label>
                <input
                  name="contractValue"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 bg-[#002D72] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-blue-900 disabled:opacity-60 transition-colors"
                >
                  {isPending ? "Creating…" : "Create Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
