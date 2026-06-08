"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { DocumentCategory } from "@/app/generated/prisma/client";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function createDocument(
  jobId: string,
  input: {
    category: DocumentCategory;
    customCategory?: string | null;
    name: string;
    fileUrl: string;
    fileName: string;
    fileSize?: number | null;
  }
) {
  const session = await requireActive();

  const name = input.name.trim();
  if (!name) throw new Error("Document name is required.");
  if (!input.fileUrl) throw new Error("File URL is required.");

  await prisma.document.create({
    data: {
      jobId,
      uploadedById: session.user.id,
      category: input.category,
      customCategory: input.customCategory ?? null,
      name,
      fileUrl: input.fileUrl,
      fileName: input.fileName,
      fileSize: input.fileSize ?? null,
    },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deleteDocument(documentId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete documents.");

  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { jobId: true },
  });
  if (!doc) throw new Error("Document not found.");

  await prisma.document.delete({ where: { id: documentId } });
  revalidatePath(`/jobs/${doc.jobId}`);
}
