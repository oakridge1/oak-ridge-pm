import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/app-url";

const FROM = process.env.EMAIL_FROM;
const PASS = process.env.GMAIL_APP_PASSWORD;

function getTransport() {
  if (!FROM || !PASS) {
    console.warn("[notifications] EMAIL_FROM or GMAIL_APP_PASSWORD not set — skipping email.");
    return null;
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: FROM, pass: PASS },
  });
}

async function send(to: string | string[], subject: string, text: string, html: string) {
  const transport = getTransport();
  if (!transport) return;
  const toList = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
  if (toList.length === 0) return;
  try {
    await transport.sendMail({
      from: `"Oak Ridge PM" <${FROM}>`,
      to: toList.join(", "),
      subject,
      text,
      html,
    });
    console.log(`[notifications] sent "${subject}" → ${toList.join(", ")}`);
  } catch (err) {
    console.error("[notifications] send error:", err);
  }
}

async function getAdminOfficeEmails(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "OFFICE"] } },
    select: { email: true },
  });
  return users.map((u) => u.email);
}

function jobUrl(jobId: string) {
  return `${APP_URL}/jobs/${jobId}`;
}

function wrap(body: string) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <div style="margin-bottom:20px">
    <span style="font-size:13px;font-weight:700;color:#FF5910;text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
  </div>
  ${body}
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
  <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical Project Management</p>
</div>`;
}

function btn(url: string, label: string, color = "#002D72") {
  return `<a href="${url}" style="display:inline-block;background:${color};color:#fff;font-weight:600;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">${label}</a>`;
}

// ── Task assigned ─────────────────────────────────────────────────────────────

export async function notifyTaskAssigned(params: {
  assigneeEmail: string;
  assigneeName: string | null;
  taskTitle: string;
  jobName: string;
  jobId: string;
  assignedBy: string;
}) {
  const { assigneeEmail, assigneeName, taskTitle, jobName, jobId, assignedBy } = params;
  const name = assigneeName ?? assigneeEmail;
  const url = jobUrl(jobId);
  await send(
    assigneeEmail,
    `Task assigned: ${taskTitle}`,
    `Hi ${name},\n\nYou've been assigned "${taskTitle}" on ${jobName}.\n\nAssigned by: ${assignedBy}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#002D72;margin:0 0 12px">Task Assigned</h2>
      <p style="margin:0 0 8px">Hi <strong>${name}</strong>,</p>
      <p style="margin:0 0 16px">You've been assigned a task on <strong>${jobName}</strong>.</p>
      <div style="background:#f0f4ff;border-left:4px solid #002D72;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0">
        <strong>${taskTitle}</strong><br/>
        <span style="font-size:13px;color:#666">Assigned by: ${assignedBy}</span>
      </div>
      ${btn(url, "View Job →")}
    `)
  );
}

// ── Ball in court ─────────────────────────────────────────────────────────────

export async function notifyBallInCourt(params: {
  userEmails: string[];
  taskTitle: string;
  jobName: string;
  jobId: string;
  updatedBy: string;
}) {
  const { userEmails, taskTitle, jobName, jobId, updatedBy } = params;
  if (userEmails.length === 0) return;
  const url = jobUrl(jobId);
  await send(
    userEmails,
    `Action needed: ${taskTitle}`,
    `The ball is in your court on "${taskTitle}" for ${jobName}.\n\nUpdated by: ${updatedBy}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#FF5910;margin:0 0 12px">Ball In Your Court</h2>
      <p style="margin:0 0 16px">Your action is needed on a task for <strong>${jobName}</strong>.</p>
      <div style="background:#fff8f5;border-left:4px solid #FF5910;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0">
        <strong>${taskTitle}</strong><br/>
        <span style="font-size:13px;color:#666">Updated by: ${updatedBy}</span>
      </div>
      ${btn(url, "View Task →", "#FF5910")}
    `)
  );
}

// ── Task completed ────────────────────────────────────────────────────────────

export async function notifyTaskCompleted(params: {
  taskTitle: string;
  jobName: string;
  jobId: string;
  completedBy: string;
}) {
  const { taskTitle, jobName, jobId, completedBy } = params;
  const url = jobUrl(jobId);
  const emails = await getAdminOfficeEmails();
  if (emails.length === 0) return;
  await send(
    emails,
    `Task completed: ${taskTitle}`,
    `"${taskTitle}" on ${jobName} was completed by ${completedBy}.\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#16a34a;margin:0 0 12px">✓ Task Completed</h2>
      <p style="margin:0 0 16px">A task on <strong>${jobName}</strong> has been marked complete.</p>
      <div style="background:#f0fff4;border-left:4px solid #16a34a;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0">
        <strong>${taskTitle}</strong><br/>
        <span style="font-size:13px;color:#666">Completed by: ${completedBy}</span>
      </div>
      ${btn(url, "View Job →")}
    `)
  );
}

// ── CO submitted ──────────────────────────────────────────────────────────────

export async function notifyCoSubmitted(params: {
  jobName: string;
  jobId: string;
  coNumber: number | null;
  description: string;
  submittedBy: string;
}) {
  const { jobName, jobId, coNumber, description, submittedBy } = params;
  const url = jobUrl(jobId);
  const emails = await getAdminOfficeEmails();
  if (emails.length === 0) return;
  const label = coNumber != null ? `CO #${coNumber}` : "Change Order";
  await send(
    emails,
    `${label} submitted — ${jobName}`,
    `${label} submitted on ${jobName} by ${submittedBy}.\n\n${description}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#002D72;margin:0 0 12px">Change Order Submitted</h2>
      <p style="margin:0 0 16px"><strong>${label}</strong> was submitted on <strong>${jobName}</strong> by ${submittedBy}.</p>
      <div style="background:#f0f4ff;border-left:4px solid #002D72;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0">
        <p style="margin:0;font-size:14px">${description}</p>
      </div>
      ${btn(url, "Review CO →")}
    `)
  );
}

