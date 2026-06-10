export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { APP_URL } from "@/lib/app-url";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function wrap(body: string, title: string, date: string) {
  return `
<div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
  <div style="margin-bottom:20px">
    <span style="font-size:13px;font-weight:700;color:#FF5910;text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
    <h1 style="font-size:22px;font-weight:700;color:#1e3a8a;margin:8px 0 4px">${title}</h1>
    <p style="font-size:13px;color:#888;margin:0">${date}</p>
    <a href="${APP_URL}" style="display:inline-block;margin-top:10px;font-size:12px;color:#1e3a8a;text-decoration:none">→ Open Oak Ridge PM</a>
  </div>
  ${body}
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
  <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical Project Management</p>
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

function createTransport(FROM: string, PASS: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com", port: 587, secure: false,
    auth: { user: FROM, pass: PASS },
  });
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

    // Today (for tasks, calendar, inspections, RFIs, budget alerts)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // Yesterday (for activity data: labor, materials, notes, failed inspections)
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get admin emails
    const admins = await prisma.user.findMany({
      where: { active: true, role: "ADMIN" },
      select: { email: true },
    });
    if (admins.length === 0) {
      return NextResponse.json({ ok: true, message: "No admin users to report to." });
    }
    const adminEmails = admins.map((u) => u.email);

    // ── Gather admin report data ──────────────────────────────────────────────

    const [
      tasksDueToday,
      tasksOverdue,
      pendingCOs,
      inspectionsToday,
      failedInspectionsYesterday,
      calendarToday,
      openRfis,
      activeJobs,
      laborYesterday,
      materialsYesterday,
      notesYesterday,
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

      // Failed inspections yesterday
      prisma.inspection.findMany({
        where: { result: "FAIL", updatedAt: { gte: startOfYesterday, lte: endOfYesterday } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
      }),

      // Calendar events today
      prisma.calendarEvent.findMany({
        where: { date: { gte: startOfToday, lte: endOfToday }, job: { status: { in: ["ACTIVE", "ON_HOLD"] } } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
      }),

      // Open RFIs older than 7 days
      prisma.rfi.findMany({
        where: { status: "OPEN", createdAt: { lte: sevenDaysAgo } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
        orderBy: { createdAt: "asc" },
      }),

      // Active/on-hold jobs with financial data
      prisma.job.findMany({
        where: { status: { in: ["ACTIVE", "ON_HOLD"] }, archived: false },
        select: {
          id: true, jobName: true, jobNumber: true,
          laborBudgetDollars: true, blendedLaborRate: true, materialBudget: true,
          laborEntries: { select: { hours: true } },
          materials: { select: { amount: true } },
        },
      }),

      // Labor logged yesterday
      prisma.laborEntry.findMany({
        where: { date: { gte: startOfYesterday, lte: endOfYesterday } },
        include: {
          job: { select: { id: true, jobName: true, jobNumber: true } },
          user: { select: { name: true } },
        },
        orderBy: [{ job: { jobNumber: "asc" } }, { user: { name: "asc" } }],
      }),

      // Materials entered yesterday
      prisma.material.findMany({
        where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday } },
        include: { job: { select: { id: true, jobName: true, jobNumber: true } } },
        orderBy: { job: { jobNumber: "asc" } },
      }),

      // Notes posted yesterday
      prisma.note.findMany({
        where: { createdAt: { gte: startOfYesterday, lte: endOfYesterday } },
        include: {
          job: { select: { id: true, jobName: true, jobNumber: true } },
          user: { select: { name: true } },
        },
        orderBy: { job: { jobNumber: "asc" } },
      }),
    ]);

    // ── Budget alerts ─────────────────────────────────────────────────────────

    const laborAlerts: { job: typeof activeJobs[0]; pct: number }[] = [];
    const materialAlerts: { job: typeof activeJobs[0]; pct: number }[] = [];

    for (const job of activeJobs) {
      if (job.laborBudgetDollars && Number(job.laborBudgetDollars) > 0) {
        const usedHours = job.laborEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
        const rate = job.blendedLaborRate ? Number(job.blendedLaborRate) : 0;
        const usedDollars = usedHours * rate;
        const budget = Number(job.laborBudgetDollars);
        const pct = budget > 0 ? (usedDollars / budget) * 100 : 0;
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

    // ── Build admin email HTML ────────────────────────────────────────────────

    const jobLink = (id: string) => `${APP_URL}/jobs/${id}`;
    const yesterdayLabel = fmtDate(yesterday);
    const todayLabel = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const sections: string[] = [];

    // Hours Logged Yesterday — group by job
    const laborByJob = laborYesterday.reduce<Record<string, { job: typeof laborYesterday[0]["job"]; entries: typeof laborYesterday }>>(
      (acc, e) => {
        if (!acc[e.jobId]) acc[e.jobId] = { job: e.job, entries: [] };
        acc[e.jobId].entries.push(e);
        return acc;
      },
      {}
    );
    sections.push(section(`⏱ Hours Logged (${yesterdayLabel})`, "#1e3a8a",
      Object.keys(laborByJob).length === 0 ? none() :
      Object.values(laborByJob).map(({ job, entries }) => {
        const totalHrs = entries.reduce((s, e) => s + e.hours, 0);
        const crew = entries.map(e => `${e.user.name ?? "?"} (${e.hours}h)`).join(", ");
        return row(`${job.jobNumber} — ${job.jobName}`, `${totalHrs.toFixed(1)} hrs · ${crew}`, jobLink(job.id));
      }).join("")
    ));

    // Materials Yesterday — group by job
    const matByJob = materialsYesterday.reduce<Record<string, { job: typeof materialsYesterday[0]["job"]; entries: typeof materialsYesterday }>>(
      (acc, m) => {
        if (!acc[m.jobId]) acc[m.jobId] = { job: m.job, entries: [] };
        acc[m.jobId].entries.push(m);
        return acc;
      },
      {}
    );
    sections.push(section(`📦 Materials Entered (${yesterdayLabel})`, "#7c3aed",
      Object.keys(matByJob).length === 0 ? none() :
      Object.values(matByJob).map(({ job, entries }) => {
        const total = entries.reduce((s, m) => s + ((m.amount as any).toNumber ? (m.amount as any).toNumber() : Number(m.amount)), 0);
        const descs = entries.map(e => e.description).join(", ");
        return row(`${job.jobNumber} — ${job.jobName}`, `$${total.toFixed(2)} · ${descs}`, jobLink(job.id));
      }).join("")
    ));

    // Notes Yesterday
    sections.push(section(`📝 Notes Posted (${yesterdayLabel})`, "#374151",
      notesYesterday.length === 0 ? none() :
      notesYesterday.map((n) => row(
        `${n.job.jobNumber} — ${n.job.jobName}`,
        `${n.user.name ?? "?"}: ${n.content.length > 100 ? n.content.slice(0, 100) + "…" : n.content}`,
        jobLink(n.job.id)
      )).join("")
    ));

    // Tasks Due Today
    sections.push(section("📋 Tasks Due Today", "#1e3a8a",
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

    // Failed Inspections Yesterday
    sections.push(section(`❌ Failed Inspections (${yesterdayLabel})`, "#dc2626",
      failedInspectionsYesterday.length === 0 ? none() :
      failedInspectionsYesterday.map((ins) => row(
        ins.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " — FAILED",
        `${ins.job.jobNumber} — ${ins.job.jobName}`,
        jobLink(ins.job.id)
      )).join("")
    ));

    // Calendar Events Today
    sections.push(section("📅 Calendar Events Today", "#1e3a8a",
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

    const html = wrap(sections.join(""), "Daily Project Report", todayLabel);

    const text = [
      `Daily Project Report — ${todayLabel}`,
      `\n--- ${yesterdayLabel} Activity ---`,
      `Hours Logged: ${laborYesterday.length} entries across ${Object.keys(laborByJob).length} jobs`,
      `Materials Entered: ${materialsYesterday.length}`,
      `Notes Posted: ${notesYesterday.length}`,
      `\n--- Today ---`,
      `Tasks Due Today: ${tasksDueToday.length}`,
      `Overdue Tasks: ${tasksOverdue.length}`,
      `Pending COs: ${pendingCOs.length}`,
      `Inspections Today: ${inspectionsToday.length}`,
      `Failed Inspections (Yesterday): ${failedInspectionsYesterday.length}`,
      `Calendar Events Today: ${calendarToday.length}`,
      `Open RFIs >7 days: ${openRfis.length}`,
      `Labor Budget Alerts: ${laborAlerts.length}`,
      `Material Budget Alerts: ${materialAlerts.length}`,
      `\n${APP_URL}`,
    ].join("\n");

    // ── Send admin report ─────────────────────────────────────────────────────

    const FROM = process.env.EMAIL_FROM;
    const PASS = process.env.GMAIL_APP_PASSWORD;
    if (!FROM || !PASS) {
      console.error("[daily-report] Email env vars not set — report not sent.");
      return NextResponse.json({ ok: false, error: "Email not configured." });
    }

    const transport = createTransport(FROM, PASS);

    await transport.sendMail({
      from: `"Oak Ridge PM" <${FROM}>`,
      to: adminEmails.join(", "),
      subject: `Daily Report — ${now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
      text,
      html,
    });

    console.log(`[daily-report] ✓ admin report sent to ${adminEmails.join(", ")}`);

    // ── Contractor Payment Reminders ──────────────────────────────────────────

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    const twoDaysFromNowEnd = new Date(twoDaysFromNow);
    twoDaysFromNowEnd.setHours(23, 59, 59, 999);
    twoDaysFromNow.setHours(0, 0, 0, 0);

    // Get the most recent payment per contractor (within last 30 days)
    const recentPayments = await prisma.contractorPayment.findMany({
      where: { paymentDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { paymentDate: "desc" },
      distinct: ["userId"],
    });

    const paymentsComingDue = recentPayments.filter((p) => {
      const nextDue = new Date(p.paymentDate);
      nextDue.setDate(nextDue.getDate() + 14);
      return nextDue >= twoDaysFromNow && nextDue <= twoDaysFromNowEnd;
    });

    if (paymentsComingDue.length > 0) {
      // Fetch admin users with IDs for notification preference lookup
      const adminUsersWithId = await prisma.user.findMany({
        where: { active: true, role: "ADMIN" },
        select: { id: true, email: true },
      });

      // Check which admins have contractor_payment_due notifications enabled
      const adminPrefs = await prisma.notificationPreference.findMany({
        where: { userId: { in: adminUsersWithId.map((a) => a.id) } },
      });

      // Build set of admin IDs that have opted out
      const optedOut = new Set(
        adminPrefs
          .filter((pref) => {
            const prefs = pref.preferences as Record<string, boolean>;
            return prefs["contractor_payment_due"] === false;
          })
          .map((pref) => pref.userId)
      );

      const notifyEmails = adminUsersWithId
        .filter((a) => !optedOut.has(a.id))
        .map((a) => a.email);

      if (notifyEmails.length > 0) {
        const reminderRows = paymentsComingDue
          .map((p) => {
            const nextDue = new Date(p.paymentDate);
            nextDue.setDate(nextDue.getDate() + 14);
            return row(
              p.user.name ?? p.user.email,
              `$${p.amountUSD.toFixed(2)} USD — due ${fmtDate(nextDue)}`
            );
          })
          .join("");

        const reminderHtml = wrap(
          section("💸 Contractor Payments Due in 2 Days", "#1e3a8a", reminderRows),
          "Contractor Payment Reminder",
          now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        );

        await transport.sendMail({
          from: `"Oak Ridge PM" <${FROM}>`,
          to: notifyEmails.join(", "),
          subject: `Contractor Payment Reminder — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          text: `Contractor payments due in 2 days:\n${paymentsComingDue.map((p) => `- ${p.user.name}: $${p.amountUSD}`).join("\n")}`,
          html: reminderHtml,
        });

        console.log(`[daily-report] ✓ contractor payment reminder sent for ${paymentsComingDue.length} contractor(s)`);
      }
    }

    // ── Per-Foreman per-job daily emails (Step 10) ────────────────────────────

    // Get all active foremen with their assigned active jobs
    const foremen = await prisma.user.findMany({
      where: { active: true, role: "FOREMAN" },
      select: {
        id: true, name: true, email: true,
        foremanJobs: {
          where: { status: { in: ["ACTIVE", "ON_HOLD"] }, archived: false },
          select: {
            id: true, jobName: true, jobNumber: true,
            contractValue: true, blendedLaborRate: true, laborBudgetDollars: true,
            scopeOfWork: true,
            laborEntries: { select: { hours: true, date: true, user: { select: { name: true } } } },
            tasks: {
              where: { status: { not: "COMPLETED" }, dueDate: { lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
              select: { title: true, dueDate: true, assignee: { select: { name: true } } },
              orderBy: { dueDate: "asc" },
            },
            calendarEvents: {
              where: { date: { gte: startOfToday, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } },
              select: { title: true, date: true, type: true },
              orderBy: { date: "asc" },
            },
            rfis: {
              where: { status: "OPEN" },
              select: { rfiNumber: true, subject: true, createdAt: true },
            },
            inspections: {
              where: { dateScheduled: { gte: startOfToday } },
              select: { type: true, dateScheduled: true },
              orderBy: { dateScheduled: "asc" },
            },
          },
        },
      },
    });

    let foremanEmailCount = 0;
    for (const foreman of foremen) {
      for (const job of foreman.foremanJobs) {
        // Yesterday's labor on this job
        const yesterdayLabor = job.laborEntries.filter(e => {
          const d = new Date(e.date);
          return d >= startOfYesterday && d <= endOfYesterday;
        });
        const yesterdayHrs = yesterdayLabor.reduce((s, e) => s + e.hours, 0);
        const yesterdayCrew = yesterdayLabor.map(e => `${e.user.name ?? "?"} (${e.hours}h)`).join(", ");

        // Total hours + percent complete
        const totalHrs = job.laborEntries.reduce((s, e) => s + e.hours, 0);
        const rate = job.blendedLaborRate ? Number(job.blendedLaborRate) : 0;
        const laborCostToDate = totalHrs * rate;
        const budget = job.laborBudgetDollars ? Number(job.laborBudgetDollars) : 0;
        const pctComplete = budget > 0
          ? Math.round((laborCostToDate / budget) * 100)
          : null;

        // Open RFIs with days open
        const openRfiList = job.rfis.map(rfi => {
          const daysOpen = Math.floor((now.getTime() - new Date(rfi.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          return `RFI-${String(rfi.rfiNumber).padStart(3, "0")}: ${rfi.subject} (${daysOpen}d open)`;
        });

        const foremanSections: string[] = [];

        // Job header info
        foremanSections.push(`
<div style="background:#f0f4ff;border-radius:8px;padding:12px 16px;margin-bottom:16px">
  <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Job</p>
  <p style="margin:0;font-size:16px;font-weight:700;color:#1e3a8a">${job.jobName}</p>
  <p style="margin:2px 0 0;font-size:12px;color:#555">
    #${job.jobNumber}${pctComplete != null ? ` · ${pctComplete}% complete (${totalHrs.toFixed(1)} hrs logged)` : ` · ${totalHrs.toFixed(1)} hrs logged`}
  </p>
</div>`);

        // Yesterday's hours
        foremanSections.push(section(
          `Hours Yesterday (${yesterdayLabel})`, "#1e3a8a",
          yesterdayHrs === 0
            ? none()
            : row(`${yesterdayHrs.toFixed(1)} total hours`, yesterdayCrew || "No crew details")
        ));

        // Tasks due in 7 days
        foremanSections.push(section("Tasks Due in 7 Days", "#b45309",
          job.tasks.length === 0 ? none() :
          job.tasks.map(t => row(
            t.title,
            `${t.dueDate ? fmtDate(t.dueDate) : "No due date"}${t.assignee?.name ? ` · ${t.assignee.name}` : ""}`
          )).join("")
        ));

        // Calendar events in 7 days
        foremanSections.push(section("Upcoming Calendar Events", "#7c3aed",
          job.calendarEvents.length === 0 ? none() :
          job.calendarEvents.map(ev => row(ev.title, fmtDate(ev.date))).join("")
        ));

        // Open RFIs
        foremanSections.push(section("Open RFIs", "#dc2626",
          openRfiList.length === 0 ? none() :
          openRfiList.map(r => row(r, "Awaiting response")).join("")
        ));

        // Upcoming inspections
        const upcomingInspections = job.inspections.filter(i => i.dateScheduled);
        foremanSections.push(section("Upcoming Inspections", "#16a34a",
          upcomingInspections.length === 0 ? none() :
          upcomingInspections.map(i => row(
            i.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            i.dateScheduled ? fmtDate(i.dateScheduled) : "—"
          )).join("")
        ));

        const foremanHtml = wrap(
          foremanSections.join(""),
          `Daily Job Update — ${job.jobName}`,
          now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        );

        await transport.sendMail({
          from: `"Oak Ridge PM" <${FROM}>`,
          to: foreman.email,
          subject: `Daily Update: ${job.jobName} (${job.jobNumber}) — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
          text: `Daily Update — ${job.jobName}\n${job.jobNumber}\n${yesterdayHrs > 0 ? `Yesterday: ${yesterdayHrs}h (${yesterdayCrew})` : "No hours yesterday"}\n${APP_URL}/jobs/${job.id}`,
          html: foremanHtml,
        });
        foremanEmailCount++;
      }
    }

    console.log(`[daily-report] ✓ ${foremanEmailCount} foreman job emails sent`);
    return NextResponse.json({
      ok: true,
      sent_to: adminEmails,
      foreman_emails: foremanEmailCount,
    });
  } catch (err) {
    console.error("[daily-report] Error:", err);
    return new NextResponse(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
