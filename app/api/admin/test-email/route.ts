export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM;
const PASS = process.env.GMAIL_APP_PASSWORD;
const SAM_CC = "sam@oakridgeelectrical.com";

export async function POST() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  if (!FROM || !PASS) {
    return NextResponse.json({ error: "Email not configured (EMAIL_FROM or GMAIL_APP_PASSWORD missing)" }, { status: 400 });
  }

  const admins = await prisma.user.findMany({
    where: { active: true, role: "ADMIN" },
    select: { email: true },
  });
  const toList = admins.map((u) => u.email).filter(Boolean);
  if (toList.length === 0) {
    return NextResponse.json({ error: "No active admin users found" }, { status: 400 });
  }

  const cc = toList.includes(SAM_CC) ? undefined : SAM_CC;
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: FROM, pass: PASS },
  });

  try {
    const info = await transport.sendMail({
      from: `"Oak Ridge PM" <${FROM}>`,
      to: toList.join(", "),
      cc,
      subject: "Oak Ridge PM — Test Email ✓",
      text: "This is a test email from Oak Ridge PM. Email delivery is working correctly.",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
          <div style="margin-bottom:20px">
            <span style="font-size:13px;font-weight:700;color:#FF5910;text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
          </div>
          <h2 style="font-size:20px;color:#1e3a8a;margin:0 0 12px">✓ Email is working</h2>
          <p style="margin:0 0 16px">This is a test email from Oak Ridge PM. Email delivery is configured and working correctly.</p>
          <p style="font-size:12px;color:#888;margin:0">Sent: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} EST</p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
          <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical Project Management</p>
        </div>
      `,
    });
    return NextResponse.json({ ok: true, messageId: info.messageId, recipients: toList.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
