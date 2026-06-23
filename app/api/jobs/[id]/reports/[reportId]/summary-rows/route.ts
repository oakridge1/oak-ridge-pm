export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SummaryStatus } from "@/app/generated/prisma/client";

// POST — create a summary row.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const body = await req.json();

  const row = await prisma.reportSummaryRow.create({
    data: {
      reportId,
      necArticle: body.necArticle ?? "",
      requirement: body.requirement ?? "",
      status: (body.status as SummaryStatus) ?? "NOT_MET",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
  });

  return NextResponse.json({ row }, { status: 201 });
}
