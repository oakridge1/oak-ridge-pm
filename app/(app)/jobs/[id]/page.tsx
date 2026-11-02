import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JobTabs } from "./job-tabs";
import { hasPermission } from "@/lib/permissions";
import { canManagePanels } from "@/lib/panel-schedules";
import { FileText, BarChart2, Mail } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.active) redirect("/login");

  const [job, fieldUsers, allCalendarEvents, companyRates] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
      include: {
        foreman: { select: { id: true, name: true, image: true } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true, image: true } } },
        },
        tasks: {
          orderBy: [{ savedTaskId: "asc" }, { createdAt: "asc" }],
          include: {
            assignee: { select: { id: true, name: true } },
            creator: { select: { name: true } },
            savedTask: { select: { title: true, sortOrder: true } },
          },
        },
        calendarEvents: {
          orderBy: { date: "asc" },
          include: { user: { select: { name: true } } },
        },
        calendarRequests: {
          orderBy: { createdAt: "desc" },
          include: { requestedBy: { select: { name: true, email: true } } },
        },
        laborEntries: {
          orderBy: { date: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                wage: {
                  select: {
                    title: true,
                    year: true,
                    hourlyWage: true,
                    burdenRate: true,
                    isFieldCrew: true,
                  },
                },
              },
            },
          },
        },
        materials: {
          orderBy: { date: "desc" },
          include: { user: { select: { name: true } } },
        },
        photos: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { name: true } } },
        },
        changeOrders: {
          orderBy: { coNumber: "asc" },
          include: { requestedBy: { select: { name: true } } },
        },
        payments: {
          orderBy: { date: "desc" },
          include: { invoice: { select: { id: true, invoiceNumber: true } } },
        },
        invoices: {
          orderBy: { invoiceNumber: "asc" },
          include: { createdBy: { select: { name: true } }, payments: { select: { id: true, amount: true } } },
        },
        inspections: {
          orderBy: { createdAt: "asc" },
          include: { createdBy: { select: { name: true } } },
        },
        rfis: {
          orderBy: { rfiNumber: "asc" },
          include: { submittedBy: { select: { name: true } } },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: { uploadedBy: { select: { name: true } } },
        },
        reports: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reportType: true,
            title: true,
            status: true,
            certNumber: true,
            overallResult: true,
            inspectionDate: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                findings: true,
                fixtures: true,
              },
            },
          },
        },
        panelSchedules: {
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            panelType: true,
            system: true,
            busAmps: true,
            mainType: true,
            mainAmps: true,
            circuitCount: true,
            updatedAt: true,
            _count: { select: { circuits: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { job: { status: { in: ["IN_PROGRESS", "ON_HOLD"] } } },
      orderBy: { date: "asc" },
      include: {
        user: { select: { name: true } },
        job: { select: { id: true, jobName: true, jobNumber: true, calendarColor: true } },
      },
    }),
    prisma.companyRates.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!job) notFound();

  // Who may see the Summary tab (and the financial data behind it). Computed
  // before serializing so everyone else never receives that data.
  const role = session.user.role;
  const isForemanOnThisJob =
    role === "FOREMAN" &&
    (job.foremanId === session.user.id || job.createdById === session.user.id);
  const canViewSummary = role === "ADMIN" || role === "OFFICE" || isForemanOnThisJob;
  // Wages, burden and company bid rates are sent to the browser for ADMIN and
  // OFFICE only. A foreman can see Summary but never receives worker pay data.
  const canViewWages = role === "ADMIN" || role === "OFFICE";
  // Estimating access: ADMIN, or the estimatingPermission flag (same rule as the
  // Estimator link in app/(app)/layout.tsx).
  const isEstimator = role === "ADMIN" || session.user.estimatingPermission === true;

  // Bid crew picker data (ADMIN/OFFICE only): field crew by id, name and title
  // only. Wages never leave the server. Also the names of the locked crew.
  let bidCrewOptions: { id: string; name: string | null; title: string }[] = [];
  let bidCrewNames: string[] = [];
  if (canViewWages) {
    const crewWages = await prisma.employeeWage.findMany({
      where: { isFieldCrew: true, hourlyWage: { gt: 0 }, user: { active: true } },
      select: { title: true, user: { select: { id: true, name: true } } },
    });
    bidCrewOptions = crewWages
      .map((w) => ({ id: w.user.id, name: w.user.name, title: w.title }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const lockedIds = Array.isArray(job.bidCrewIds)
      ? job.bidCrewIds.filter((x): x is string => typeof x === "string")
      : [];
    if (lockedIds.length > 0) {
      const lockedUsers = await prisma.user.findMany({
        where: { id: { in: lockedIds } },
        select: { name: true },
      });
      bidCrewNames = lockedUsers.map((u) => u.name ?? "Unknown");
    }
  }

  const savedTasks = await prisma.savedTask.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Calculate overhead allocation for this job
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Only the Summary tab uses this, so skip the queries for everyone else.
  let overheadAllocAmount = 0;
  if (canViewSummary) {
    const [monthlyOverhead, activeJobCount] = await Promise.all([
      prisma.overheadCost.aggregate({
        where: { effectiveDate: { gte: monthStart, lte: monthEnd }, isRecurring: false },
        _sum: { amount: true },
      }),
      prisma.job.count({
        where: { status: "IN_PROGRESS", isSystemJob: false },
      }),
    ]);
    overheadAllocAmount = (() => {
      const raw = monthlyOverhead._sum.amount;
      const total = (raw as { toNumber?: () => number } | null)?.toNumber?.() ?? (typeof raw === "number" ? raw : 0);
      return activeJobCount > 0 ? total / activeJobCount : 0;
    })();
  }

  // Serialize Prisma Decimal objects — they can't be passed to Client Components
  // The bid crew fields are cost data: removed from the object entirely unless
  // the viewer is ADMIN/OFFICE (then converted to plain values).
  const { bidCostRate, bidCrewIds, bidCostRateSetAt, ...jobBase } = job;
  const serializedJob = {
    ...jobBase,
    ...(canViewWages
      ? {
          bidCostRate: bidCostRate?.toNumber() ?? null,
          bidCrewIds: Array.isArray(bidCrewIds) ? bidCrewIds : null,
          bidCostRateSetAt: bidCostRateSetAt?.toISOString() ?? null,
        }
      : {}),
    contractValue: canViewSummary ? (job.contractValue?.toNumber() ?? null) : null,
    // Crew (no Summary access) don't get the labor rate or budgets. The Labor
    // and Purchase Orders tabs treat null as "not set", so they still show hours.
    laborBudgetDollars: canViewSummary ? (job.laborBudgetDollars?.toNumber() ?? null) : null,
    materialBudget: canViewSummary ? (job.materialBudget?.toNumber() ?? null) : null,
    blendedLaborRate: canViewSummary ? (job.blendedLaborRate?.toNumber() ?? null) : null,
    designFeeAmount: job.designFeeAmount?.toNumber() ?? null,
    designFeePaid: job.designFeePaid?.toNumber() ?? null,
    subcontractorCost: job.subcontractorCost?.toNumber() ?? null,
    equipmentCost: job.equipmentCost?.toNumber() ?? null,
    // Crew get no PO amounts or markup (null); the Purchase Orders tab hides them.
    materials: job.materials.map((m) =>
      canViewSummary
        ? { ...m, amount: m.amount.toNumber() }
        : { ...m, amount: null, markupPct: null },
    ),
    // Money users see every CO's dollars. Crew see them only while the CO is not
    // yet APPROVED, and only if they wrote it or have estimating access.
    changeOrders: job.changeOrders.map((co) => {
      const canSeeAmounts =
        canViewSummary ||
        (co.status !== "APPROVED" && (co.requestedById === session.user.id || isEstimator));
      return {
        ...co,
        canSeeAmounts,
        estimatedLaborCost: canSeeAmounts ? (co.estimatedLaborCost?.toNumber() ?? null) : null,
        estimatedMaterials: canSeeAmounts ? (co.estimatedMaterials?.toNumber() ?? null) : null,
        approvedValue: canSeeAmounts ? (co.approvedValue?.toNumber() ?? null) : null,
      };
    }),
    // Worker wages/burden are only used by the Profitability card (ADMIN/OFFICE);
    // everyone else gets just id + name. Invoices and payments are Summary-only.
    laborEntries: canViewWages
      ? job.laborEntries
      : job.laborEntries.map((e) => ({ ...e, user: { id: e.user.id, name: e.user.name } })),
    payments: canViewSummary
      ? job.payments.map((p) => ({ ...p, amount: p.amount.toNumber() }))
      : [],
    invoices: canViewSummary
      ? job.invoices.map((inv) => ({
          ...inv,
          amount: inv.amount.toNumber(),
          retainageHeld: inv.retainageHeld?.toNumber() ?? null,
          payments: inv.payments.map((p) => ({ ...p, amount: p.amount.toNumber() })),
        }))
      : [],
  };

  const canAddInspections = await hasPermission(session.user.id!, role, "ADD_INSPECTIONS");
  const canManagePanelsFlag = await canManagePanels(session.user, id);
  const canViewReports = role === "ADMIN" || role === "OFFICE" || isForemanOnThisJob;
  const reportUrl = `/jobs/${id}/report`;
  const summaryUrl = `/jobs/${id}/summary-report`;
  const shareBody = encodeURIComponent(
    `Hi,\n\nPlease find the billing summary for ${job.jobName} (Job #${job.jobNumber}) at:\n${summaryUrl}\n\nOak Ridge Electrical LLC`
  );
  const mailtoLink = `mailto:?subject=${encodeURIComponent(`Billing Summary — ${job.jobName}`)}&body=${shareBody}`;

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <a href="/" className="hover:text-[#1e3a8a] transition-colors">
            Jobs
          </a>
          <span>/</span>
          <span className="font-mono">{job.jobNumber}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-[#1e3a8a] leading-tight">
            {job.jobName}
          </h1>
          {canViewReports && (
            <div className="flex items-center gap-2 shrink-0">
              <a href={reportUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1e3a8a] border border-gray-200 hover:border-[#1e3a8a]/30 px-2.5 py-1.5 rounded-lg transition-colors bg-white">
                <FileText className="w-3.5 h-3.5" /> Full Report
              </a>
              <a href={summaryUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1e3a8a] border border-gray-200 hover:border-[#1e3a8a]/30 px-2.5 py-1.5 rounded-lg transition-colors bg-white">
                <BarChart2 className="w-3.5 h-3.5" /> Summary PDF
              </a>
              <a href={mailtoLink}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1e3a8a] border border-gray-200 hover:border-[#1e3a8a]/30 px-2.5 py-1.5 rounded-lg transition-colors bg-white">
                <Mail className="w-3.5 h-3.5" /> Share
              </a>
            </div>
          )}
        </div>
      </div>
      <JobTabs
        job={serializedJob}
        role={role}
        currentUserId={session.user.id}
        currentUserName={session.user.name ?? "Unknown"}
        fieldUsers={fieldUsers}
        savedTasks={savedTasks}
        allCalendarEvents={allCalendarEvents}
        canViewSummary={canViewSummary}
        canViewMoney={canViewSummary}
        canAddInspections={canAddInspections}
        canManagePanels={canManagePanelsFlag}
        companyRates={canViewWages && companyRates ? { defaultBurden: companyRates.defaultBurden, bidRates: companyRates.bidRates as Record<string, number> } : null}
        overheadAllocation={overheadAllocAmount}
        bidCrewOptions={canViewWages ? bidCrewOptions : undefined}
        bidCrewNames={canViewWages ? bidCrewNames : undefined}
      />
    </div>
  );
}
