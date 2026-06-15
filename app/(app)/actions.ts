"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createJob(formData: FormData) {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user?.active || (role !== "ADMIN" && role !== "OFFICE")) {
    return { error: "Unauthorized" };
  }

  const jobNumber = (formData.get("jobNumber") as string)?.trim();
  const jobName = (formData.get("jobName") as string)?.trim();
  const status = (formData.get("status") as string) || "ACTIVE";
  const jobType = (formData.get("jobType") as string) || "BID";
  const laborBudgetDollars = formData.get("laborBudgetDollars")
    ? parseFloat(formData.get("laborBudgetDollars") as string)
    : null;
  const materialBudget = formData.get("materialBudget")
    ? parseFloat(formData.get("materialBudget") as string)
    : null;
  const contractValue = formData.get("contractValue")
    ? parseFloat(formData.get("contractValue") as string)
    : null;
  const blendedLaborRate = formData.get("blendedLaborRate")
    ? parseFloat(formData.get("blendedLaborRate") as string)
    : null;

  // Job info (site / GC / owner / scope / permit) — carried from estimator
  const address           = (formData.get("address")           as string) || "";
  const city              = (formData.get("city")              as string) || "";
  const state_            = (formData.get("state")             as string) || "";
  const zip               = (formData.get("zip")               as string) || "";
  const gcCompany         = (formData.get("gcCompany")         as string) || "";
  const gcContactName     = (formData.get("gcContactName")     as string) || "";
  const gcPhone           = (formData.get("gcPhone")           as string) || "";
  const gcEmail           = (formData.get("gcEmail")           as string) || "";
  const ownerName         = (formData.get("ownerName")         as string) || "";
  const ownerPhone        = (formData.get("ownerPhone")        as string) || "";
  const ownerEmail        = (formData.get("ownerEmail")        as string) || "";
  const scopeOfWork       = (formData.get("scopeOfWork")       as string) || "";
  const contractStartDate = (formData.get("contractStartDate") as string) || "";
  const completionDate    = (formData.get("completionDate")    as string) || "";
  const permitNumber      = (formData.get("permitNumber")      as string) || "";
  const inspectionContact = (formData.get("inspectionContact") as string) || "";
  const inspectionPhone   = (formData.get("inspectionPhone")   as string) || "";
  const designFeePct_     = parseFloat((formData.get("designFeePct")    as string) || "0");
  const designFeeAmount_  = parseFloat((formData.get("designFeeAmount") as string) || "0");

  if (!jobNumber || !jobName) {
    return { error: "Job number and name are required" };
  }

  try {
    const job = await prisma.job.create({
      data: {
        jobNumber,
        jobName,
        status: status as "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED",
        jobType: jobType as "BID" | "TIME_AND_MATERIALS" | "ESTIMATE",
        laborBudgetDollars,
        materialBudget,
        contractValue,
        blendedLaborRate,
        address:           address           || null,
        city:              city              || null,
        state:             state_            || null,
        zip:               zip               || null,
        gcCompany:         gcCompany         || null,
        gcContactName:     gcContactName     || null,
        gcPhone:           gcPhone           || null,
        gcEmail:           gcEmail           || null,
        ownerName:         ownerName         || null,
        ownerPhone:        ownerPhone        || null,
        ownerEmail:        ownerEmail        || null,
        scopeOfWork:       scopeOfWork       || null,
        contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
        completionDate:    completionDate    ? new Date(completionDate)    : null,
        permitNumber:      permitNumber      || null,
        inspectionContact: inspectionContact || null,
        inspectionPhone:   inspectionPhone   || null,
        designFeePct:      designFeePct_     || null,
        designFeeAmount:   designFeeAmount_  || null,
        designFeeApproved: false,
      },
    });

    // Auto-create 4 default cost codes
    await prisma.costCode.createMany({
      data: [
        { jobId: job.id, code: "16-100", description: "Labor",            type: "labor",          sortOrder: 1 },
        { jobId: job.id, code: "16-200", description: "Materials",        type: "material",       sortOrder: 2 },
        { jobId: job.id, code: "16-300", description: "Subcontractor",    type: "subcontractor",  sortOrder: 3 },
        { jobId: job.id, code: "16-400", description: "Equipment Rental", type: "equipment",      sortOrder: 4 },
      ],
    });

    revalidatePath("/");
    return { jobId: job.id };
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return { error: `Job number "${jobNumber}" already exists` };
    }
    return { error: "Failed to create job" };
  }
}

// ── Design fee approval / payment (ADMIN only) ──────────────────────────────────

export async function approveDesignFee(jobId: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.job.update({
    where: { id: jobId },
    data: { designFeeApproved: true },
  });
  revalidatePath(`/jobs/${jobId}`);
}

export async function recordDesignFeePayment(jobId: string, amount: number) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.job.update({
    where: { id: jobId },
    data: { designFeePaid: amount },
  });
  revalidatePath(`/jobs/${jobId}`);
}
