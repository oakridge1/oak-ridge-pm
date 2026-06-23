export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { FixtureType } from "@/app/generated/prisma/client";

// POST — create a fixture.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const body = await req.json();

  const fixture = await prisma.reportFixture.create({
    data: {
      reportId,
      location: body.location ?? "",
      fixtureTag: body.fixtureTag ?? "",
      fixtureType: (body.fixtureType as FixtureType) ?? "EMERGENCY_LIGHT",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    },
  });

  return NextResponse.json({ fixture }, { status: 201 });
}
