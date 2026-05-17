export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Cancel any PENDING requests from previous days
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await prisma.stockRequest.updateMany({
    where: { status: "PENDING", orderDate: { lt: today } },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({ ok: true, cancelled: result.count });
}
