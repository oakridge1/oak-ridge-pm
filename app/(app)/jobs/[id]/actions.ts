"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateJobInfo(jobId: string, fd: FormData) {
  const session = await auth();
  if (
    !session?.user?.active ||
    (session.user.role !== "ADMIN" && session.user.role !== "OFFICE" && session.user.role !== "FOREMAN")
  ) {
    throw new Error("Unauthorized");
  }

  const getString = (key: string) =>
    (fd.get(key) as string | null)?.trim() || null;
  const getDate = (key: string) => {
    const v = getString(key);
    return v ? new Date(v) : null;
  };
  // These helpers return `undefined` when the field is absent from the form
  // entirely (Prisma skips the column), vs `null` when it's present but empty.
  const optDecimal = (key: string) => {
    const raw = fd.get(key);
    if (raw === null) return undefined; // not in form — skip
    const s = (raw as string).trim();
    return s || null;
  };
  const optFloat = (key: string) => {
    const raw = fd.get(key);
    if (raw === null) return undefined; // not in form — skip
    const s = (raw as string).trim();
    return s ? parseFloat(s) : null;
  };

  await prisma.job.update({
    where: { id: jobId },
    data: {
      jobNumber: (fd.get("jobNumber") as string | null)?.trim() || undefined,
      jobName: (fd.get("jobName") as string | null)?.trim() || undefined,
      address: getString("address"),
      city: getString("city"),
      state: getString("state"),
      zip: getString("zip"),
      gcCompany: getString("gcCompany"),
      gcContactName: getString("gcContactName"),
      gcPhone: getString("gcPhone"),
      gcEmail: getString("gcEmail"),
      ownerName: getString("ownerName"),
      ownerPhone: getString("ownerPhone"),
      ownerEmail: getString("ownerEmail"),
      foremanId: getString("foremanId"),
      scopeOfWork: getString("scopeOfWork"),
      contractStartDate: getDate("contractStartDate"),
      completionDate: getDate("completionDate"),
      permitNumber: getString("permitNumber"),
      inspectionContact: getString("inspectionContact"),
      inspectionPhone: getString("inspectionPhone"),
      status: (getString("status") as any) || undefined,
      contractValue: optDecimal("contractValue"),
      laborBudgetHours: optFloat("laborBudgetHours"),
      materialBudget: optDecimal("materialBudget"),
      calendarColor: getString("calendarColor"),
      ...(fd.get("excludeFromPL") !== null && session.user.role === "ADMIN"
        ? { excludeFromPL: fd.get("excludeFromPL") === "true" }
        : {}),
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function archiveJob(jobId: string) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.job.update({ where: { id: jobId }, data: { archived: true } });
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}

export async function unarchiveJob(jobId: string) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") throw new Error("Unauthorized");
  await prisma.job.update({ where: { id: jobId }, data: { archived: false } });
  revalidatePath("/");
  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteJob(jobId: string, confirmName: string) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") throw new Error("Unauthorized");

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { jobName: true } });
  if (!job) throw new Error("Job not found.");
  if (confirmName.trim() !== job.jobName.trim()) {
    throw new Error("Job name does not match. Deletion cancelled.");
  }

  await prisma.job.delete({ where: { id: jobId } });
  redirect("/");
}
