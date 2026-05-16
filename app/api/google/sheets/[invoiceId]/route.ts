export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, googleFetch } from "@/lib/google";
import { APP_URL } from "@/lib/app-url";

const TEMPLATE_FILE_ID = "1R4r9hrg6DhahiNzE4apUGfxD3uqGVk-k";

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { invoiceId } = await params;

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Google not connected. Please connect your Google account in Settings." }, { status: 400 });
  }

  // Fetch invoice with full job context
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      job: {
        include: {
          changeOrders: {
            where: { status: "APPROVED" },
            select: { coNumber: true, description: true, approvedValue: true },
            orderBy: { coNumber: "asc" },
          },
          invoices: {
            where: { type: "AIA", status: { not: "DRAFT" } },
            select: { id: true, amount: true, invoiceNumber: true, retainagePct: true, retainageHeld: true, applicationNo: true },
            orderBy: { invoiceNumber: "asc" },
          },
          laborEntries: { select: { hours: true } },
          materials: { select: { amount: true } },
        },
      },
    },
  });

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.type !== "AIA") return NextResponse.json({ error: "Only AIA invoices can be pushed to Google Sheets" }, { status: 400 });

  const job = invoice.job;

  // ── Compute AIA figures ────────────────────────────────────────────────────
  const contractValue = job.contractValue?.toNumber() ?? 0;
  const approvedCOsTotal = job.changeOrders.reduce((s, co) => s + (co.approvedValue?.toNumber() ?? 0), 0);
  const revisedContract = contractValue + approvedCOsTotal;

  const totalHours = job.laborEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
  const blendedRate = job.blendedLaborRate?.toNumber() ?? 0;
  const laborCost = blendedRate > 0 ? totalHours * blendedRate : 0;
  const materialsCost = job.materials.reduce((s, m) => s + (m.amount?.toNumber() ?? 0), 0);
  const subCost = job.subcontractorCost?.toNumber() ?? 0;
  const equipCost = job.equipmentCost?.toNumber() ?? 0;
  const equipBillPct = job.equipmentBillPct ?? 100;
  const equipBilled = equipCost * (equipBillPct / 100);
  const otherCosts = Array.isArray(job.otherCosts) ? (job.otherCosts as { description: string; amount: number }[]) : [];
  const otherTotal = otherCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const laborMarkupPct = job.laborMarkupPct ?? 0;
  const subMarkupPct = job.subMarkupPct ?? 0;
  const equipMarkupPct = job.equipmentMarkupPct ?? 0;
  const laborMarkup = laborCost * (laborMarkupPct / 100);
  const subMarkup = subCost * (subMarkupPct / 100);
  const equipMarkup = equipBilled * (equipMarkupPct / 100);
  const grossBilling = laborCost + laborMarkup + materialsCost + subCost + subMarkup + equipBilled + equipMarkup + otherTotal;

  const retainagePct = invoice.retainagePct ?? 10; // Default 10%
  const retainageHeld = grossBilling * (retainagePct / 100);
  const totalEarnedLessRetainage = grossBilling - retainageHeld;

  // Previous certificates = sum of prior approved AIA invoices' net amounts
  const previousCertificates = job.invoices
    .filter((inv) => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
    .reduce((sum, inv) => {
      const invAmount = inv.amount?.toNumber() ?? 0;
      const invRet = inv.retainageHeld?.toNumber() ?? (inv.retainagePct != null ? invAmount * inv.retainagePct / 100 : 0);
      return sum + (invAmount - invRet);
    }, 0);

  const currentPaymentDue = totalEarnedLessRetainage - previousCertificates;
  const balanceToFinish = revisedContract - totalEarnedLessRetainage;

  const priorInvoicesTotal = job.invoices
    .filter(inv => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
    .reduce((s, inv) => s + (inv.amount?.toNumber() ?? 0), 0);

  type G703Line = { itemNo: string; description: string; scheduledValue: number; previouslyBilled: number; thisPeriod: number; stored: number };
  const lineItems: G703Line[] = [];

  if (laborCost + laborMarkup > 0) {
    const sv = laborCost + laborMarkup;
    const prevBilled = grossBilling > 0 ? priorInvoicesTotal * (sv / grossBilling) : 0;
    lineItems.push({ itemNo: "16-100", description: "Labor", scheduledValue: sv, previouslyBilled: prevBilled, thisPeriod: sv - prevBilled, stored: 0 });
  }
  if (materialsCost > 0) {
    const sv = materialsCost;
    const prevBilled = grossBilling > 0 ? priorInvoicesTotal * (sv / grossBilling) : 0;
    lineItems.push({ itemNo: "16-100", description: "Material", scheduledValue: sv, previouslyBilled: prevBilled, thisPeriod: sv - prevBilled, stored: 0 });
  }
  if (subCost + subMarkup > 0) {
    const sv = subCost + subMarkup;
    const prevBilled = grossBilling > 0 ? priorInvoicesTotal * (sv / grossBilling) : 0;
    lineItems.push({ itemNo: "16-200", description: "Subcontractors", scheduledValue: sv, previouslyBilled: prevBilled, thisPeriod: sv - prevBilled, stored: 0 });
  }
  // Approved COs as their own G703 rows
  for (const co of job.changeOrders) {
    const sv = co.approvedValue?.toNumber() ?? 0;
    if (sv > 0) {
      lineItems.push({
        itemNo: `CO-${co.coNumber ?? ""}`,
        description: co.description ?? `Change Order ${co.coNumber ?? ""}`,
        scheduledValue: sv,
        previouslyBilled: 0,
        thisPeriod: sv,
        stored: 0,
      });
    }
  }

  const appNo = invoice.applicationNo ?? invoice.invoiceNumber;
  // Sheet name in Beth's template: AIA1 for app 1, AIA2 for app 2
  const sheetName = appNo === 2 ? "AIA2" : "AIA1";

  const copyTitle = `${job.jobNumber} - ${job.jobName} - AIA App ${appNo}`;

  let spreadsheetId = invoice.googleSheetId ?? null;

  if (!spreadsheetId) {
    // Copy Beth's template file using Google Drive API
    const copyRes = await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${TEMPLATE_FILE_ID}/copy`,
      {
        method: "POST",
        body: JSON.stringify({ name: copyTitle }),
      },
      accessToken,
    );

    if (!copyRes.ok) {
      const err = await copyRes.text();
      console.error("[sheets] Drive copy failed:", err);
      // If Drive scope not granted yet, give helpful message
      if (copyRes.status === 403) {
        return NextResponse.json({
          error: "Google Drive access not authorized. Please go to Settings → Disconnect → Reconnect Google Account to grant Drive access.",
        }, { status: 400 });
      }
      return NextResponse.json({ error: `Failed to copy template: ${err}` }, { status: 500 });
    }

    const copied = await copyRes.json() as { id: string };
    spreadsheetId = copied.id;
    await prisma.invoice.update({ where: { id: invoiceId }, data: { googleSheetId: spreadsheetId } });
  }

  const projectAddress = [job.address, job.city, job.state].filter(Boolean).join(", ");

  const g702Data = [
    ["TO OWNER:", job.ownerName ?? ""],
    ["PROJECT:", `${job.jobName}`],
    ["", projectAddress],
    ["APPLICATION NO:", String(appNo)],
    ["PERIOD TO:", fmtDate(invoice.periodTo)],
    ["FROM CONTRACTOR:", "Oak Ridge Electrical LLC"],
    ["", "209 W. River Rd, Hooksett, NH 03106"],
    ["VIA GENERAL CONTRACTOR:", job.gcCompany ?? ""],
    ["PROJECT NOS:", job.jobNumber],
    ["CONTRACT DATE:", fmtDate(job.contractStartDate)],
    [""],
    ["CONTRACTOR'S APPLICATION FOR PAYMENT"],
    ["1. Original Contract Sum:", fmt$(contractValue)],
    ["2. Net Change by Change Orders:", fmt$(approvedCOsTotal)],
    ["3. Contract Sum to Date (1+2):", fmt$(revisedContract)],
    ["4. Total Completed & Stored to Date:", fmt$(grossBilling)],
    [`5. Retainage (${retainagePct}%):`, fmt$(retainageHeld)],
    ["6. Total Earned Less Retainage (4-5):", fmt$(totalEarnedLessRetainage)],
    ["7. Less Previous Certificates:", fmt$(previousCertificates)],
    ["8. CURRENT PAYMENT DUE (6-7):", fmt$(currentPaymentDue)],
    ["9. Balance to Finish Including Retainage:", fmt$(balanceToFinish)],
    [""],
    ["CHANGE ORDER SUMMARY"],
    ...job.changeOrders.map(co => [
      `CO #${co.coNumber ?? ""}:`, co.description ?? "", fmt$(co.approvedValue?.toNumber() ?? 0)
    ]),
    [""],
    ["Contractor:", "Oak Ridge Electrical LLC"],
    ["Application Date:", fmtDate(invoice.date)],
    ["State:", "New Hampshire"],
    ["County:", "Hillsboro"],
  ];

  const g703Header = ["Item No.", "Description of Work", "Scheduled Value", "Previously Billed", "This Period", "Materials Stored", "Total Completed & Stored", "% Complete", "Balance to Finish"];
  const g703Data = [
    ["AIA G703 - Continuation Sheet"],
    [`Application No: ${appNo}`, "", `Period To: ${fmtDate(invoice.periodTo)}`, "", `Contract: ${job.jobNumber}`],
    [],
    g703Header,
    ...lineItems.map(li => {
      const total = li.previouslyBilled + li.thisPeriod + li.stored;
      const pct = li.scheduledValue > 0 ? (total / li.scheduledValue * 100).toFixed(1) + "%" : "0%";
      const balance = li.scheduledValue - total;
      return [li.itemNo, li.description, fmt$(li.scheduledValue), fmt$(li.previouslyBilled), fmt$(li.thisPeriod), fmt$(li.stored), fmt$(total), pct, fmt$(balance)];
    }),
    [],
    [
      "TOTALS", "",
      fmt$(lineItems.reduce((s, i) => s + i.scheduledValue, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.previouslyBilled, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.thisPeriod, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.stored, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.previouslyBilled + i.thisPeriod + i.stored, 0)),
      "",
      fmt$(lineItems.reduce((s, i) => s + i.scheduledValue - i.previouslyBilled - i.thisPeriod - i.stored, 0)),
    ],
  ];

  // Write G702 data and G703 data to the target sheet in Beth's template
  const valuesRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: [
          {
            range: `'${sheetName}'!A1`,
            values: g702Data,
          },
          {
            range: `'${sheetName}'!K1`,
            values: g703Data,
          },
        ],
      }),
    },
    accessToken,
  );

  if (!valuesRes.ok) {
    const errText = await valuesRes.text();
    console.error("[sheets] values write failed:", errText);
    // Try writing to Sheet1 as fallback if sheet name doesn't match
    const fallbackRes = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: [
            { range: "Sheet1!A1", values: g702Data },
            { range: "Sheet1!K1", values: g703Data },
          ],
        }),
      },
      accessToken,
    );
    if (!fallbackRes.ok) {
      console.error("[sheets] fallback write also failed:", await fallbackRes.text());
      // Non-fatal: return the URL anyway so Beth can access the copied template
    }
  }

  // Suppress unused import warning — APP_URL used for future job links in descriptions
  void APP_URL;

  return NextResponse.json({
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  });
}
