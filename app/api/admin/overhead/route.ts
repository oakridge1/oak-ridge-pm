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
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  if (monthParam && yearParam) {
    const month = parseInt(monthParam, 10);
    const year = parseInt(yearParam, 10);

    // Start and end of the requested month
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999); // last ms of last day

    const costs = await prisma.overheadCost.findMany({
      where: {
        OR: [
          // Non-recurring: effectiveDate falls within the month
          {
            isRecurring: false,
            effectiveDate: { gte: start, lte: end },
          },
          // Recurring: started before or during the month AND not ended before the month starts
          {
            isRecurring: true,
            effectiveDate: { lte: end },
            OR: [
              { endDate: null },
              { endDate: { gte: start } },
            ],
          },
        ],
      },
      orderBy: { effectiveDate: "desc" },
    });

    return NextResponse.json({ costs });
  }

  // No filter — return all
  const costs = await prisma.overheadCost.findMany({
    orderBy: { effectiveDate: "desc" },
  });

  return NextResponse.json({ costs });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    category: string;
    description: string;
    amount: number;
    effectiveDate: string;
    endDate?: string;
    isRecurring?: boolean;
    recurringDay?: number;
    recurringFreq?: string;
    autoIncrease?: boolean;
    increaseRate?: number;
    increaseMonth?: number;
    notes?: string;
    receiptUrl?: string;
  };

  const cost = await prisma.overheadCost.create({
    data: {
      category: body.category,
      description: body.description,
      amount: Number(body.amount),
      effectiveDate: new Date(body.effectiveDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      isRecurring: body.isRecurring ?? false,
      recurringDay: body.recurringDay ?? null,
      recurringFreq: body.recurringFreq ?? null,
      autoIncrease: body.autoIncrease ?? false,
      increaseRate: body.increaseRate ?? null,
      increaseMonth: body.increaseMonth ?? null,
      notes: body.notes ?? null,
      receiptUrl: body.receiptUrl ?? null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ cost }, { status: 201 });
}
