"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function createSavedTask(fd: FormData) {
  const session = await requireAdmin();

  const title = (fd.get("title") as string | null)?.trim();
  const description = (fd.get("description") as string | null)?.trim() || null;
  const sortOrder = parseInt((fd.get("sortOrder") as string) || "0", 10);

  if (!title) throw new Error("Title is required.");

  await prisma.savedTask.create({
    data: {
      title,
      description,
      sortOrder: isNaN(sortOrder) ? 0 : sortOrder,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/saved-tasks");
}

export async function deleteSavedTask(id: string) {
  await requireAdmin();
  await prisma.savedTask.delete({ where: { id } });
  revalidatePath("/admin/saved-tasks");
}
