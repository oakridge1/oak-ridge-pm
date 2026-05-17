export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active || (u.role !== "ADMIN" && !u.estimatingPermission)) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;

  const estimate = await prisma.estimate.findUnique({ where: { id } });
  if (!estimate) return new NextResponse("Not found", { status: 404 });

  const json = JSON.stringify(estimate, null, 2);
  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${estimate.estimateNumber}.json"`,
    },
  });
}
