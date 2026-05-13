"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Role } from "@/app/generated/prisma/client";
import { sendWelcomeEmail } from "@/lib/email";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function createUser(email: string, name: string, role: Role) {
  await requireAdmin();
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Email is required.");

  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new Error("A user with that email already exists.");

  await prisma.user.create({
    data: { email: normalized, name: name.trim() || null, role, active: true },
  });
  revalidatePath("/admin/users");
}

export async function updateUserRole(userId: string, role: Role) {
  await requireAdmin();
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}

export async function toggleUserActive(userId: string, active: boolean) {
  await requireAdmin();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { active },
    select: { email: true, name: true },
  });
  revalidatePath("/admin/users");

  // Send welcome email only when activating (not deactivating)
  if (active) {
    console.log(`[email] Queuing welcome email for ${user.email}`);
    sendWelcomeEmail(user.email, user.name).catch((err) => {
      console.error("[email] Unhandled error sending welcome email:", err);
    });
  }
}

export async function deleteUser(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    throw new Error("You cannot delete your own account.");
  }

  const [laborCount, materialCount, photoCount, noteCount, coCount, taskCount, eventCount, savedTaskCount] =
    await Promise.all([
      prisma.laborEntry.count({ where: { userId } }),
      prisma.material.count({ where: { userId } }),
      prisma.photo.count({ where: { userId } }),
      prisma.note.count({ where: { userId } }),
      prisma.changeOrder.count({ where: { requestedById: userId } }),
      prisma.task.count({ where: { OR: [{ createdById: userId }, { assigneeId: userId }] } }),
      prisma.taskEvent.count({ where: { userId } }),
      prisma.savedTask.count({ where: { createdById: userId } }),
    ]);

  const total = laborCount + materialCount + photoCount + noteCount + coCount + taskCount + eventCount + savedTaskCount;
  if (total > 0) {
    throw new Error(
      "This user has job data attached (labor entries, materials, notes, etc.) and cannot be deleted. " +
      "Deactivate their account instead."
    );
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
}
