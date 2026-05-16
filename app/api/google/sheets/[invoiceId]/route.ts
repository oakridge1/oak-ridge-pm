export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, googleFetch } from "@/lib/google";

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
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
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      job: {
        include: {
          changeOrders: { where: { status: "APPROVED" }, select: { approvedValue: true } },
          invoices: {
            where: { type: "AIA", status: { not: "DRAFT" } },
            select: { id: true, amount: true, invoiceNumber: true, retainagePct: true, retainageHeld: true },
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

  // Compute AIA figures (mirrors the PDF route logic)
  const contractValue = job.contractValue?.toNumber() ?? 0;
  const approvedCOs = job.changeOrders.reduce((s, co) => s + (co.approvedValue?.toNumber() ?? 0), 0);
  const revisedContract = contractValue + approvedCOs;

  const totalHours = job.laborEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
  const blendedRate = job.blendedLaborRate?.toNumber() ?? 0;
  const laborCost = blendedRate > 0 ? totalHours * blendedRate : 0;
  const materialsCost = job.materials.reduce((s, m) => s + (m.amount?.toNumber() ?? 0), 0);
  const subCost = job.subcontractorCost?.toNumber() ?? 0;
  const equipCost = job.equipmentCost?.toNumber() ?? 0;
  const equipBillPct = job.equipmentBillPct ?? 100;
  const equipBilled = equipCost * (equipBillPct / 100);
  const otherCosts = Array.isArray(job.otherCosts)
    ? (job.otherCosts as { description: string; amount: number }[])
    : [];
  const otherTotal = otherCosts.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const laborMarkupPct = job.laborMarkupPct ?? 0;
  const subMarkupPct = job.subMarkupPct ?? 0;
  const equipMarkupPct = job.equipmentMarkupPct ?? 0;
  const laborMarkup = laborCost * (laborMarkupPct / 100);
  const subMarkup = subCost * (subMarkupPct / 100);
  const equipMarkup = equipBilled * (equipMarkupPct / 100);
  const grossBilling = laborCost + materialsCost + subCost + equipCost + otherTotal + laborMarkup + subMarkup + equipMarkup;

  const retainagePct = invoice.retainagePct ?? 0;
  const retainageHeld = grossBilling * (retainagePct / 100);
  const totalEarnedLessRetainage = grossBilling - retainageHeld;

  const previousCertificates = job.invoices
    .filter((inv) => inv.id !== invoiceId && inv.invoiceNumber < invoice.invoiceNumber)
    .reduce((sum, inv) => {
      const invAmount = inv.amount?.toNumber() ?? 0;
      const invRetainageHeld = inv.retainageHeld?.toNumber()
        ?? (inv.retainagePct != null ? invAmount * inv.retainagePct / 100 : 0);
      return sum + (invAmount - invRetainageHeld);
    }, 0);

  const currentPaymentDue = totalEarnedLessRetainage - previousCertificates;
  const balanceToFinish = revisedContract - totalEarnedLessRetainage;

  // Build G703 line items
  type G703Line = { no: number; description: string; scheduledValue: number; previouslyBilled: number; thisPeriod: number; stored: number };
  const lineItems: G703Line[] = [];
  let no = 1;
  if (laborCost + laborMarkup > 0) {
    const suffix = laborMarkupPct > 0 ? ` (incl. ${laborMarkupPct}% markup)` : "";
    lineItems.push({ no: no++, description: `Labor${suffix}`, scheduledValue: laborCost + laborMarkup, previouslyBilled: 0, thisPeriod: laborCost + laborMarkup, stored: 0 });
  }
  if (materialsCost > 0) lineItems.push({ no: no++, description: "Materials", scheduledValue: materialsCost, previouslyBilled: 0, thisPeriod: materialsCost, stored: 0 });
  if (subCost + subMarkup > 0) {
    const suffix = subMarkupPct > 0 ? ` (incl. ${subMarkupPct}% markup)` : "";
    lineItems.push({ no: no++, description: `Subcontractors${suffix}`, scheduledValue: subCost + subMarkup, previouslyBilled: 0, thisPeriod: subCost + subMarkup, stored: 0 });
  }
  if (equipCost + equipMarkup > 0) {
    const suffix = equipMarkupPct > 0 ? ` (incl. ${equipMarkupPct}% markup)` : "";
    lineItems.push({ no: no++, description: `Equipment Rental${suffix}`, scheduledValue: equipCost + equipMarkup, previouslyBilled: 0, thisPeriod: equipCost + equipMarkup, stored: 0 });
  }
  for (const oc of otherCosts) {
    if (oc.amount > 0) lineItems.push({ no: no++, description: oc.description ?? "Other", scheduledValue: Number(oc.amount), previouslyBilled: 0, thisPeriod: Number(oc.amount), stored: 0 });
  }

  const appNo = invoice.applicationNo ?? invoice.invoiceNumber;
  const title = `${job.jobNumber} - AIA G702/G703 - App #${appNo}`;

  let spreadsheetId = invoice.googleSheetId ?? null;

  if (!spreadsheetId) {
    // Create new spreadsheet
    const createRes = await googleFetch(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        body: JSON.stringify({
          properties: { title },
          sheets: [
            { properties: { title: "G702 - Application", sheetId: 0 } },
            { properties: { title: "G703 - Continuation", sheetId: 1 } },
          ],
        }),
      },
      accessToken,
    );

    if (!createRes.ok) {
      const err = await createRes.text();
      console.error("[sheets] create failed:", err);
      return NextResponse.json({ error: "Failed to create spreadsheet" }, { status: 500 });
    }

    const created = await createRes.json() as { spreadsheetId: string };
    spreadsheetId = created.spreadsheetId;

    await prisma.invoice.update({ where: { id: invoiceId }, data: { googleSheetId: spreadsheetId } });
  }

  // G702 values
  const g702Rows = [
    ["AIA Document G702 - Application and Certificate for Payment"],
    [],
    ["Project:", `${job.jobName} (${job.jobNumber})`],
    ["Owner:", job.ownerName ?? ""],
    ["Contractor:", job.gcCompany ?? ""],
    ["Application No:", String(appNo)],
    ["Application Date:", fmtDate(invoice.date)],
    ["Period To:", fmtDate(invoice.periodTo)],
    [],
    ["SUMMARY OF WORK"],
    ["1. Original Contract Sum", fmt$(contractValue)],
    ["2. Net Change by Change Orders", fmt$(approvedCOs)],
    ["3. Contract Sum to Date (1+2)", fmt$(revisedContract)],
    ["4. Total Completed and Stored to Date", fmt$(grossBilling)],
    [`5. Retainage (${retainagePct}%)`, fmt$(retainageHeld)],
    ["6. Total Earned Less Retainage (4-5)", fmt$(totalEarnedLessRetainage)],
    ["7. Less Previous Certificates for Payment", fmt$(previousCertificates)],
    ["8. Current Payment Due (6-7)", fmt$(currentPaymentDue)],
    ["9. Balance to Finish Including Retainage (3-6)", fmt$(balanceToFinish)],
    [],
    ...(invoice.notes ? [["Notes:", invoice.notes]] : []),
  ];

  // G703 values
  const g703Header = ["Item No.", "Description of Work", "Scheduled Value", "Previously Billed", "This Period", "Materials Stored", "Total Completed & Stored", "% Complete"];
  const g703Rows = [
    ["AIA Document G703 - Continuation Sheet"],
    [`Application No: ${appNo}`, "", `Period To: ${fmtDate(invoice.periodTo)}`],
    [],
    g703Header,
    ...lineItems.map(item => {
      const totalCompletedAndStored = item.previouslyBilled + item.thisPeriod + item.stored;
      const pctComplete = item.scheduledValue > 0 ? (totalCompletedAndStored / item.scheduledValue * 100).toFixed(1) + "%" : "0%";
      return [
        String(item.no),
        item.description,
        fmt$(item.scheduledValue),
        fmt$(item.previouslyBilled),
        fmt$(item.thisPeriod),
        fmt$(item.stored),
        fmt$(totalCompletedAndStored),
        pctComplete,
      ];
    }),
    [],
    [
      "TOTALS",
      "",
      fmt$(lineItems.reduce((s, i) => s + i.scheduledValue, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.previouslyBilled, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.thisPeriod, 0)),
      fmt$(lineItems.reduce((s, i) => s + i.stored, 0)),
      fmt$(grossBilling),
      "",
    ],
  ];

  // Write values to both sheets
  const valuesRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: [
          { range: "'G702 - Application'!A1", values: g702Rows },
          { range: "'G703 - Continuation'!A1", values: g703Rows },
        ],
      }),
    },
    accessToken,
  );

  if (!valuesRes.ok) {
    console.error("[sheets] values update failed:", await valuesRes.text());
    return NextResponse.json({ error: "Failed to write spreadsheet data" }, { status: 500 });
  }

  // Apply formatting
  const formatRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          // G702 - bold title row
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
              cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 13 } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // G702 - bold section header
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 9, endRowIndex: 10, startColumnIndex: 0, endColumnIndex: 2 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // G702 - bold "Current Payment Due" row
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 17, endRowIndex: 18, startColumnIndex: 0, endColumnIndex: 2 },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // G703 - bold title
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
              cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 13 } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // G703 - bold column headers
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 8 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0, green: 0.18, blue: 0.447 },
                  horizontalAlignment: "CENTER",
                },
              },
              fields: "userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)",
            },
          },
          // G703 - bold totals row
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 4 + lineItems.length + 1,
                endRowIndex: 4 + lineItems.length + 2,
                startColumnIndex: 0,
                endColumnIndex: 8,
              },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: "userEnteredFormat.textFormat",
            },
          },
          // Auto-resize G702 columns
          { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: 2 } } },
          // Auto-resize G703 columns
          { autoResizeDimensions: { dimensions: { sheetId: 1, dimension: "COLUMNS", startIndex: 0, endIndex: 8 } } },
        ],
      }),
    },
    accessToken,
  );

  if (!formatRes.ok) {
    console.warn("[sheets] formatting failed:", await formatRes.text());
    // Non-fatal — data is already written
  }

  return NextResponse.json({ url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });
}
