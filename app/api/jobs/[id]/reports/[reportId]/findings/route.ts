export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST — create a finding.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const body = await req.json();

  const finding = await prisma.reportFindingEntry.create({
    data: {
      reportId,
      title: body.title ?? "",
      body: body.body ?? "",
      necReferences: body.necReferences ?? "",
      hazardNote: body.hazardNote ?? "",
      libraryFindingId: body.libraryFindingId ?? null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
  });

  // Bump the library finding's useCount when sourced from the library.
  if (body.libraryFindingId) {
    await prisma.libraryFinding.update({
      where: { id: body.libraryFindingId },
      data: { useCount: { increment: 1 } },
    }).catch(() => {});
  }

  return NextResponse.json({ finding }, { status: 201 });
}
