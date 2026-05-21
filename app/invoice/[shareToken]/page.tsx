import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

// This page is intentionally public — no auth required.
// Access is gated by the 32-char shareToken embedded in the URL.

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { shareToken },
    include: {
      job: {
        select: {
          jobNumber: true,
          jobName: true,
          gcCompany: true,
          gcContactName: true,
          gcEmail: true,
          address: true,
          city: true,
          state: true,
          contractStartDate: true,
          contractValue: true,
          scopeOfWork: true,
          changeOrders: {
            where: { status: "APPROVED" },
            select: { coNumber: true, description: true, approvedValue: true },
            orderBy: { coNumber: "asc" },
          },
        },
      },
    },
  });

  if (!invoice) notFound();
  if (invoice.type !== "STANDARD") notFound();
  if (invoice.shareExpiry && new Date() > invoice.shareExpiry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <p className="text-2xl font-bold text-gray-700 mb-2">Link Expired</p>
          <p className="text-gray-500">This invoice link has expired. Please contact Oak Ridge Electrical LLC for a current copy.</p>
        </div>
      </div>
    );
  }

  const job = invoice.job;
  const company = {
    name: "Oak Ridge Electrical LLC",
    address: "209 W. River Rd",
    city: "Hooksett",
    state: "NH",
    zip: "03106",
    phone: "603-660-4651",
    email: "Justin@oakridgeelectrical.com",
  };

  const invoiceNumber = `${job.jobNumber}-${String(invoice.invoiceNumber).padStart(3, "0")}`;
  const amount = invoice.amount.toNumber();
  const retainageHeld = invoice.retainageHeld?.toNumber() ?? 0;
  const invoiceKind = invoice.invoiceKind === "FINAL_INVOICE" ? "FINAL INVOICE" : "PROGRESS PAYMENT";

  const lineItems = (invoice.lineItems as { label: string; amount: number }[] | null) ?? [];
  const approvedCOs = job.changeOrders;
  const contractValue = job.contractValue?.toNumber() ?? 0;
  const coTotal = approvedCOs.reduce((s, co) => s + (co.approvedValue?.toNumber() ?? 0), 0);

  const scopeItems: string[] = invoice.scopeOfWork
    ? invoice.scopeOfWork.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    : job.scopeOfWork
    ? job.scopeOfWork.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const projectAddress = [job.address, job.city, job.state].filter(Boolean).join(", ");

  const PAYMENT_TERMS_TEXT: Record<string, string> = {
    due_on_receipt: "Payment is due upon receipt of this invoice.",
    net_10: "Payment is due within 10 days of invoice date.",
    net_15: "Payment is due within 15 days of invoice date.",
    net_30: "Payment is due within 30 days of invoice date.",
    net_45: "Payment is due within 45 days of invoice date.",
    net_60: "Payment is due within 60 days of invoice date.",
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4">
          <div className="flex items-center gap-5 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Oak Ridge Electrical" className="w-20 h-20 object-contain shrink-0" />
            <div>
              <p className="text-lg font-bold text-[#002D72] tracking-wide uppercase">{company.name}</p>
              <p className="text-sm text-gray-500 mt-0.5">{company.address} · {company.city}, {company.state} {company.zip}</p>
              <p className="text-sm text-gray-500">{company.phone} · {company.email}</p>
            </div>
          </div>
          <div className="border-b-4 border-[#FF5910]" />
        </div>

        {/* Invoice Title Row */}
        <div className="px-8 py-4 flex items-end justify-between">
          <h1 className="text-3xl font-extrabold text-[#002D72]">INVOICE</h1>
          <div className="text-right">
            <p className="text-sm font-bold text-[#FF5910] uppercase">{invoiceKind}</p>
            <p className="text-sm text-gray-500 mt-0.5">Invoice #{invoiceNumber}</p>
            <p className="text-sm text-gray-500">Date: {fmtDate(invoice.date)}</p>
            {invoice.periodTo && (
              <p className="text-sm text-gray-500">Period To: {fmtDate(invoice.periodTo)}</p>
            )}
          </div>
        </div>
        <div className="px-8 mb-4 border-b border-gray-100" />

        {/* From / To */}
        <div className="px-8 pb-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-bold text-[#002D72] uppercase tracking-wider mb-2">From</p>
            <p className="text-sm font-semibold">{company.name}</p>
            <p className="text-sm text-gray-600">{company.address}</p>
            <p className="text-sm text-gray-600">{company.city}, {company.state} {company.zip}</p>
            <p className="text-sm text-gray-600">Justin Marceau, Owner</p>
            <p className="text-sm text-gray-600">{company.phone}</p>
            <p className="text-sm text-gray-600">{company.email}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-[#002D72] uppercase tracking-wider mb-2">To / Project</p>
            {job.gcCompany && <p className="text-sm font-semibold">{job.gcCompany}</p>}
            {job.gcContactName && <p className="text-sm text-gray-600">{job.gcContactName}</p>}
            {job.gcEmail && <p className="text-sm text-gray-600">{job.gcEmail}</p>}
            <p className="text-sm font-semibold mt-2">{job.jobName}</p>
            <p className="text-sm text-gray-600">Job #{job.jobNumber}</p>
            {projectAddress && <p className="text-sm text-gray-600">{projectAddress}</p>}
            {job.contractStartDate && (
              <p className="text-sm text-gray-600">Contract: {fmtDate(job.contractStartDate)}</p>
            )}
          </div>
        </div>

        {/* Scope of Work */}
        {scopeItems.length > 0 && (
          <div className="px-8 pb-6">
            <p className="text-xs font-bold text-[#002D72] uppercase tracking-wider mb-3">Scope of Work</p>
            <ol className="space-y-1.5">
              {scopeItems.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="text-gray-400 shrink-0 w-5">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Financial Summary */}
        <div className="px-8 pb-6">
          {contractValue > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Contract Total</span>
              <span className="text-sm font-semibold">{fmt$(contractValue)}</span>
            </div>
          )}
          {approvedCOs.map((co, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-[#FF5910]">
                Change Order {co.coNumber != null ? `#${co.coNumber}` : ""}
                {co.description ? ` — ${co.description}` : ""}
              </span>
              <span className="text-sm font-semibold text-[#FF5910]">+{fmt$(co.approvedValue?.toNumber() ?? 0)}</span>
            </div>
          ))}
          {coTotal > 0 && contractValue > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Revised Contract Total</span>
              <span className="text-sm font-semibold">{fmt$(contractValue + coTotal)}</span>
            </div>
          )}
          {lineItems.map((li, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700">{li.label}</span>
              <span className="text-sm font-semibold">{fmt$(li.amount)}</span>
            </div>
          ))}

          {/* Invoice Total */}
          <div className="flex justify-between py-3 border-t-2 border-[#002D72] mt-2">
            <span className="text-sm font-bold text-[#002D72]">INVOICE TOTAL</span>
            <span className="text-sm font-bold text-[#002D72]">{fmt$(amount)}</span>
          </div>
          {retainageHeld > 0 && (
            <>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-500">Less Retainage ({invoice.retainagePct ?? 0}%)</span>
                <span className="text-sm font-semibold">({fmt$(retainageHeld)})</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-[#002D72]">
                <span className="text-sm font-bold text-[#002D72]">CURRENT PAYMENT DUE</span>
                <span className="text-sm font-bold text-[#002D72]">{fmt$(amount - retainageHeld)}</span>
              </div>
            </>
          )}
        </div>

        {/* Payment Terms */}
        <div className="px-8 pb-4">
          <p className="text-xs font-bold text-[#002D72] uppercase tracking-wider mb-1">Payment Terms</p>
          <p className="text-xs text-gray-500">
            {PAYMENT_TERMS_TEXT[invoice.paymentTerms ?? "due_on_receipt"] ?? PAYMENT_TERMS_TEXT.due_on_receipt}{" "}
            Past due balances may incur a finance charge of 1.5% per month in accordance with New Hampshire law.
            Please remit payment to: {company.name}, {company.address}, {company.city}, {company.state} {company.zip}
          </p>
        </div>

        {/* Warranty */}
        <div className="px-8 pb-4">
          <p className="text-xs font-bold text-[#002D72] uppercase tracking-wider mb-1">Warranty</p>
          <p className="text-xs text-gray-500">
            Oak Ridge Electrical LLC provides a one-year workmanship warranty from the date of substantial completion.
            All installed equipment carries the applicable manufacturer&apos;s warranty.
          </p>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="px-8 pb-6">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-gray-700">{invoice.notes}</p>
            </div>
          </div>
        )}

        {/* PDF download */}
        <div className="px-8 pb-8 flex justify-end">
          <a
            href={`/api/public/invoice/${shareToken}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#002D72] text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-blue-900 transition-colors"
          >
            Download PDF
          </a>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            Thank you for your business! · {company.name} · Justin Marceau, Owner · {company.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
