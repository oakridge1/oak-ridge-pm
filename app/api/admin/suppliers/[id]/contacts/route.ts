export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const { id } = await params;
  const { contacts } = await req.json() as {
    contacts: Array<{ id?: string; name: string; email: string; isPrimary: boolean }>;
  };

  // Replace all contacts atomically
  await prisma.supplierContact.deleteMany({ where: { supplierId: id } });

  if (contacts.length > 0) {
    await prisma.supplierContact.createMany({
      data: contacts.map(c => ({
        supplierId: id,
        name:      c.name,
        email:     c.email,
        isPrimary: c.isPrimary,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