// ── CO approved / rejected ────────────────────────────────────────────────────

export async function notifyCoReviewed(params: {
  requesterEmail: string;
  requesterName: string | null;
  jobName: string;
  jobId: string;
  coNumber: number | null;
  status: "APPROVED" | "REJECTED";
  adminNotes: string | null;
  approvedValue: number | null;
}) {
  const { requesterEmail, requesterName, jobName, jobId, coNumber, status, adminNotes, approvedValue } = params;
  const name = requesterName ?? requesterEmail;
  const url = jobUrl(jobId);
  const label = coNumber != null ? `CO #${coNumber}` : "Change Order";
  const approved = status === "APPROVED";
  const color = approved ? "#16a34a" : "#dc2626";
  const word = approved ? "Approved" : "Rejected";
  const valueLine = approved && approvedValue != null
    ? `<p style="margin:4px 0 0;font-size:13px;color:#555">Approved value: <strong>$${approvedValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong></p>`
    : "";
  const noteLine = adminNotes
    ? `<p style="margin:6px 0 0;font-size:13px;color:#444"><em>${adminNotes}</em></p>`
    : "";
  await send(
    requesterEmail,
    `${label} ${word.toLowerCase()} — ${jobName}`,
    `Hi ${name},\n\n${label} on ${jobName} has been ${word.toLowerCase()}.\n\n${adminNotes ?? ""}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:${color};margin:0 0 12px">Change Order ${word}</h2>
      <p style="margin:0 0 16px">Hi <strong>${name}</strong>, your <strong>${label}</strong> on <strong>${jobName}</strong> has been <strong style="color:${color}">${word.toLowerCase()}</strong>.</p>
      ${valueLine}${noteLine}
      <br/>
      ${btn(url, "View Job →")}
    `)
  );
}

// ── New note (field → admin/office) ──────────────────────────────────────────

