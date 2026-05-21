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
    poNumber?: string;
    description: string;
    amount: string;
    markupPct?: string;
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
  const markupPct = data.markupPct ? parseFloat(data.markupPct) : 0;

  await prisma.material.create({
    data: {
      jobId,
      userId: session.user.id,
      date: new Date(data.date),
      vendor: data.vendor?.trim() || null,
      poNumber: data.poNumber?.trim() || null,
      description: data.description.trim(),
      amount,
      markupPct: isNaN(markupPct) ? 0 : markupPct,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
    },
  });

  // Auto-archive: materials with file receipts beyond the 5 most recent go to Document Vault
  try {
    const allMaterials = await prisma.material.findMany({
      where: { jobId },
      orderBy: { date: "desc" },
      select: { id: true, date: true, vendor: true, description: true, fileUrl: true, fileName: true, archivedToVault: true, userId: true },
    });

    // Find materials beyond position 5 that have a file and haven't been archived
    const toArchive = allMaterials.slice(5).filter(m => m.fileUrl && !m.archivedToVault);

    for (const m of toArchive) {
      await prisma.document.create({
        data: {
          jobId,
          uploadedById: m.userId,
          category: "MATERIAL_RECEIPTS",
          name: [m.vendor, m.description, new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })].filter(Boolean).join(" — "),
          fileUrl: m.fileUrl!,
          fileName: m.fileName ?? "receipt",
        },
      });
      await prisma.material.update({ where: { id: m.id }, data: { archivedToVault: true } });
    }
  } catch (err) {
    console.error("[materials] archive to vault failed:", err);
    // Non-fatal — don't block the main add
  }

  revalidatePath(`/jobs/${jobId}`);
}

export async function updateMaterial(
  id: string,
  jobId: string,
  data: {
    date: string;
    vendor: string;
    poNumber?: string;
    description: string;
    amount: string;
    markupPct?: string;
  }
) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can edit entries.");

  const amount = parseFloat(data.amount);
  if (isNaN(amount) || amount < 0) throw new Error("Invalid amount.");
  const markupPct = data.markupPct ? parseFloat(data.markupPct) : 0;

  await prisma.material.update({
    where: { id },
    data: {
      date: new Date(data.date),
      vendor: data.vendor?.trim() || null,
      poNumber: data.poNumber?.trim() || null,
      description: data.description.trim(),
      amount,
      markupPct: isNaN(markupPct) ? 0 : markupPct,
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
