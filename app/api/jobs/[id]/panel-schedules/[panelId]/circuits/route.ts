export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET — all circuits for a panel, ordered by ckt. Used by the editor poll.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { panelId } = await params;

  const circuits = await prisma.panelCircuit.findMany({
    where: { panelScheduleId: panelId },
    orderBy: { ckt: "asc" },
    select: {
      id: true,
      ckt: true,
      status: true,
      description: true,
      poles: true,
      amps: true,
      flags: true,
      updatedByName: true,
    },
  });

  return NextResponse.json(circuits);
}
