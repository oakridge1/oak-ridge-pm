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
  const laborBudgetHours = formData.get("laborBudgetHours")
    ? parseFloat(formData.get("laborBudgetHours") as string)
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
        laborBudgetHours,
        materialBudget,
        contractValue,
        blendedLaborRate,
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
