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
