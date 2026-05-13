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
  const laborBudgetHours = formData.get("laborBudgetHours")
    ? parseFloat(formData.get("laborBudgetHours") as string)
    : null;
  const materialBudget = formData.get("materialBudget")
    ? parseFloat(formData.get("materialBudget") as string)
    : null;
  const contractValue = formData.get("contractValue")
    ? parseFloat(formData.get("contractValue") as string)
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
        laborBudgetHours,
        materialBudget,
        contractValue,
      },
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
