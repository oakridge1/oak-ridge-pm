export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { APP_URL } from "@/lib/app-url";
import { BRAND_BLUE, BRAND_ORANGE } from "@/lib/company";

const NAVY = BRAND_BLUE;
const ORANGE = BRAND_ORANGE;

// Receipt upload reminder. Wired to two Vercel crons (Mon 11:00 UTC / Fri 19:00 UTC).
// The same route handles both — it checks the day of week against the toggles
// stored in CompanySettings (mondayReminder / fridayReminder).
export async function GET(request: Request) {
  // Auth check (matches billing-reminder)
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Read reminder settings from the singleton CompanySettings row.
  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  // Decide whether today's run should fire. Vercel crons run in UTC; getDay()
  // on the server is UTC. 1 = Monday, 5 = Friday.
  const now = new Date();
  const dow = now.getDay();
  const isMonday = dow === 1;
  const isFriday = dow === 5;

  const shouldFire =
    (isMonday && settings.mondayReminder) ||
    (isFriday && settings.fridayReminder);

  if (!shouldFire) {
    console.log(`[receipt-reminder] Day-of-week ${dow}: no enabled reminder for today. Skipping.`);
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `dow ${dow}; monday=${settings.mondayReminder} friday=${settings.fridayReminder}`,
    });
  }

  const dayLabel = isMonday ? "Monday" : "Friday";

  try {
    // Recipients: active field crew (foremen + teammates) who upload receipts.
    // The settings UI stores no recipient list, so we target everyone who
    // could have receipts to submit. (Manual one-off reminders pick specific
    // users via /api/admin/receipts/remind; this automated run is the crew-wide net.)
    const crew = await prisma.user.findMany({
      where: { active: true, role: { in: ["FOREMAN", "TEAMMATE"] } },
      select: { name: true, email: true },
    });

    const recipients = crew.map(c => c.email).filter((e): e is string => !!e);

    if (recipients.length === 0) {
      console.log("[receipt-reminder] No active crew recipients. Nothing to send.");
      return NextResponse.json({ ok: true, sent: 0, reason: "no recipients" });
    }

    const message = settings.reminderMessage || "Please upload any receipts before starting today.";

    const html = `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <div style="margin-bottom:24px">
    <span style="font-size:13px;font-weight:700;color:${ORANGE};text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
    <h1 style="font-size:22px;font-weight:700;color:${NAVY};margin:8px 0 4px">Receipt Reminder</h1>
    <p style="font-size:14px;color:#555;margin:0">${dayLabel} reminder</p>
  </div>
  <div style="padding:16px 20px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;margin-bottom:24px">
    <p style="margin:0;font-size:15px;font-weight:600;color:#92400e">${message}</p>
  </div>
  <a href="${APP_URL}" style="display:inline-block;padding:10px 20px;background:${NAVY};color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">
    → Upload Receipts
  </a>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
  <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical Project Management — Automated Receipt Reminder</p>
</div>`;

    const text = [
      `Receipt Reminder — ${dayLabel}`,
      ``,
      message,
      ``,
      `Upload here: ${APP_URL}`,
    ].join("\n");

    // Send email
    const FROM = process.env.EMAIL_FROM;
    const PASS = process.env.GMAIL_APP_PASSWORD;
    if (!FROM || !PASS) {
      console.error("[receipt-reminder] FATAL: EMAIL_FROM or GMAIL_APP_PASSWORD not set in environment variables.");
      return NextResponse.json({ ok: false, error: "Email not configured." }, { status: 500 });
    }

    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: FROM, pass: PASS },
    });

    const CC = "sam@oakridgeelectrical.com";

    await transport.sendMail({
      from: `"Oak Ridge PM" <${FROM}>`,
      to: FROM,                 // valid To; crew addressed via BCC
      bcc: recipients.join(", "),
      cc: CC,
      subject: `Receipt Reminder — ${dayLabel}`,
      text,
      html,
    });

    console.log(`[receipt-reminder] ✓ ${dayLabel} reminder sent to ${recipients.length} crew member(s).`);
    return NextResponse.json({ ok: true, day: dayLabel, sent: recipients.length });

  } catch (err) {
    console.error("[receipt-reminder] Error:", err);
    return new NextResponse(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
