export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// DELETE — remove a circuit-library preset. ADMIN/OFFICE only.
// Circuits that were created from this preset are unaffected: inserts copy the
// values onto the PanelCircuit row; there is no FK from PanelCircuit to
// CircuitLibrary, so deleting a library entry only removes the reusable preset.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const session = await auth();
  const u = session?.user;
  if (!u?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (u.role !== "ADMIN" && u.role !== "OFFICE") return new NextResponse("Forbidden", { status: 403 });

  const { entryId } = await params;
  await prisma.circuitLibrary.deleteMany({ where: { id: entryId } });

  return NextResponse.json({ ok: true });
}
