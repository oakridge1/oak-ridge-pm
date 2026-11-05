import nodemailer from "nodemailer";
import {
  buildSummaryText, summarySubject, type SummaryInput,
} from "./cronHelpers";
import { isJobAllowed } from "./autologGuards";

// Summary email for the nightly auto-log. Same SMTP setup the other cron emails use
// (EMAIL_FROM + GMAIL_APP_PASSWORD). Does not touch lib/notifications.ts.
export const AUTO_LOG_SUMMARY_TO = "justin@oakridgeelectrical.com";
export const AUTO_LOG_SUMMARY_CC = "sam@oakridgeelectrical.com";

/** Throws on failure; the caller must catch so labor entries are never affected. */
export async function sendAutoLogSummary(summary: SummaryInput, allowlist: string[]): Promise<void> {
  const FROM = process.env.EMAIL_FROM;
  const PASS = process.env.GMAIL_APP_PASSWORD;
  if (!FROM || !PASS) throw new Error("EMAIL_FROM or GMAIL_APP_PASSWORD not set");

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: FROM, pass: PASS },
  });

  await transport.sendMail({
    from: `"Oak Ridge PM" <${FROM}>`,
    to: AUTO_LOG_SUMMARY_TO,
    cc: AUTO_LOG_SUMMARY_CC,
    subject: summarySubject(summary),
    text: buildSummaryText(summary, (jobNumber) => isJobAllowed(jobNumber, allowlist)),
  });
}
