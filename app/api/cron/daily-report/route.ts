export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { APP_URL } from "@/lib/app-url";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function isToday(d: Date | null | undefined): boolean {
  if (!d) return false;
  const now = new Date();
  const t = new Date(d);
  return t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate();
}

function isOverdue(d: Date | null | undefined): boolean {
  if (!d) return false;
  return new Date(d) < new Date(new Date().setHours(0, 0, 0, 0));
}

function wrap(body: string) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <div style="margin-bottom:20px">
    <span style="font-size:13px;font-weight:700;color:#FF5910;text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
    <h1 style="font-size:22px;font-weight:700;color:#002D72;margin:8px 0 4px">Daily Project Report</h1>
    <p style="font-size:13px;color:#888;margin:0">${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
    <a href="${APP_URL}" style="display:inline-block;margin-top:10px;font-size:12px;color:#002D72;text-decoration:none">→ Open Oak Ridge PM</a>
  </div>
  ${body}
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
  <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical Project Management · Daily Report</p>
</div>`;
}

function section(title: string, color: string, content: string) {
  return `
<div style="margin-bottom:24px">
  <h2 style="font-size:14px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px;padding-bottom:6px;border-bottom:2px solid ${color}20">${title}</h2>
  ${content}
</div>`;
}

function row(label: string, sub: string, link?: string) {
  const inner = `
    <div style="padding:8px 12px;background:#f9f9f9;border-radius:6px;margin-bottom:4px">
      <p style="margin:0;font-size:13px;font-weight:600;color:#1a1a1a">${label}</p>
      <p style="margin:2px 0 0;font-size:12px;color:#666">${sub}</p>
    </div>`;
  return link ? `<a href="${link}" style="text-decoration:none">${inner}</a>` : inner;
}

function none() {
  return `<p style="font-size:13px;color:#aaa;margin:0;padding:8px 0">None</p>`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get admin emails
    const admins = await prisma.user.findMany({
      where: { active: true, role: "ADMIN" },
      select: { email: true },
    });
    if (admins.length === 0) {
      return NextResponse.json({ ok: true, message: "No admin users to report to." });
    }
    const adminEmails = admins.map((u) => u.email);

    // ── Gather data ───────────────────────────────────────────────────────────

    const [
      tasksDueToday,
      tasksOverdue,
      pendingCOs,
      inspectionsToday,
      failedInspections,
      calendarToday,
      openRfis,
      activeJobs,
    ] = await Promise.all([
      // Tasks due today (not completed)
      prisma.task.findMany({
        where: { status: { not: "COMPLETED" }, dueDate: { gte: startOfToday, lte: endOfToday } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } }, assignee: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),

      // Tasks overdue (past due, not completed)
      prisma.task.findMany({
        where: { status: { not: "COMPLETED" }, dueDate: { lt: startOfToday } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } }, assignee: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
      }),

      // Pending COs awaiting approval
      prisma.changeOrder.findMany({
        where: { status: "PENDING" },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } }, requestedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      }),

      // Inspections scheduled today
      prisma.inspection.findMany({
        where: { dateScheduled: { gte: startOfToday, lte: endOfToday } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
      }),

      // Failed inspections in last 24h
      prisma.inspection.findMany({
        where: { result: "FAIL", updatedAt: { gte: oneDayAgo } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
      }),

      // Calendar events today across all active jobs
      prisma.calendarEvent.findMany({
        where: { date: { gte: startOfToday, lte: endOfToday }, job: { status: { in: ["ACTIVE", "ON_HOLD"] } } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
      }),

      // Open RFIs older than 7 days with no answer
      prisma.rfi.findMany({
        where: { status: "OPEN", createdAt: { lte: sevenDaysAgo } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
        orderBy: { createdAt: "asc" },
      }),

      // All active/on-hold jobs with financial data for budget alerts
      prisma.job.findMany({
        where: { status: { in: ["ACTIVE", "ON_HOLD"] }, archived: false },
        select: {
          id: true, jobName: true, jobNumber: true,
          laborBudgetHours: true, materialBudget: true,
          laborEntries: { select: { hours: true } },
          materials: { select: { amount: true } },
        },
      }),
    ]);

    // ── Budget alerts ─────────────────────────────────────────────────────────

    const laborAlerts: { job: typeof activeJobs[0]; pct: number }[] = [];
    const materialAlerts: { job: typeof activeJobs[0]; pct: number }[] = [];

    for (const job of activeJobs) {
      if (job.laborBudgetHours && job.laborBudgetHours > 0) {
        const used = job.laborEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
        const pct = (used / job.laborBudgetHours) * 100;
        if (pct >= 80) laborAlerts.push({ job, pct });
      }
      if (job.materialBudget) {
        const budget = (job.materialBudget as any).toNumber ? (job.materialBudget as any).toNumber() : Number(job.materialBudget);
        if (budget > 0) {
          const spent = job.materials.reduce((s, m) => s + ((m.amount as any).toNumber ? (m.amount as any).toNumber() : Number(m.amount)), 0);
          const pct = (spent / budget) * 100;
          if (pct >= 80) materialAlerts.push({ job, pct });
        }
      }
    }

    // ── Build HTML ────────────────────────────────────────────────────────────

    const jobLink = (id: string) => `${APP_URL}/jobs/${id}`;

    const sections: string[] = [];

    // Tasks Due Today
    sections.push(section("📋 Tasks Due Today", "#002D72",
      tasksDueToday.length === 0 ? none() :
      tasksDueToday.map((t) => row(
        t.title,
        `${t.job.jobNumber} — ${t.job.jobName}${t.assignee?.name ? ` · ${t.assignee.name}` : ""}`,
        jobLink(t.job.id)
      )).join("")
    ));

    // Overdue Tasks
    sections.push(section("⚠️ Overdue Tasks", "#dc2626",
      tasksOverdue.length === 0 ? none() :
      tasksOverdue.map((t) => row(
        `${t.title}${t.dueDate ? ` — due ${fmtDate(t.dueDate)}` : ""}`,
        `${t.job.jobNumber} — ${t.job.jobName}${t.assignee?.name ? ` · ${t.assignee.name}` : ""}`,
        jobLink(t.job.id)
      )).join("")
    ));

    // Pending Change Orders
    sections.push(section("🔄 Change Orders Pending Approval", "#FF5910",
      pendingCOs.length === 0 ? none() :
      pendingCOs.map((co) => row(
        `CO #${co.coNumber ?? "?"}${co.description.length > 60 ? " — " + co.description.slice(0, 60) + "…" : " — " + co.description}`,
        `${co.job.jobNumber} — ${co.job.jobName} · Submitted by ${co.requestedBy.name ?? "Unknown"}`,
        jobLink(co.job.id)
      )).join("")
    ));

    // Inspections Today
    sections.push(section("🔍 Inspections Scheduled Today", "#7c3aed",
      inspectionsToday.length === 0 ? none() :
      inspectionsToday.map((ins) => row(
        ins.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        `${ins.job.jobNumber} — ${ins.job.jobName}`,
        jobLink(ins.job.id)
      )).join("")
    ));

    // Failed Inspections (last 24h)
    sections.push(section("❌ Failed Inspections (Last 24 Hours)", "#dc2626",
      failedInspections.length === 0 ? none() :
      failedInspections.map((ins) => row(
        ins.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " — FAILED",
        `${ins.job.jobNumber} — ${ins.job.jobName}`,
        jobLink(ins.job.id)
      )).join("")
    ));

    // Calendar Events Today
    sections.push(section("📅 Calendar Events Today", "#002D72",
      calendarToday.length === 0 ? none() :
      calendarToday.map((ev) => row(
        ev.title,
        ev.job ? `${ev.job.jobNumber} — ${ev.job.jobName}` : "Company-wide",
        ev.job ? jobLink(ev.job.id) : undefined
      )).join("")
    ));

    // Open RFIs >7 days
    sections.push(section("❓ Open RFIs (No Response > 7 Days)", "#b45309",
      openRfis.length === 0 ? none() :
      openRfis.map((rfi) => row(
        `RFI-${String(rfi.rfiNumber).padStart(3, "0")} — ${rfi.subject}`,
        `${rfi.job.jobNumber} — ${rfi.job.jobName} · Open since ${fmtDate(rfi.createdAt)}`,
        jobLink(rfi.job.id)
      )).join("")
    ));

    // Labor Budget Alerts
    sections.push(section("⏱ Labor Budget Alerts (≥80% Used)", "#b45309",
      laborAlerts.length === 0 ? none() :
      laborAlerts.map(({ job, pct }) => row(
        `${job.jobNumber} — ${job.jobName}`,
        `${pct.toFixed(0)}% of labor budget hours used`,
        jobLink(job.id)
      )).join("")
    ));

    // Material Budget Alerts
    sections.push(section("📦 Material Budget Alerts (≥80% Spent)", "#b45309",
      materialAlerts.length === 0 ? none() :
      materialAlerts.map(({ job, pct }) => row(
        `${job.jobNumber} — ${job.jobName}`,
        `${pct.toFixed(0)}% of material budget spent`,
        jobLink(job.id)
      )).join("")
    ));

    const html = wrap(sections.join(""));

    const text = [
      `Daily Project Report — ${new Date().toLocaleDateString("en-US")}`,
      `\nTasks Due Today: ${tasksDueToday.length}`,
      `Overdue Tasks: ${tasksOverdue.length}`,
      `Pending COs: ${pendingCOs.length}`,
      `Inspections Today: ${inspectionsToday.length}`,
      `Failed Inspections (24h): ${failedInspections.length}`,
      `Calendar Events Today: ${calendarToday.length}`,
      `Open RFIs >7 days: ${openRfis.length}`,
      `Labor Budget Alerts: ${laborAlerts.length}`,
      `Material Budget Alerts: ${materialAlerts.length}`,
      `\n${APP_URL}`,
    ].join("\n");

    // ── Send ──────────────────────────────────────────────────────────────────

    const FROM = process.env.EMAIL_FROM;
    const PASS = process.env.GMAIL_APP_PASSWORD;
    if (!FROM || !PASS) {
      console.error("[daily-report] Email env vars not set — report not sent.");
      return NextResponse.json({ ok: false, error: "Email not configured." });
    }

    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: FROM, pass: PASS },
    });

    await transport.sendMail({
      from: `"Oak Ridge PM" <${FROM}>`,
      to: adminEmails.join(", "),
      subject: `Daily Report — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      text,
      html,
    });

    console.log(`[daily-report] ✓ sent to ${adminEmails.join(", ")}`);
    return NextResponse.json({ ok: true, sent_to: adminEmails });
  } catch (err) {
    console.error("[daily-report] Error:", err);
    return new NextResponse(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
