import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobReportPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role === "FIELD") redirect(`/jobs/${id}`);

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      foreman: { select: { name: true } },
      laborEntries: { orderBy: { date: "desc" }, include: { user: { select: { name: true } } } },
      materials: { orderBy: { date: "desc" } },
      photos: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      tasks: { orderBy: { createdAt: "asc" }, include: { assignee: { select: { name: true } } } },
      changeOrders: true,
      payments: { orderBy: { date: "asc" } },
    },
  });
  if (!job) notFound();

  const totalHours = job.laborEntries.reduce((s, e) => s + e.hours, 0);
  const totalMaterials = job.materials.reduce((s, m) => s + m.amount.toNumber(), 0);
  const totalBilled = job.payments.reduce((s, p) => s + p.amount.toNumber(), 0);

  const fmt$ = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const fmtDate = (d: Date | null | string | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          .page-break { page-break-before: always; }
        }
        body { font-family: system-ui, -apple-system, sans-serif; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a href={`/jobs/${id}`} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
          ← Back
        </a>
      </div>

      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="border-b-4 border-[#002D72] pb-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#FF5910] uppercase tracking-widest">Oak Ridge Electrical LLC</p>
              <h1 className="text-3xl font-bold text-[#002D72] mt-1">{job.jobName}</h1>
              <p className="text-gray-500 mt-1 font-mono text-sm">Job #{job.jobNumber}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Full Job Report</p>
              <p>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>
        </div>

        {/* Job Info */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Job Information</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              ["Foreman", job.foreman?.name],
              ["Status", job.status],
              ["Address", [job.address, job.city, job.state, job.zip].filter(Boolean).join(", ")],
              ["Contract Start", fmtDate(job.contractStartDate)],
              ["Completion Date", fmtDate(job.completionDate)],
              ["GC Company", job.gcCompany],
              ["GC Contact", job.gcContactName],
              ["Permit #", job.permitNumber],
            ].map(([label, value]) => value ? (
              <div key={label} className="flex gap-2">
                <span className="text-gray-400 w-36 shrink-0">{label}</span>
                <span className="text-gray-800 font-medium">{value}</span>
              </div>
            ) : null)}
          </div>
          {job.scopeOfWork && (
            <div className="mt-3">
              <p className="text-gray-400 text-sm mb-1">Scope of Work</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.scopeOfWork}</p>
            </div>
          )}
        </section>

        {/* Labor */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">
            Labor — {totalHours.toFixed(1)} hrs total
          </h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-1 font-medium">Date</th><th className="pb-1 font-medium">Worker</th><th className="pb-1 font-medium text-right">Hours</th>
            </tr></thead>
            <tbody>
              {job.laborEntries.map(e => (
                <tr key={e.id} className="border-b border-gray-50">
                  <td className="py-1 text-gray-500">{fmtDate(e.date)}</td>
                  <td className="py-1">{e.user.name ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums">{e.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Materials */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">
            Materials & Expenses — {fmt$(totalMaterials)} total
          </h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="pb-1 font-medium">Date</th><th className="pb-1 font-medium">Vendor</th><th className="pb-1 font-medium">Description</th><th className="pb-1 font-medium text-right">Amount</th>
            </tr></thead>
            <tbody>
              {job.materials.map(m => (
                <tr key={m.id} className="border-b border-gray-50">
                  <td className="py-1 text-gray-500">{fmtDate(m.date)}</td>
                  <td className="py-1 text-gray-500">{m.vendor ?? "—"}</td>
                  <td className="py-1">{m.description}</td>
                  <td className="py-1 text-right tabular-nums">{fmt$(m.amount.toNumber())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Notes */}
        {job.notes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Notes</h2>
            <div className="space-y-3">
              {job.notes.map(n => (
                <div key={n.id} className="text-sm">
                  <p className="text-gray-400 text-xs">{n.user.name ?? "?"} · {fmtDate(n.createdAt)}</p>
                  <p className="text-gray-700 mt-0.5">{n.content}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tasks */}
        {job.tasks.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Tasks</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-1 font-medium">Task</th><th className="pb-1 font-medium">Assignee</th><th className="pb-1 font-medium">Status</th><th className="pb-1 font-medium">Due</th>
              </tr></thead>
              <tbody>
                {job.tasks.map(t => (
                  <tr key={t.id} className="border-b border-gray-50">
                    <td className="py-1">{t.title}</td>
                    <td className="py-1 text-gray-500">{t.assignee?.name ?? "—"}</td>
                    <td className="py-1 text-gray-500">{t.status}</td>
                    <td className="py-1 text-gray-500">{t.dueDate ? fmtDate(t.dueDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Photos */}
        {job.photos.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">
              Photos ({job.photos.length})
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {job.photos.map(p => (
                <div key={p.id}>
                  <img src={p.url} alt={p.caption ?? ""} className="w-full aspect-square object-cover rounded-lg" />
                  {p.caption && <p className="text-xs text-gray-500 mt-1 truncate">{p.caption}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Payments */}
        {job.payments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">
              Payment History — {fmt$(totalBilled)} received
            </h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-1 font-medium">Date</th><th className="pb-1 font-medium">Note</th><th className="pb-1 font-medium text-right">Amount</th>
              </tr></thead>
              <tbody>
                {job.payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-1 text-gray-500">{fmtDate(p.date)}</td>
                    <td className="py-1">{p.note ?? "—"}</td>
                    <td className="py-1 text-right tabular-nums">{fmt$(p.amount.toNumber())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer */}
        <div className="border-t-2 border-gray-200 pt-4 text-xs text-gray-400 flex justify-between">
          <span>Oak Ridge Electrical LLC — Confidential</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );
}
