import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;
  const { documentId, toCategory, toCustomCategory, action } =
    (await req.json()) as {
      documentId: string;
      toCategory: string;
      toCustomCategory?: string;
      action: "move" | "copy";
    };

  const doc = await prisma.document.findFirst({
    where: { id: documentId, jobId },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (action === "move") {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        category: toCategory as any,
        customCategory: toCustomCategory ?? null,
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "copy") {
    await prisma.document.create({
      data: {
        jobId,
        uploadedById: session.user.id,
        category: toCategory as any,
        customCategory: toCustomCategory ?? null,
        name: doc.name,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
