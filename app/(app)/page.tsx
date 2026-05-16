import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JobCard } from "./job-card";
import { CreateJobButton } from "./create-job-button";
import { ArchivedJobsSection } from "./archived-jobs-section";
import type { JobStatus } from "@/app/generated/prisma/client";

const statusOrder: JobStatus[] = ["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const isOffice = session?.user?.role === "OFFICE";

  const [allJobs, archivedJobs] = await Promise.all([
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
  ]);

  // Split estimates from regular jobs
  const estimateJobs = allJobs.filter((j) => j.jobType === "ESTIMATE");
  const jobs = allJobs.filter((j) => j.jobType !== "ESTIMATE");

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

      {allJobs.length === 0 && archivedJobs.length === 0 && (
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

      {estimateJobs.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-gray-400">
              Estimates
            </h2>
            <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
              {estimateJobs.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {estimateJobs.map((job) => (
              <JobCard key={job.id} job={job} />
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
