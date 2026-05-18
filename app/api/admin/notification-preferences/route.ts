import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  // Return preferences merged with defaults (all true)
  const NOTIFICATION_TYPES = [
    "stock_order_sent",
    "stock_order_approval_needed",
    "co_submitted",
    "co_status_changed",
    "task_assigned",
    "task_completed",
    "note_posted",
    "inspection_failed",
    "rfi_answered",
    "calendar_reminder",
    "daily_report",
    "billing_reminder",
  ];

  const stored = (pref?.preferences as Record<string, boolean>) ?? {};
  const preferences: Record<string, boolean> = {};
  for (const type of NOTIFICATION_TYPES) {
    preferences[type] = stored[type] !== false; // default true
  }

  return NextResponse.json({ preferences });
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const body = await req.json();
  const { preferences } = body;

  if (!preferences || typeof preferences !== "object") {
    return new NextResponse("Invalid body", { status: 400 });
  }

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: { preferences },
    create: { userId: session.user.id, preferences },
  });

  return NextResponse.json({ ok: true, preferences: pref.preferences });
}
