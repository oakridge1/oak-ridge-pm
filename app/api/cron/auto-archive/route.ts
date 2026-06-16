export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Auto-archive COMPLETED jobs untouched for 30+ days. Runs daily at 2am.
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const result = await prisma.job.updateMany({
    where: { status: "COMPLETED", archived: false, updatedAt: { lt: cutoff } },
    data: { archived: true },
  });

  return NextResponse.json({ ok: true, archived: result.count });
}
