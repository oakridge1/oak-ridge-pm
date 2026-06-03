"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateMyName(name: string) {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Not authenticated");

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: trimmed },
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function updateMyNotificationPreferences(
  preferences: Record<string, boolean>
) {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Not authenticated");

  await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, preferences },
    update: { preferences },
  });

  revalidatePath("/profile");
  return { success: true };
}
