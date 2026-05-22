import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const docs = await prisma.document.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });
  return NextResponse.json(docs);
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const doc = await prisma.document.create({
    data: {
      id: crypto.randomUUID(),
      jobId: id,
      uploadedById: session.user.id,
      name: body.name,
      fileUrl: body.fileUrl,
      fileName: body.fileName || body.name,
      fileSize: body.fileSize ?? null,
      category: body.category ?? "OTHER",
      createdAt: new Date(),
    },
  });
  return NextResponse.json(doc);
}

export async function DELETE(req: Request, { params }: Params) {
  const { id: _jobId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const docId = new URL(req.url).searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "Missing docId" }, { status: 400 });
  await prisma.document.delete({ where: { id: docId } });
  return NextResponse.json({ ok: true });
}
