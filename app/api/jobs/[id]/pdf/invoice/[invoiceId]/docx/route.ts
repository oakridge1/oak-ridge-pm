export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, HeadingLevel, BorderStyle, ShadingType,
} from "docx";
import { BRAND_BLUE, BRAND_ORANGE } from "@/lib/company";

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function noBorder() {
  const b = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: b, bottom: b, left: b, right: b };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role === "TEAMMATE") return new NextResponse("Forbidden", { status: 403 });

    const { id: jobId, invoiceId } = await params;

    const [job, invoice] = await Promise.all([
      prisma.job.findUnique({
        where: { id: jobId },
        select: {
          jobNumber: true, jobName: true,
          gcCompany: true, gcContactName: true, gcEmail: true,
          address: true, city: true, state: true,
          contractValue: true, contractStartDate: true,
          scopeOfWork: true,
          changeOrders: {
            where: { status: "APPROVED" },
            select: { coNumber: true, description: true, approvedValue: true },
            orderBy: { coNumber: "asc" },
          },
        },
      }),
      prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          invoiceNumber: true, date: true, periodTo: true, amount: true,
          retainagePct: true, retainageHeld: true,
          notes: true, type: true, invoiceKind: true,
        },
      }),
    ]);

    if (!job || !invoice) return new NextResponse("Not found", { status: 404 });
    if (invoice.type !== "STANDARD") return new NextResponse("Standard invoices only", { status: 400 });

    const invoiceKind = invoice.invoiceKind === "FINAL_INVOICE" ? "FINAL INVOICE" : "PROGRESS PAYMENT";
    const contractValue = job.contractValue?.toNumber() ?? 0;
    const approvedCOs = job.changeOrders.map(co => ({
      coNumber: co.coNumber,
      description: co.description,
      approvedValue: co.approvedValue?.toNumber() ?? 0,
    }));
    const coTotal = approvedCOs.reduce((s, co) => s + co.approvedValue, 0);
    const amount = invoice.amount.toNumber();
    const retainageHeld = invoice.retainageHeld?.toNumber() ?? (invoice.retainagePct ? amount * invoice.retainagePct / 100 : 0);

    const scopeItems = job.scopeOfWork
      ? job.scopeOfWork.split(/\n+/).map(s => s.trim()).filter(Boolean)
      : [];

    // docx colors are hex without '#' — derive from the shared brand constants
    const NAVY = BRAND_BLUE.replace("#", "");
    const ORANGE = BRAND_ORANGE.replace("#", "");
    const GRAY = "555555";
    const LIGHT_GRAY = "999999";

    function h(text: string) { return new TextRun({ text, bold: true, color: NAVY, size: 28 }); }
    function t(text: string, opts?: { bold?: boolean; italics?: boolean; color?: string; size?: number; allCaps?: boolean }) {
      return new TextRun({ text, size: 20, ...opts });
    }
    function para(children: TextRun[], align?: typeof AlignmentType[keyof typeof AlignmentType]) {
      return new Paragraph({ children, alignment: align ?? AlignmentType.LEFT });
    }
    function spacer(before = 120) {
      return new Paragraph({ children: [], spacing: { before } });
    }

    const children = [
      // Company header
      para([new TextRun({ text: "OAK RIDGE ELECTRICAL LLC", bold: true, color: NAVY, size: 36, allCaps: true })], AlignmentType.CENTER),
      para([t("209 W. River Rd · Hooksett, NH 03106", { color: GRAY })], AlignmentType.CENTER),
      para([t("Justin@oakridgeelectrical.com", { color: GRAY })], AlignmentType.CENTER),
      spacer(100),

      // INVOICE + type
      para([new TextRun({ text: "INVOICE", bold: true, color: NAVY, size: 52 })], AlignmentType.CENTER),
      para([new TextRun({ text: invoiceKind, bold: true, color: ORANGE, size: 24 })], AlignmentType.CENTER),
      spacer(80),

      // Invoice details
      para([t(`Invoice #: `, { bold: true }), t(`${String(invoice.invoiceNumber).padStart(3, "0")}`)]),
      para([t(`Date: `, { bold: true }), t(fmtDate(invoice.date))]),
      ...(invoice.periodTo ? [para([t("Period To: ", { bold: true }), t(fmtDate(invoice.periodTo))])] : []),
      spacer(160),

      // Project info table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder(),
                children: [
                  para([new TextRun({ text: "FROM", bold: true, color: LIGHT_GRAY, size: 16, allCaps: true })]),
                  para([new TextRun({ text: "Oak Ridge Electrical LLC", bold: true, size: 20 })]),
                  para([t("209 W. River Rd")]),
                  para([t("Hooksett, NH 03106")]),
                  para([t("Justin Marceau, Owner")]),
                  para([t("603-660-4651")]),
                  para([t("Justin@oakridgeelectrical.com")]),
                ],
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorder(),
                children: [
                  para([new TextRun({ text: "TO / PROJECT", bold: true, color: LIGHT_GRAY, size: 16, allCaps: true })]),
                  ...(job.gcCompany ? [para([new TextRun({ text: job.gcCompany, bold: true, size: 20 })])] : []),
                  ...(job.gcContactName ? [para([t(job.gcContactName)])] : []),
                  ...(job.gcEmail ? [para([t(job.gcEmail)])] : []),
                  spacer(60),
                  para([new TextRun({ text: job.jobName, bold: true, size: 20 })]),
                  para([t(`Job #${job.jobNumber}`)]),
                  ...([job.address, job.city, job.state].filter(Boolean).length > 0
                    ? [para([t([job.address, job.city, job.state].filter(Boolean).join(", "))])]
                    : []),
                  ...(job.contractStartDate ? [para([t(`Contract Date: ${fmtDate(job.contractStartDate)}`)])] : []),
                ],
              }),
            ],
          }),
        ],
      }),

      spacer(200),
    ];

    // Scope of Work
    if (scopeItems.length > 0) {
      children.push(para([new TextRun({ text: "SCOPE OF WORK", bold: true, color: NAVY, size: 20, allCaps: true })]));
      scopeItems.forEach((item, i) => {
        children.push(para([t(`${i + 1}. ${item}`)]));
      });
      children.push(spacer(160));
    }

    // Financial summary
    children.push(para([new TextRun({ text: "INVOICE SUMMARY", bold: true, color: NAVY, size: 20, allCaps: true })]));
    children.push(spacer(60));

    if (contractValue > 0) {
      children.push(para([
        new TextRun({ text: "Contract Total:".padEnd(40), size: 20 }),
        new TextRun({ text: fmt$(contractValue), bold: true, size: 20 }),
      ], AlignmentType.LEFT));
    }

    for (const co of approvedCOs) {
      children.push(para([
        new TextRun({ text: `CO ${co.coNumber != null ? `#${co.coNumber}` : ""} — ${co.description}:`.padEnd(40), size: 20, color: ORANGE, italics: true }),
        new TextRun({ text: `+${fmt$(co.approvedValue)}`, size: 20, color: ORANGE, italics: true }),
      ], AlignmentType.LEFT));
    }

    if (coTotal > 0 && contractValue > 0) {
      children.push(para([
        new TextRun({ text: "Revised Contract Total:".padEnd(40), size: 20 }),
        new TextRun({ text: fmt$(contractValue + coTotal), bold: true, size: 20 }),
      ], AlignmentType.LEFT));
    }

    children.push(para([
      new TextRun({ text: "─".repeat(60), size: 18, color: LIGHT_GRAY }),
    ]));

    children.push(para([
      new TextRun({ text: "INVOICE TOTAL:".padEnd(40), bold: true, size: 24, color: NAVY }),
      new TextRun({ text: fmt$(amount), bold: true, size: 24, color: NAVY }),
    ], AlignmentType.LEFT));

    if (retainageHeld > 0) {
      children.push(para([
        new TextRun({ text: `Less Retainage (${invoice.retainagePct ?? 0}%):`.padEnd(40), size: 20 }),
        new TextRun({ text: `(${fmt$(retainageHeld)})`, size: 20 }),
      ]));
      children.push(para([
        new TextRun({ text: "CURRENT PAYMENT DUE:".padEnd(40), bold: true, size: 24, color: NAVY }),
        new TextRun({ text: fmt$(amount - retainageHeld), bold: true, size: 24, color: NAVY }),
      ]));
    }

    children.push(spacer(200));

    // Payment terms
    children.push(para([new TextRun({ text: "PAYMENT TERMS", bold: true, color: NAVY, size: 20, allCaps: true })]));
    children.push(para([t("Payment is due upon receipt of this invoice. Past due balances may incur a finance charge of 1.5% per month in accordance with New Hampshire law. Please remit payment to: Oak Ridge Electrical LLC, 209 W. River Rd, Hooksett, NH 03106")]));
    children.push(spacer(120));

    // Warranty
    children.push(para([new TextRun({ text: "WARRANTY", bold: true, color: NAVY, size: 20, allCaps: true })]));
    children.push(para([t("Oak Ridge Electrical LLC provides a one-year workmanship warranty from the date of substantial completion. All installed equipment carries the applicable manufacturer's warranty. Warranty coverage does not extend to damage caused by misuse, modification by others, or conditions outside the scope of the original installation.")]));

    if (invoice.notes) {
      children.push(spacer(120));
      children.push(para([new TextRun({ text: "NOTES", bold: true, color: NAVY, size: 20, allCaps: true })]));
      children.push(para([t(invoice.notes)]));
    }

    const doc = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(doc);
    const filename = `${job.jobNumber}_Invoice_${String(invoice.invoiceNumber).padStart(3, "0")}.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[Invoice DOCX] Error:", err);
    return new NextResponse(`DOCX generation failed: ${err instanceof Error ? err.message : String(err)}`, { status: 500 });
  }
}
