export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Placeholder endpoint for manual receipt reminders.
// In a full implementation this would send an email/notification to the specified users.

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { userIds, message } = body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "No users selected" }, { status: 400 });
  }

  // TODO: integrate with email/notification system once available
  // For now, acknowledge the request
  return NextResponse.json({
    ok: true,
    sent: userIds.length,
    message: `Reminder sent to ${userIds.length} user${userIds.length !== 1 ? "s" : ""}.`,
  });
}
