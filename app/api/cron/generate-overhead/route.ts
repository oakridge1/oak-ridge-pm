export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const SAM_CC = "sam@oakridgeelectrical.com";

export async function POST(req: NextRequest) {
  // 1. Validate Authorization header
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  // First day of current month
  const firstOfMonth = new Date(currentYear, now.getMonth(), 1);

  // Last ms of current month (for endDate check)
  const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);

  const monthLabel = firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // 2. Find all active recurring OverheadCost records
  const recurringCosts = await prisma.overheadCost.findMany({
    where: {
      isRecurring: true,
      OR: [
        { endDate: null },
        { endDate: { gte: now } },
      ],
    },
  });

  let generated = 0;
  let total = 0;

  for (const cost of recurringCosts) {
    // 3a. Check for existing non-recurring record this month with same description
    const existing = await prisma.overheadCost.findFirst({
      where: {
        isRecurring: false,
        description: cost.description,
        effectiveDate: {
          gte: firstOfMonth,
          lte: endOfMonth,
        },
      },
    });

    if (existing) continue;

    // 3b. Compute amount
    let amount = cost.amount;
    if (cost.autoIncrease && currentMonth === cost.increaseMonth) {
      amount = cost.amount * (1 + (cost.increaseRate ?? 0));
    }

    // 3c. Create generated instance
    await prisma.overheadCost.create({
      data: {
        category: cost.category,
        description: cost.description,
        notes: cost.notes,
        isRecurring: false,
        effectiveDate: firstOfMonth,
        amount,
        createdById: cost.createdById,
      },
    });

    generated++;
    total += amount;
  }

  // 5. Send summary email to ADMIN users
  const FROM = process.env.EMAIL_FROM;
  const PASS = process.env.GMAIL_APP_PASSWORD;
  if (FROM && PASS && generated > 0) {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { email: true },
    });
    const toAddrs = admins.map((a) => a.email).filter(Boolean) as string[];
    if (toAddrs.length > 0) {
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: FROM, pass: PASS },
      });
      const totalFmt = total.toLocaleString("en-US", { minimumFractionDigits: 2 });
      await transport.sendMail({
        from: FROM,
        to: toAddrs.join(", "),
        cc: SAM_CC,
        subject: `Monthly Overhead Generated — $${totalFmt} for ${monthLabel}`,
        text: `Generated ${generated} overhead cost records for ${monthLabel}.\n\nTotal: $${totalFmt}\n\nReview at https://oak-ridge-pm.vercel.app/admin/overhead`,
      });
    }
  }

  // 6. Return result
  return NextResponse.json({ generated, total });
}
