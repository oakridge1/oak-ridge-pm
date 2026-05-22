import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JobCard } from "./job-card";
import { CreateJobButton } from "./create-job-button";
import { ArchivedJobsSection } from "./archived-jobs-section";
import Link from "next/link";
import { Calculator, ChevronRight } from "lucide-react";
import type { JobStatus } from "@/app/generated/prisma/client";

const statusOrder: JobStatus[] = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SENT: "bg-blue-100 text-blue-700",
  AWARDED: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  ARCHIVED: "bg-gray-100 text-gray-400",
};

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const isOffice = session?.user?.role === "OFFICE";
  const canEstimate =
    session?.user?.role === "ADMIN" ||
    (session?.user as any)?.estimatingPermission === true;

  const [allJobs, archivedJobs, estimates] = await Promise.all([
    prisma.job.findMany({
      where: { archived: false },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        foreman: { select: { name: true } },
        _count: { select: { laborEntries: true, materials: true, photos: true } },
      },
    }),
    isAdmin
      ? prisma.job.findMany({
          where: { archived: true },
          orderBy: { updatedAt: "desc" },
          include: {
            foreman: { select: { name: true } },
            _count: { select: { laborEntries: true, materials: true, photos: true } },
          },
        })
      : Promise.resolve([]),
    canEstimate
      ? prisma.estimate.findMany({
          where: { status: { not: "ARCHIVED" } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            estimateNumber: true,
            name: true,
            clientName: true,
            status: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  // Only show non-estimate, non-system jobs
  const jobs = allJobs.filter((j) => j.jobType !== "ESTIMATE" && j.jobType !== "SYSTEM");
  const systemJobs = allJobs.filter((j) => j.jobType === "SYSTEM");

  const grouped = statusOrder.reduce<Record<string, typeof jobs>>(
    (acc, s) => ({ ...acc, [s]: jobs.filter((j) => j.status === s) }),
    {}
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#002D72]">Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {jobs.filter((j) => j.status === "ACTIVE").length} active job
            {jobs.filter((j) => j.status === "ACTIVE").length !== 1 ? "s" : ""}
          </p>
        </div>
        {(isAdmin || isOffice) && <CreateJobButton />}
      </div>

      {jobs.length === 0 && archivedJobs.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">No jobs yet.</p>
          {(isAdmin || isOffice) && (
            <p className="text-sm mt-2">Click &ldquo;New Job&rdquo; to get started.</p>
          )}
        </div>
      )}

      {statusOrder.map((status) => {
        const group = grouped[status];
        if (!group?.length) return null;
        return (
          <div key={status} className="mb-8">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3">
              {status === "ON_HOLD" ? "On Hold" : status.charAt(0) + status.slice(1).toLowerCase()}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Estimates quick-access panel */}
      {canEstimate && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400">
                Estimates
              </h2>
              {estimates.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                  {estimates.length}
                </span>
              )}
            </div>
            <Link
              href="/estimating"
              className="flex items-center gap-1 text-xs text-[#002D72] hover:underline font-medium"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {estimates.length === 0 ? (
            <Link
              href="/estimating"
              className="flex items-center justify-between gap-3 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-4 hover:bg-blue-50 hover:border-blue-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#002D72] flex items-center justify-center shrink-0">
                  <Calculator className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-gray-500 group-hover:text-[#002D72]">
                  No estimates yet — open the estimating tool to create one
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#002D72]" />
            </Link>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {estimates.map((est, i) => (
                <Link
                  key={est.id}
                  href={`/estimating/${est.id}`}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors ${
                    i < estimates.length - 1 ? "border-b border-gray-100" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-400">{est.estimateNumber}</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          STATUS_BADGE[est.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {est.status}
                      </span>
                    </div>
                    <div className="font-medium text-sm text-gray-900 truncate mt-0.5">{est.name}</div>
                    {est.clientName && (
                      <div className="text-xs text-gray-500 truncate">{est.clientName}</div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
                </Link>
              ))}
              {estimates.length >= 5 && (
                <Link
                  href="/estimating"
                  className="flex items-center justify-center gap-1 px-4 py-3 text-xs text-[#002D72] font-medium hover:bg-gray-50 border-t border-gray-100 transition-colors"
                >
                  See all estimates <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {systemJobs.length > 0 && (
        <div className="mb-8 opacity-75">
          <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400 mb-3 flex items-center gap-2">
            System Jobs
            <span className="bg-gray-200 text-gray-500 text-xs px-2 py-0.5 rounded-full font-medium">
              {systemJobs.length}
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {systemJobs.map((job) => (
              <JobCard key={job.id} job={job} isSystemJob={true} />
            ))}
          </div>
        </div>
      )}

      {isAdmin && archivedJobs.length > 0 && (
        <ArchivedJobsSection jobs={archivedJobs} />
      )}
    </div>
  );
}
