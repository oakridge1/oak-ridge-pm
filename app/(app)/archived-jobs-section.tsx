"use client";

import { useState } from "react";
import { Archive, ChevronDown, ChevronUp } from "lucide-react";
import { JobCard } from "./job-card";

type ArchivedJob = Parameters<typeof JobCard>[0]["job"];

export function ArchivedJobsSection({ jobs }: { jobs: ArchivedJob[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium mb-4 transition-colors"
      >
        <Archive className="w-4 h-4" />
        {jobs.length} Archived Job{jobs.length !== 1 ? "s" : ""}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 opacity-70">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
