export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { APP_URL } from "@/lib/app-url";
import { BRAND_BLUE, BRAND_ORANGE } from "@/lib/company";

const NAVY = BRAND_BLUE;
const ORANGE = BRAND_ORANGE;

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Date window check: only fire on the 15th through 23rd
  const now = new Date();
  const dayOfMonth = now.getDate();
  if (dayOfMonth < 15 || dayOfMonth > 23) {
    console.log(`[billing-reminder] Day ${dayOfMonth} is outside 15–23 window. Skipping.`);
    return NextResponse.json({ ok: true, skipped: true, reason: `day ${dayOfMonth} outside window` });
  }

  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  try {
    // Query all active jobs with billing data
    const jobs = await prisma.job.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "SUBMITTED", "BILLED", "ON_HOLD"] },
        archived:      false,
        excludeFromPL: false,
        isSystemJob:   false,
      },
      select: {
        id: true,
        jobNumber: true,
        jobName: true,
        contractValue: true,
        blendedLaborRate: true,
        laborMarkupPct: true,
        subcontractorCost: true,
        subMarkupPct: true,
        equipmentCost: true,
        equipmentBillPct: true,
        equipmentMarkupPct: true,
        otherCosts: true,
        foreman: { select: { name: true } },
        laborEntries: { select: { hours: true } },
        materials: { select: { amount: true } },
        changeOrders: {
          where: { status: "APPROVED" },
          select: { approvedValue: true },
        },
        invoices: {
          where: { status: { not: "DRAFT" } },
          select: { id: true, amount: true, date: true, status: true, retainagePct: true, retainageHeld: true },
          orderBy: { date: "desc" },
        },
        payments: {
          select: { amount: true, date: true },
          orderBy: { date: "desc" },
        },
      },
      orderBy: { jobNumber: "asc" },
    });

    // Compute billing data for each job
    type JobRow = {
      id: string;
      jobNumber: string;
      jobName: string;
      foremanName: string | null;
      contractValue: number;
      revisedContract: number;
      grossBilling: number;
      totalInvoiced: number;
      totalPaid: number;
      balanceRemaining: number;
      pctComplete: number;
      lastInvoiceDate: string | null;
      lastPaymentDate: string | null;
    };

    const rows: JobRow[] = [];

    for (const job of jobs) {
      const contractValue = (job.contractValue as any)?.toNumber?.() ?? Number(job.contractValue ?? 0);
      const approvedCOs = job.changeOrders.reduce((s, co) => s + ((co.approvedValue as any)?.toNumber?.() ?? Number(co.approvedValue ?? 0)), 0);
      const revisedContract = contractValue + approvedCOs;

      // Compute gross billing (same logic as Summary tab)
      const totalHours = job.laborEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
      const blendedRate = (job.blendedLaborRate as any)?.toNumber?.() ?? Number(job.blendedLaborRate ?? 0);
      const laborCost = blendedRate > 0 ? totalHours * blendedRate : 0;
      const materialsCost = job.materials.reduce((s, m) => s + ((m.amount as any)?.toNumber?.() ?? Number(m.amount ?? 0)), 0);
      const subCost = (job.subcontractorCost as any)?.toNumber?.() ?? Number(job.subcontractorCost ?? 0);
      const equipCost = (job.equipmentCost as any)?.toNumber?.() ?? Number(job.equipmentCost ?? 0);
      const equipBillPct = job.equipmentBillPct ?? 100;
      const equipBilled = equipCost * (equipBillPct / 100);
      const otherCosts = Array.isArray(job.otherCosts) ? (job.otherCosts as { amount: number }[]) : [];
      const otherTotal = otherCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);

      const laborMarkup = laborCost * ((job.laborMarkupPct ?? 0) / 100);
      const subMarkup = subCost * ((job.subMarkupPct ?? 0) / 100);
      const equipMarkup = equipBilled * ((job.equipmentMarkupPct ?? 0) / 100);
      const grossBilling = laborCost + laborMarkup + materialsCost + subCost + subMarkup + equipBilled + equipMarkup + otherTotal;

      // Invoice totals (net, after retainage)
      const totalInvoiced = job.invoices.reduce((s, inv) => {
        const amount = (inv.amount as any)?.toNumber?.() ?? Number(inv.amount ?? 0);
        return s + amount;
      }, 0);

      const totalPaid = job.payments.reduce((s, p) => s + ((p.amount as any)?.toNumber?.() ?? Number(p.amount ?? 0)), 0);

      // Balance remaining = revised contract - total paid
      const balanceRemaining = revisedContract - totalPaid;

      // Skip fully paid jobs
      if (revisedContract > 0 && balanceRemaining <= 0) continue;

      // % complete = grossBilling / revisedContract * 100
      const pctComplete = revisedContract > 0 ? Math.round((grossBilling / revisedContract) * 100) : 0;

      const lastInvoice = job.invoices[0];
      const lastPayment = job.payments[0];

      rows.push({
        id: job.id,
        jobNumber: job.jobNumber,
        jobName: job.jobName,
        foremanName: job.foreman?.name ?? null,
        contractValue,
        revisedContract,
        grossBilling,
        totalInvoiced,
        totalPaid,
        balanceRemaining,
        pctComplete,
        lastInvoiceDate: lastInvoice ? fmtDate(lastInvoice.date) : null,
        lastPaymentDate: lastPayment ? fmtDate(lastPayment.date) : null,
      });
    }

    // Sort by balance remaining descending
    rows.sort((a, b) => b.balanceRemaining - a.balanceRemaining);

    // Build HTML email
    const jobTableRows = rows.map((r, i) => `
      <tr style="background:${i % 2 === 0 ? "#f9fafb" : "#ffffff"}">
        <td style="padding:10px 12px;font-size:13px;font-weight:600;color:${NAVY}">
          <a href="${APP_URL}/jobs/${r.id}" style="color:${NAVY};text-decoration:none">${r.jobNumber}</a>
        </td>
        <td style="padding:10px 12px;font-size:13px">
          <a href="${APP_URL}/jobs/${r.id}" style="color:#1a1a1a;text-decoration:none;font-weight:500">${r.jobName}</a>
          ${r.foremanName ? `<br><span style="font-size:11px;color:#888">Foreman: ${r.foremanName}</span>` : ""}
        </td>
        <td style="padding:10px 12px;font-size:13px;text-align:right">
          <span style="font-weight:600;color:${r.pctComplete >= 90 ? "#16a34a" : r.pctComplete >= 50 ? "#b45309" : "#1a1a1a"}">${r.pctComplete}%</span>
        </td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:600;color:${ORANGE}">${fmt$(r.grossBilling)}</td>
        <td style="padding:10px 12px;font-size:12px;color:#555;text-align:center">
          ${r.lastInvoiceDate ?? '<span style="color:#dc2626;font-weight:600">Not yet invoiced</span>'}
        </td>
        <td style="padding:10px 12px;font-size:12px;color:#555;text-align:center">
          ${r.lastPaymentDate ?? '<span style="color:#888">No payments</span>'}
        </td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:700;color:${NAVY}">${fmt$(r.balanceRemaining)}</td>
      </tr>
    `).join("");

    const html = `
<div style="font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:32px 24px;color:#1a1a1a">

  <!-- Header -->
  <div style="margin-bottom:24px">
    <span style="font-size:13px;font-weight:700;color:${ORANGE};text-transform:uppercase;letter-spacing:0.1em">Oak Ridge Electrical LLC</span>
    <h1 style="font-size:24px;font-weight:700;color:${NAVY};margin:8px 0 4px">Monthly Billing Reminder</h1>
    <p style="font-size:14px;color:#555;margin:0">${monthLabel}</p>
    <div style="margin-top:12px;padding:10px 16px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px">
      <p style="margin:0;font-size:13px;font-weight:600;color:#92400e">Invoice by the 20th — billing period ends the 30th</p>
    </div>
  </div>

  <!-- Job Table -->
  <div style="margin-bottom:24px">
    <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
      <thead>
        <tr style="background:${NAVY}">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">Job #</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">Job Name</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">% Done</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">Gross Billing</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">Last Invoice</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">Last Payment</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em">Balance</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length === 0
          ? `<tr><td colspan="7" style="padding:24px;text-align:center;color:#888;font-size:13px">No active jobs with outstanding balances.</td></tr>`
          : jobTableRows
        }
      </tbody>
    </table>
  </div>

  <!-- Summary -->
  <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap">
    <div style="flex:1;min-width:160px;background:#f0f4ff;border-radius:8px;padding:16px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Active Jobs</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:${NAVY}">${rows.length}</p>
    </div>
    <div style="flex:1;min-width:160px;background:#fff7ed;border-radius:8px;padding:16px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Total Gross Billing</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:${ORANGE}">${fmt$(rows.reduce((s, r) => s + r.grossBilling, 0))}</p>
    </div>
    <div style="flex:1;min-width:160px;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Total Balance</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a">${fmt$(rows.reduce((s, r) => s + r.balanceRemaining, 0))}</p>
    </div>
    <div style="flex:1;min-width:160px;background:#fef2f2;border-radius:8px;padding:16px;text-align:center">
      <p style="margin:0 0 4px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Not Yet Invoiced</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626">${rows.filter(r => r.lastInvoiceDate === null).length}</p>
    </div>
  </div>

  <!-- Footer note -->
  <div style="padding:12px 16px;background:#f3f4f6;border-radius:6px;margin-bottom:20px">
    <p style="margin:0;font-size:12px;color:#555">
      Billing period projects to the 30th. Invoice date is the 20th.
      Please review each job and generate invoices from the Summary tab.
    </p>
  </div>

  <a href="${APP_URL}" style="display:inline-block;padding:10px 20px;background:${NAVY};color:#fff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:600">
    → Open Oak Ridge PM
  </a>

  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb" />
  <p style="font-size:11px;color:#aaa;margin:0">Oak Ridge Electrical Project Management — Automated Monthly Billing Reminder</p>
</div>`;

    const text = [
      `Monthly Billing Reminder — ${monthLabel}`,
      `Invoice by the 20th. Period ends the 30th.`,
      ``,
      `${rows.length} active jobs with balances:`,
      ...rows.map(r => `  ${r.jobNumber} — ${r.jobName}: ${fmt$(r.grossBilling)} billed, ${fmt$(r.balanceRemaining)} remaining (${r.pctComplete}% complete)`),
      ``,
      APP_URL,
    ].join("\n");

    // Send email
    const FROM = process.env.EMAIL_FROM;
    const PASS = process.env.GMAIL_APP_PASSWORD;
    if (!FROM || !PASS) {
      console.error("[billing-reminder] FATAL: EMAIL_FROM or GMAIL_APP_PASSWORD not set in environment variables.");
      return NextResponse.json({ ok: false, error: "Email not configured." }, { status: 500 });
    }

    const transport = nodemailer.createTransport({
      host: "smtp.gmail.com", port: 587, secure: false,
      auth: { user: FROM, pass: PASS },
    });

    const TO = ["justin@oakridgeelectrical.com", "beth@oakridgeelectrical.com"];
    const CC = "sam@oakridgeelectrical.com";

    await transport.sendMail({
      from: `"Oak Ridge PM" <${FROM}>`,
      to: TO.join(", "),
      cc: CC,
      subject: `Monthly Billing Reminder — ${monthLabel} — ${rows.length} Job${rows.length !== 1 ? "s" : ""} Ready to Bill`,
      text,
      html,
    });

    console.log(`[billing-reminder] ✓ Sent to ${TO.join(", ")} — ${rows.length} jobs listed`);
    return NextResponse.json({ ok: true, sent_to: TO, jobs_count: rows.length });

  } catch (err) {
    console.error("[billing-reminder] Error:", err);
    return new NextResponse(`Error: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
