import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json([], { status: 401 });
  }
  const { id: jobId } = await params;

  const cats = await prisma.documentCategoryCustom.findMany({
    where: {
      OR: [{ jobId }, { scope: "permanent" }],
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(cats);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: jobId } = await params;
  const { name, scope } = (await req.json()) as {
    name: string;
    scope: "job" | "permanent";
  };

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

  const cat = await prisma.documentCategoryCustom.create({
    data: {
      name,
      slug,
      scope,
      jobId: scope === "job" ? jobId : null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json(cat);
}
