import nodemailer from "nodemailer";
import { APP_URL } from "@/lib/app-url";

const FROM = process.env.EMAIL_FROM;
const PASS = process.env.GMAIL_APP_PASSWORD;
const SAM_CC = "sam@oakridgeelectrical.com";

function getTransport() {
  if (!FROM || !PASS) {
    console.warn("[email] EMAIL_FROM or GMAIL_APP_PASSWORD not set — skipping.");
    return null;
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: FROM, pass: PASS },
  });
}

export async function sendWelcomeEmail(to: string, name: string | null) {
  console.log(`[email] sendWelcomeEmail called → to=${to}`);

  const transport = getTransport();
  if (!transport) return;

  const displayName = name ?? to;
  const loginUrl = `${APP_URL}/login`;

  try {
    const info = await transport.sendMail({
      from: `"Oak Ridge Electrical" <${FROM}>`,
      to,
      cc: to !== SAM_CC ? SAM_CC : undefined,
      subject: "Your Oak Ridge PM account is active",
      text: [
        `Hi ${displayName},`,
        "",
        "Your Oak Ridge Electrical project management account has been activated.",
        "",
        `Sign in here: ${loginUrl}`,
        "",
        "Use your Google account that matches this email address to log in.",
        "",
        "— Oak Ridge Electrical LLC",
      ].join("\n"),
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
          <div style="margin-bottom:24px">
            <span style="font-size:13px;font-weight:700;color:#FF5910;text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
            <h1 style="font-size:22px;font-weight:700;color:#002D72;margin:6px 0 0">Your account is active</h1>
          </div>
          <p style="margin:0 0 16px">Hi <strong>${displayName}</strong>,</p>
          <p style="margin:0 0 24px">Your Oak Ridge Electrical project management account has been activated. You can now sign in using your Google account.</p>
          <a href="${loginUrl}"
             style="display:inline-block;background:#002D72;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
            Sign In →
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#888">
            Use the Google account associated with <strong>${to}</strong> to log in.
          </p>
          <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
          <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical LLC — ${APP_URL}</p>
        </div>
      `,
    });
    console.log("[email] ✓ Welcome email sent successfully:", info.messageId, "response:", info.response);
  } catch (err) {
    console.error("[email] ✗ Failed to send welcome email:");
    console.error(err);
    throw err;
  }
}
