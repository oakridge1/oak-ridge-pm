import Link from "next/link";
import type { Job, JobStatus } from "@/app/generated/prisma/client";
import { MapPin, User, Calendar } from "lucide-react";

type JobWithRelations = Job & {
  foreman: { name: string | null } | null;
  _count: { laborEntries: number; materials: number; photos: number };
};

const statusConfig: Record<
  JobStatus,
  { label: string; dot: string; border: string }
> = {
  ACTIVE: {
    label: "Active",
    dot: "bg-green-500",
    border: "border-l-green-500",
  },
  COMPLETED: {
    label: "Completed",
    dot: "bg-gray-400",
    border: "border-l-gray-400",
  },
  ON_HOLD: {
    label: "On Hold",
    dot: "bg-amber-500",
    border: "border-l-amber-500",
  },
  CANCELLED: {
    label: "Cancelled",
    dot: "bg-red-400",
    border: "border-l-red-400",
  },
};

export function JobCard({
  job,
  isSystemJob = false,
  excludeFromPL = false,
}: {
  job: JobWithRelations;
  isSystemJob?: boolean;
  excludeFromPL?: boolean;
}) {
  const cfg = statusConfig[job.status];

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`block rounded-xl shadow-sm border border-gray-200 border-l-4 ${cfg.border} hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all ${isSystemJob ? "bg-gray-50" : "bg-white"}`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <span className="text-xs font-mono text-gray-400">
              #{job.jobNumber}
            </span>
            <h3 className="font-semibold text-[#1e3a8a] leading-tight truncate text-base flex items-center gap-2">
              {job.jobName}
              {isSystemJob && (
                <span className="text-[10px] font-semibold tracking-wider uppercase bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded shrink-0">
                  System Job
                </span>
              )}
              {excludeFromPL && (
                <span className="text-[10px] font-semibold tracking-wider uppercase bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded shrink-0">
                  TEST
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-gray-500">{cfg.label}</span>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1 text-xs text-gray-500">
          {job.foreman?.name && (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{job.foreman.name}</span>
            </div>
          )}
          {(job.city || job.state) && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {[job.city, job.state].filter(Boolean).join(", ")}
              </span>
            </div>
          )}
          {job.completionDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                Due{" "}
                {new Date(job.completionDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Footer counts */}
        <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
          <span>{job._count.laborEntries} labor entries</span>
          <span>{job._count.photos} photos</span>
        </div>
      </div>
    </Link>
  );
}
