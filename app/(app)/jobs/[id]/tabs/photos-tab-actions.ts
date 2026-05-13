"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireActive() {
  const session = await auth();
  if (!session?.user?.active) throw new Error("Unauthorized");
  return session;
}

export async function addPhotos(
  jobId: string,
  photos: { url: string; caption?: string }[]
) {
  const session = await requireActive();
  if (!photos.length) throw new Error("No photos provided.");

  await prisma.photo.createMany({
    data: photos.map((p) => ({
      jobId,
      userId: session.user.id,
      url: p.url,
      caption: p.caption?.trim() || null,
    })),
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePhoto(id: string, jobId: string) {
  const session = await requireActive();
  if (session.user.role !== "ADMIN") throw new Error("Only ADMIN can delete photos.");

  await prisma.photo.delete({ where: { id } });
  revalidatePath(`/jobs/${jobId}`);
}