export async function notifyNewNote(params: {
  jobName: string;
  jobId: string;
  content: string;
  postedBy: string;
  posterRole: string;
}) {
  const { jobName, jobId, content, postedBy, posterRole } = params;
  if (posterRole !== "FIELD") return;
  const url = jobUrl(jobId);
  const emails = await getAdminOfficeEmails();
  if (emails.length === 0) return;
  const preview = content.length > 200 ? content.slice(0, 200) + "…" : content;
  await send(
    emails,
    `New field note — ${jobName}`,
    `${postedBy} posted a note on ${jobName}:\n\n${preview}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#002D72;margin:0 0 12px">New Field Note</h2>
      <p style="margin:0 0 16px"><strong>${postedBy}</strong> posted a note on <strong>${jobName}</strong>.</p>
      <div style="background:#f0f4ff;border-left:4px solid #002D72;padding:12px 16px;margin:0 0 16px;border-radius:0 6px 6px 0">
        <p style="margin:0;font-size:14px;line-height:1.6">${preview}</p>
      </div>
      ${btn(url, "View Job →")}
    `)
  );
}

// ── Inspection failed ─────────────────────────────────────────────────────────

export async function notifyInspectionFailed(params: {
  jobName: string;
  jobId: string;
  inspectionType: string;
  inspectorName: string | null;
  correctionNotes: string | null;
  loggedBy: string;
}) {
  const { jobName, jobId, inspectionType, inspectorName, correctionNotes, loggedBy } = params;
  const url = jobUrl(jobId);
  const emails = await getAdminOfficeEmails();
  if (emails.length === 0) return;
  const typeLabel = inspectionType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const correctionsHtml = correctionNotes
    ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;margin:8px 0 0;border-radius:0 6px 6px 0">
        <p style="margin:0;font-size:13px;color:#444"><strong>Corrections needed:</strong><br/>${correctionNotes}</p>
      </div>`
    : "";
  await send(
    emails,
    `Inspection FAILED — ${typeLabel} — ${jobName}`,
    `Inspection failed on ${jobName}.\nType: ${typeLabel}\nInspector: ${inspectorName ?? "Unknown"}\nLogged by: ${loggedBy}\n\n${correctionNotes ?? ""}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#dc2626;margin:0 0 12px">⚠ Inspection Failed</h2>
      <p style="margin:0 0 16px">An inspection <strong style="color:#dc2626">failed</strong> on <strong>${jobName}</strong>.</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 6px 6px 0">
        <strong>${typeLabel}</strong><br/>
        <span style="font-size:13px;color:#666">Inspector: ${inspectorName ?? "Not specified"}</span><br/>
        <span style="font-size:13px;color:#666">Logged by: ${loggedBy}</span>
      </div>
      ${correctionsHtml}
      <br/>
      ${btn(url, "View Inspection →")}
    `)
  );
}

// ── RFI answered ──────────────────────────────────────────────────────────────

export async function notifyRfiAnswered(params: {
  submitterEmail: string;
  submitterName: string | null;
  jobName: string;
  jobId: string;
  rfiNumber: number;
  subject: string;
  answer: string | null;
}) {
  const { submitterEmail, submitterName, jobName, jobId, rfiNumber, subject, answer } = params;
  const name = submitterName ?? submitterEmail;
  const url = jobUrl(jobId);
  const rfiLabel = `RFI-${String(rfiNumber).padStart(3, "0")}`;
  const answerHtml = answer
    ? `<div style="background:#f0fff4;border-left:4px solid #16a34a;padding:12px 16px;margin:8px 0 0;border-radius:0 6px 6px 0">
        <p style="margin:0;font-size:13px;color:#444">${answer}</p>
      </div>`
    : "";
  await send(
    submitterEmail,
    `${rfiLabel} answered — ${jobName}`,
    `Hi ${name},\n\n${rfiLabel} "${subject}" on ${jobName} has been answered.\n\n${answer ?? ""}\n\n${url}`,
    wrap(`
      <h2 style="font-size:18px;color:#002D72;margin:0 0 12px">RFI Answered</h2>
      <p style="margin:0 0 16px">Hi <strong>${name}</strong>, <strong>${rfiLabel}</strong> on <strong>${jobName}</strong> has been answered.</p>
      <div style="background:#f0f4ff;border-left:4px solid #002D72;padding:12px 16px;border-radius:0 6px 6px 0">
        <strong>${subject}</strong>
      </div>
      ${answerHtml}
      <br/>
      ${btn(url, "View RFI →")}
    `)
  );
}
