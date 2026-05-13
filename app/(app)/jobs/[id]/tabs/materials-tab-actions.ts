"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function addMaterial(
  jobId: string,
  data: {
    date: string;
    vendor: string;
    description: string;
    amount: string;
    fileUrl?: string;
    fileName?: string;
  }
) {
  const session = await requireActive();

  if (!data.description?.trim()) throw new Error("Description is required.");
  if (!data.amount) throw new Error("Amount is required.");
  if (!data.date) throw new Error("Date is required.");

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount < 0) throw new Error("Invalid amount.");

  await prisma.material.create({
    data: {
      jobId,
      userId: session.user.id,
      date: new Date(data.date),
      vendor: data.vendor?.trim() || null,
      description: data.description.trim(),
      amount,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateMaterial(
  id: string,
  jobId: string,
  data: {
    date: string;
    vendor: string;
    description: string;
    amount: string;
  }
) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can edit entries.");

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount < 0) throw new Error("Invalid amount.");

  await prisma.material.update({
    where: { id },
    data: {
      date: new Date(data.date),
      vendor: data.vendor?.trim() || null,
      description: data.description.trim(),
      amount,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteMaterial(id: string, jobId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete entries.");

  await prisma.material.delete({ where: { id } });
  revalidatePath(`/jobs/${jobId}`);
}
