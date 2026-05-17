export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  const { id: jobId, requestId } = await params;

  const request = await prisma.stockRequest.findUnique({ where: { id: requestId } });
  if (!request || request.jobId !== jobId) return new NextResponse("Not found", { status: 404 });

  // Only creator, foreman, or admin can delete
  if (request.userId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "FOREMAN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await prisma.stockRequest.delete({ where: { id: requestId } });
  return NextResponse.json({ ok: true });
}
