'use client';

import { useState, useMemo } from 'react';
import { JobCard } from './job-card';

type JobShape = React.ComponentProps<typeof JobCard>['job'];

const statusLabels: Record<string, string> = {
  ESTIMATING:  'Estimating',
  SUBMITTED:   'Submitted',
  IN_PROGRESS: 'In Progress',
  BILLED:      'Billed',
  COMPLETED:   'Completed',
  ON_HOLD:     'On Hold',
  CANCELLED:   'Cancelled',
};

interface JobsSearchClientProps {
  grouped: Record<string, JobShape[]>;
  statusOrder: string[];
}

export function JobsSearchClient({ grouped, statusOrder }: JobsSearchClientProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped;
    const q = search.toLowerCase();
    const result: Record<string, JobShape[]> = {};
    for (const status of statusOrder) {
      const matches = (grouped[status] || []).filter(j =>
        j.jobNumber?.toLowerCase().includes(q) ||
        j.jobName?.toLowerCase().includes(q) ||
        j.gcCompany?.toLowerCase().includes(q) ||
        j.city?.toLowerCase().includes(q)
      );
      if (matches.length > 0) result[status] = matches;
    }
    return result;
  }, [search, grouped, statusOrder]);

  const anyResults = statusOrder.some(s => filtered[s]?.length);

  return (
    <div>
      <div className="mb-6 flex items-center">
        <input
          type="text"
          placeholder="Search by job #, name, GC, or city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[#1e3a8a] focus:ring-1 focus:ring-[#1e3a8a]"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="ml-2 text-sm text-gray-400 hover:text-gray-600"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {statusOrder.map(status => {
        const jobs = filtered[status];
        if (!jobs?.length) return null;
        return (
          <div key={status} className="mb-8">
            <h2 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-3">
              {statusLabels[status] ?? status}
              <span className="ml-2 text-gray-300 font-normal">{jobs.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {jobs.map(job => (
                <JobCard key={job.id} job={job} excludeFromPL={job.excludeFromPL} />
              ))}
            </div>
          </div>
        );
      })}

      {!anyResults && search && (
        <div className="text-center py-12 text-gray-400">
          No jobs found for &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
