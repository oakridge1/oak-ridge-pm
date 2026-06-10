export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const items = await prisma.bomItem.findMany({ orderBy: [{ cat: "asc" }, { id: "asc" }] });
  return NextResponse.json(items);
}

// POST — add user-created items (custom assembly builder writeback)
// Body: Array<{ id: string; cat: string; name: string; unit: string; mat: number; lhr: number }>
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const items: { id: string; cat: string; name: string; unit: string; mat: number; lhr: number }[] =
    Array.isArray(body) ? body : [body];

  const uid = session.user.id ?? null;
  const results = await Promise.all(
    items.map(item =>
      prisma.bomItem.upsert({
        where: { id: item.id },
        update: { name: item.name, cat: item.cat, unit: item.unit, mat: item.mat, lhr: item.lhr, updatedBy: uid },
        create: {
          id: item.id, cat: item.cat, name: item.name, unit: item.unit,
          mat: item.mat, lhr: item.lhr, mk: "bulk", gc: false, updatedBy: uid,
        },
      })
    )
  );

  return NextResponse.json(results);
}
