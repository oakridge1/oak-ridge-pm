import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "../report/print-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

type OtherCost = { id: string; description: string; amount: number };

export default async function JobSummaryReportPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role === "TEAMMATE") redirect(`/jobs/${id}`);

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      foreman: { select: { name: true } },
      laborEntries: { select: { hours: true } },
      materials: { select: { amount: true } },
      changeOrders: { select: { id: true, description: true, status: true, approvedValue: true } },
      payments: { orderBy: { date: "asc" } },
    },
  });
  if (!job) notFound();

  const fmt$ = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  const fmtDate = (d: Date | null | string | undefined) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

  // ── Computed values ────────────────────────────────────────────────────────
  const totalHours = job.laborEntries.reduce((s, e) => s + e.hours, 0);
  const laborCost = job.blendedLaborRate != null
    ? totalHours * job.blendedLaborRate.toNumber()
    : null;
  const materialsCost = job.materials.reduce((s, m) => s + m.amount.toNumber(), 0);
  const subCost = job.subcontractorCost?.toNumber() ?? 0;
  const equipCost = job.equipmentCost?.toNumber() ?? 0;
  const equipBillPct = job.equipmentBillPct ?? 100;
  const otherCosts = (job.otherCosts as OtherCost[] | null) ?? [];
  const otherTotal = otherCosts.reduce((s, c) => s + c.amount, 0);
  const totalDirectCosts = (laborCost ?? 0) + materialsCost + subCost + equipCost + otherTotal;

  const laborMarkup = laborCost != null && job.laborMarkupPct != null
    ? laborCost * (job.laborMarkupPct / 100) : 0;
  const subMarkup = subCost * ((job.subMarkupPct ?? 0) / 100);
  const equipMarkup = (equipCost * (equipBillPct / 100)) * ((job.equipmentMarkupPct ?? 0) / 100);
  const totalMarkup = laborMarkup + subMarkup + equipMarkup;
  const grossBilling = totalDirectCosts + totalMarkup;

  const contractValue = job.contractValue?.toNumber() ?? 0;
  const approvedCOs = job.changeOrders
    .filter(co => co.status === "APPROVED")
    .reduce((s, co) => s + (co.approvedValue?.toNumber() ?? 0), 0);
  const revisedContract = contractValue + approvedCOs;

  const totalBilled = job.payments.reduce((s, p) => s + p.amount.toNumber(), 0);
  const balanceRemaining = revisedContract - totalBilled;

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
        }
        body { font-family: system-ui, -apple-system, sans-serif; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton
          href={`/api/jobs/${id}/pdf?type=summary`}
          fileName={`${job.jobNumber}_${job.jobName.replace(/[^a-z0-9]/gi, "_")}_Summary.pdf`}
        />
        <a href={`/jobs/${id}`} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
          ← Back
        </a>
      </div>

      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="border-b-4 border-[#002D72] pb-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#FF5910] uppercase tracking-widest">Oak Ridge Electrical LLC</p>
              <h1 className="text-3xl font-bold text-[#002D72] mt-1">{job.jobName}</h1>
              <p className="text-gray-500 mt-1 font-mono text-sm">Job #{job.jobNumber}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p className="font-semibold text-gray-700">Billing Summary</p>
              <p>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Project Information</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {([
              ["Foreman", job.foreman?.name],
              ["GC Company", job.gcCompany],
              ["GC Contact", job.gcContactName],
              ["Contract Start", fmtDate(job.contractStartDate)],
              ["Completion Date", fmtDate(job.completionDate)],
              ["Permit #", job.permitNumber],
            ] as [string, string | null | undefined][]).filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-gray-400 w-36 shrink-0">{label}</span>
                <span className="text-gray-800 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Cost Breakdown */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Cost Breakdown</h2>
          <table className="w-full text-sm">
            <tbody>
              {/* Labor */}
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">Labor</td>
                <td className="py-2 text-gray-400 text-xs">{totalHours.toFixed(1)} hrs{job.blendedLaborRate ? ` @ ${fmt$(job.blendedLaborRate.toNumber())}/hr` : ""}</td>
                <td className="py-2 text-right tabular-nums font-medium">{laborCost != null ? fmt$(laborCost) : "—"}</td>
              </tr>
              {/* Labor markup */}
              {job.laborMarkupPct != null && laborCost != null && (
                <tr className="border-b border-gray-100">
                  <td className="py-2 text-gray-400 pl-4">↳ Overhead & Profit</td>
                  <td className="py-2 text-gray-400 text-xs">{job.laborMarkupPct}%</td>
                  <td className="py-2 text-right tabular-nums text-gray-600">{fmt$(laborMarkup)}</td>
                </tr>
              )}
              {/* Materials */}
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">Materials & Expenses</td>
                <td className="py-2 text-gray-400 text-xs"></td>
                <td className="py-2 text-right tabular-nums font-medium">{fmt$(materialsCost)}</td>
              </tr>
              {/* Subcontractors */}
              {subCost > 0 && (
                <>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Subcontractors</td>
                    <td className="py-2 text-gray-400 text-xs"></td>
                    <td className="py-2 text-right tabular-nums font-medium">{fmt$(subCost)}</td>
                  </tr>
                  {job.subMarkupPct != null && job.subMarkupPct > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-400 pl-4">↳ Markup</td>
                      <td className="py-2 text-gray-400 text-xs">{job.subMarkupPct}%</td>
                      <td className="py-2 text-right tabular-nums text-gray-600">{fmt$(subMarkup)}</td>
                    </tr>
                  )}
                </>
              )}
              {/* Equipment */}
              {equipCost > 0 && (
                <>
                  <tr className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">Equipment Rental</td>
                    <td className="py-2 text-gray-400 text-xs">{equipBillPct}% billed</td>
                    <td className="py-2 text-right tabular-nums font-medium">{fmt$(equipCost)}</td>
                  </tr>
                  {job.equipmentMarkupPct != null && job.equipmentMarkupPct > 0 && (
                    <tr className="border-b border-gray-100">
                      <td className="py-2 text-gray-400 pl-4">↳ Markup</td>
                      <td className="py-2 text-gray-400 text-xs">{job.equipmentMarkupPct}%</td>
                      <td className="py-2 text-right tabular-nums text-gray-600">{fmt$(equipMarkup)}</td>
                    </tr>
                  )}
                </>
              )}
              {/* Other costs */}
              {otherCosts.map(oc => (
                <tr key={oc.id} className="border-b border-gray-100">
                  <td className="py-2 text-gray-600">{oc.description}</td>
                  <td className="py-2 text-gray-400 text-xs"></td>
                  <td className="py-2 text-right tabular-nums font-medium">{fmt$(oc.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center pt-3 border-t-2 border-[#002D72] mt-2">
            <span className="text-sm font-bold text-[#002D72]">Gross Billing Amount</span>
            <span className="text-lg font-bold text-[#002D72] tabular-nums">{fmt$(grossBilling)}</span>
          </div>
        </section>

        {/* Contract Summary */}
        <section className="mb-8">
          <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Contract Summary</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2 text-gray-600">Original Contract Value</td>
                <td className="py-2 text-right tabular-nums font-medium">{fmt$(contractValue)}</td>
              </tr>
              {job.changeOrders.filter(co => co.status === "APPROVED").map(co => (
                <tr key={co.id} className="border-b border-gray-100">
                  <td className="py-2 text-gray-400 pl-4">↳ CO: {co.description}</td>
                  <td className="py-2 text-right tabular-nums text-gray-600">{fmt$(co.approvedValue?.toNumber() ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-1">
            <span className="text-sm font-semibold text-gray-700">Revised Contract Total</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(revisedContract)}</span>
          </div>
        </section>

        {/* Payment History */}
        {job.payments.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-[#002D72] uppercase tracking-widest border-b border-gray-200 pb-1 mb-4">Payment History</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-1 font-medium">Date</th><th className="pb-1 font-medium">Note</th><th className="pb-1 font-medium text-right">Amount</th>
              </tr></thead>
              <tbody>
                {job.payments.map(p => (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="py-1.5 text-gray-500">{fmtDate(p.date)}</td>
                    <td className="py-1.5">{p.note ?? "—"}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt$(p.amount.toNumber())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-1">
              <span className="text-sm font-semibold text-gray-700">Total Received</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{fmt$(totalBilled)}</span>
            </div>
          </section>
        )}

        {/* Balance */}
        <div className={`rounded-xl p-5 mb-8 ${balanceRemaining > 0 ? "bg-blue-50 border border-[#002D72]/20" : balanceRemaining < 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Balance Remaining to Bill</p>
              <p className="text-3xl font-bold text-[#002D72] tabular-nums">{fmt$(balanceRemaining)}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>{fmt$(totalBilled)} received</p>
              <p>of {fmt$(revisedContract)} contract</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-200 pt-4 text-xs text-gray-400 flex justify-between">
          <span>Oak Ridge Electrical LLC — Confidential</span>
          <span>Generated {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </>
  );
}
