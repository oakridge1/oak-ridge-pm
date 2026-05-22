export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const month = parseInt(searchParams.get("month") ?? String(now.getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") ?? String(now.getFullYear()), 10);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch costs active in the selected month
  const monthCosts = await prisma.overheadCost.findMany({
    where: {
      OR: [
        {
          isRecurring: false,
          effectiveDate: { gte: monthStart, lte: monthEnd },
        },
        {
          isRecurring: true,
          effectiveDate: { lte: monthEnd },
          OR: [
            { endDate: null },
            { endDate: { gte: monthStart } },
          ],
        },
      ],
    },
  });

  // Totals by category for the month
  const categoryMap = new Map<string, number>();
  let monthTotal = 0;
  for (const c of monthCosts) {
    categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + c.amount);
    monthTotal += c.amount;
  }

  const byCategory = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // YTD: sum Jan through current month of the given year
  const ytdStart = new Date(year, 0, 1);
  const ytdEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const ytdCosts = await prisma.overheadCost.findMany({
    where: {
      OR: [
        {
          isRecurring: false,
          effectiveDate: { gte: ytdStart, lte: ytdEnd },
        },
        {
          isRecurring: true,
          effectiveDate: { lte: ytdEnd },
          OR: [
            { endDate: null },
            { endDate: { gte: ytdStart } },
          ],
        },
      ],
    },
  });

  // For recurring costs YTD, count the number of months they were active
  let yearTotal = 0;
  for (const c of ytdCosts) {
    if (!c.isRecurring) {
      yearTotal += c.amount;
    } else {
      // Count how many months Jan–current month this recurring cost was active
      const costStart = c.effectiveDate;
      const costEnd = c.endDate;
      let activeMonths = 0;
      for (let m = 0; m < month; m++) {
        const mStart = new Date(year, m, 1);
        const mEnd = new Date(year, m + 1, 0, 23, 59, 59, 999);
        if (costStart <= mEnd && (costEnd == null || costEnd >= mStart)) {
          activeMonths++;
        }
      }
      yearTotal += c.amount * activeMonths;
    }
  }

  return NextResponse.json({ byCategory, monthTotal, yearTotal });
}
