export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StockOrderPdf } from "../pdf/_templates";
import { Document as DocxDocument, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, Packer } from "docx";
import type { StockOrderPdfData } from "../pdf/_templates";

const FROM = process.env.EMAIL_FROM;
const PASS = process.env.GMAIL_APP_PASSWORD;
const SAM_CC = "sam@oakridgeelectrical.com";
const JUSTIN_EMAIL = "justin@oakridgeelectrical.com";
const MICHAEL_EMAIL = "michael@oakridgeelectrical.com";

function getTransport() {
  if (!FROM || !PASS) return null;
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth: { user: FROM, pass: PASS } });
}

function fmtDelivery(method: string, jobAddress: string) {
  if (method === "DELIVERY_SITE") return `Delivery to Job Site: ${jobAddress}`;
  if (method === "DELIVERY_SHOP") return "Delivery to Shop: 209 W. River Rd, Hooksett, NH 03106";
  return "Pickup";
}

function fmtDeliveryShort(method: string, jobAddress: string) {
  if (method === "DELIVERY_SITE") return `Delivery to Site: ${jobAddress}`;
  if (method === "DELIVERY_SHOP") return "Delivery to Shop";
  return "Pickup";
}

function buildItemDescription(req: {
  stockItem: { name: string; lingo: string | null; unitOfMeasure: string } | null;
  variables: Record<string, string> | null;
}): string {
  const vars = req.variables ? Object.values(req.variables).filter(Boolean).join(", ") : "";
  return vars;
}

function buildItemLine(req: {
  stockItem: { name: string; lingo: string | null; unitOfMeasure: string } | null;
  customItemName: string | null;
  variables: Record<string, string> | null;
  quantity: number;
  quantityUnit: string | null;
  note: string | null;
}): string {
  const name = req.stockItem?.name ?? req.customItemName ?? "Custom Item";
  const vars = req.variables ? Object.values(req.variables).filter(Boolean).join(", ") : "";
  const varStr = vars ? ` — ${vars}` : "";
  return `• ${req.quantity} ${req.quantityUnit ?? req.stockItem?.unitOfMeasure ?? "EA"} — ${name}${varStr}${req.note ? ` (${req.note})` : ""}`;
}

async function generateOrderDocx(data: StockOrderPdfData): Promise<Buffer> {
  const doc = new DocxDocument({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: "OAK RIDGE ELECTRICAL LLC", bold: true, size: 28, color: "002D72" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          children: [new TextRun({ text: "209 W. River Rd, Hooksett, NH 03106  |  603-660-4651  |  Justin@oakridgeelectrical.com", size: 18, color: "555555" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: data.title ?? "MATERIAL ORDER", bold: true, size: 32, color: "FF5910" })],
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ children: [new TextRun({ text: `To: ${data.supplierName}${data.supplierRepName ? ` — ${data.supplierRepName}` : ""}`, bold: true })] }),
        new Paragraph({ children: [new TextRun(`Date: ${data.orderDate}`)] }),
        new Paragraph({ children: [new TextRun(`PO/Job: ${data.poNumber ?? data.jobNumber}`)] }),
        new Paragraph({ children: [new TextRun("")] }),
        // ── DELIVERY INSTRUCTIONS block ──
        new Paragraph({ children: [new TextRun({ text: "⚠  DELIVERY INSTRUCTIONS", bold: true, size: 24, color: "8B0000" })] }),
        new Paragraph({ children: [new TextRun({ text: data.deliveryMethod.toUpperCase(), bold: true, size: 28, color: "8B0000" })] }),
        ...(data.deliveryAddress ? [new Paragraph({ children: [new TextRun({ text: data.deliveryAddress, bold: true, size: 24, color: "8B0000" })] })] : []),
        ...(data.notes ? [new Paragraph({ children: [new TextRun({ text: `NOTES: ${data.notes.toUpperCase()}`, bold: true, size: 24, color: "CC0000" })] })] : []),
        new Paragraph({ children: [new TextRun("")] }),
        new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "#", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Item", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Qty", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Unit", bold: true })] })] }),
              ],
            }),
            ...data.items.map((item, idx) => new TableRow({
              children: [
                new TableCell({ children: [new Paragraph(`${idx + 1}`)] }),
                new TableCell({ children: [new Paragraph(item.name)] }),
                new TableCell({ children: [new Paragraph(item.description ?? "")] }),
                new TableCell({ children: [new Paragraph(String(item.quantity))] }),
                new TableCell({ children: [new Paragraph(item.unit)] }),
              ],
            })),
          ],
        }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({ children: [new TextRun(`Total: ${data.items.length} line item${data.items.length !== 1 ? "s" : ""}`)] }),
        new Paragraph({ children: [new TextRun("")] }),
        new Paragraph({
          children: [new TextRun({ text: "Thank you for your business! Oak Ridge Electrical LLC — Justin Marceau, Owner — 603-660-4651 | Justin@oakridgeelectrical.com", italics: true, size: 16 })],
        }),
      ],
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;
  const role = session.user.role;

  const body = await req.json();
  const { groups, poNumber, deliveryNotes, deliveryMethod: globalDeliveryMethod } = body;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { jobName: true, jobNumber: true, address: true, city: true, state: true, foreman: { select: { email: true, name: true } } },
  });
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const jobAddress = [job.address, job.city, job.state].filter(Boolean).join(", ");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const todayShort = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const todayISO = new Date().toISOString().slice(0, 10);

  console.log(`[stock-order] Starting order send for job ${jobId}, ${groups.length} groups`);

  // Quote submissions bypass the approval workflow entirely
  const isQuoteOrder = groups.some((g: { orderType?: string }) =>
    g.orderType === 'QUOTE' || g.orderType === 'COMPETITIVE_QUOTE'
  );

  // Check permission to send orders for TEAMMATE (skipped for quotes)
  if (!isQuoteOrder && role === "TEAMMATE") {
    const perm = await prisma.userPermission.findFirst({
      where: { userId: session.user.id, permission: "ORDERING", OR: [{ scope: "GLOBAL" }, { scope: "JOB", jobId }] },
    });
    if (!perm) {
      // Save as PENDING_APPROVAL instead of rejecting
      // Collect all requestIds across all groups
      const allRequestIds: string[] = groups.flatMap((g: { requestIds: string[] }) => g.requestIds);

      // Create a StockApprovalRequest
      const approvalRequest = await prisma.stockApprovalRequest.create({
        data: { jobId, requestedById: session.user.id, status: "PENDING" },
      });

      // Link all requests to the approval
      await prisma.stockRequest.updateMany({
        where: { id: { in: allRequestIds } },
        data: { status: "PENDING_APPROVAL", approvalRequestId: approvalRequest.id },
      });

      // Notify Foreman and Admins
      const transport = getTransport();
      console.log(`[stock-order] Transport: ${transport ? "created" : "FAILED - check EMAIL_FROM and GMAIL_APP_PASSWORD env vars"}`);
      if (transport) {
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", active: true },
          select: { email: true },
        });
        const requesterUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true },
        });

        const rawRequests = await prisma.stockRequest.findMany({
          where: { id: { in: allRequestIds } },
          include: { stockItem: { select: { name: true, lingo: true, unitOfMeasure: true } } },
        });

        const itemLines = rawRequests.map(r => buildItemLine({
          ...r,
          variables: r.variables as Record<string, string> | null,
        })).join("\n");

        const toEmails = [
          ...(job.foreman?.email ? [job.foreman.email] : []),
          ...admins.map(a => a.email).filter((e): e is string => !!e),
          JUSTIN_EMAIL,
        ].filter((v, i, a) => v && a.indexOf(v) === i);

        if (toEmails.length > 0) {
          try {
            await transport.sendMail({
              from: `"Oak Ridge Electrical" <${FROM}>`,
              to: toEmails.join(", "),
              cc: SAM_CC,
              subject: `Order Approval Needed — ${job.jobNumber} ${job.jobName} — ${today}`,
              text: [
                `${requesterUser?.name ?? "A teammate"} has submitted a material order that requires approval.`,
                `Job: ${job.jobName} (Job #${job.jobNumber})`,
                "",
                "ITEMS:",
                itemLines,
                "",
                "Please log in to review and approve or reject this order.",
                "—",
                "Oak Ridge Electrical LLC",
              ].join("\n"),
            });
          } catch (err) {
            console.error("[stock-order] approval notification email failed:", err);
          }
        }
      }

      return NextResponse.json({ ok: true, pendingApproval: true });
    }
  }

  const transport = getTransport();
  console.log(`[stock-order] Transport: ${transport ? "created" : "FAILED - check EMAIL_FROM and GMAIL_APP_PASSWORD env vars"}`);

  const results = [];

  for (const group of groups) {
    const {
      supplierName,
      supplierEmail,
      requestIds,
      isConsumables,
      orderType:          groupOrderType       = 'ORDER',
      additionalCcEmails: additionalCcEmails   = [] as string[],
      ccForeman:          ccForeman            = true,
    } = group;

    console.log(`[stock-order] Group ${supplierName}: ${requestIds.length} requests, isConsumables: ${isConsumables}`);

    // Use global delivery method for electrical, always PICKUP for consumables
    const deliveryMethod = isConsumables ? "PICKUP" : (globalDeliveryMethod || group.deliveryMethod || "PICKUP");

    const rawRequests = await prisma.stockRequest.findMany({
      where: { id: { in: requestIds } },
      include: { user: { select: { name: true } }, stockItem: { select: { name: true, lingo: true, unitOfMeasure: true } } },
    });

    if (rawRequests.length === 0) continue;

    const requests = rawRequests.map(r => ({
      ...r,
      variables: (r.variables as Record<string, string> | null),
    }));

    const deliveryStr = fmtDelivery(deliveryMethod, jobAddress);
    const deliveryShort = fmtDeliveryShort(deliveryMethod, jobAddress);

    const isGroupQuote = groupOrderType === 'QUOTE' || groupOrderType === 'COMPETITIVE_QUOTE';

    const subject = isConsumables
      ? `Pickup List — ${job.jobNumber} ${job.jobName} — ${today}`
      : groupOrderType === 'COMPETITIVE_QUOTE'
      ? `Competitive Quote Request — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`
      : groupOrderType === 'QUOTE'
      ? `Quote Request — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`
      : `Material Order — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`;

    const deliveryHeader = [
      `⚠️ DELIVERY: ${deliveryStr.toUpperCase()}`,
      deliveryNotes ? `⚠️ NOTES: ${deliveryNotes.toUpperCase()}` : "",
    ].filter(Boolean).join("\n");

    const emailBodyText = isConsumables
      ? [
          deliveryHeader,
          "──────────────────────────────────",
          `PICKUP / CONSUMABLES LIST`,
          `Job: ${job.jobName} (Job #${job.jobNumber})`,
          poNumber ? `PO / Job #: ${poNumber}` : "",
          "",
          "ITEMS:",
          requests.map(r => buildItemLine(r)).join("\n"),
          "",
          "—",
          "Oak Ridge Electrical LLC",
          "209 W. River Rd, Hooksett, NH 03106",
          "603-660-4651",
        ].filter(s => s !== undefined && s !== "").join("\n")
      : isGroupQuote
      ? [
          `Quote request attached. Please provide your best pricing at your earliest convenience.`,
          `Job: ${job.jobName} (Job #${job.jobNumber})`,
          poNumber ? `PO/Job: ${poNumber}` : "",
          groupOrderType === 'COMPETITIVE_QUOTE'
            ? `\nNote: Oak Ridge Electrical is soliciting competitive quotes from multiple vendors for this order.`
            : "",
          "",
          "Thank you,",
          "Oak Ridge Electrical LLC — Justin Marceau, Owner — 603-660-4651 | Justin@oakridgeelectrical.com",
        ].filter(s => s !== undefined && s !== "").join("\n")
      : [
          deliveryHeader,
          "──────────────────────────────────",
          `Material order attached.`,
          `Job: ${job.jobName} (Job #${job.jobNumber})`,
          `PO/Job: ${poNumber ?? job.jobNumber}`,
          "",
          "Thank you,",
          "Oak Ridge Electrical LLC — Justin Marceau, Owner — 603-660-4651 | Justin@oakridgeelectrical.com",
        ].filter(Boolean).join("\n");

    // Build PDF data
    const pdfData: StockOrderPdfData = {
      supplierName: isConsumables ? "Pickup List" : (supplierName ?? ""),
      supplierRepName: null,
      supplierEmail: isConsumables ? null : (supplierEmail ?? null),
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      poNumber: poNumber ?? null,
      orderDate: todayShort,
      deliveryMethod: deliveryShort,
      deliveryAddress: deliveryMethod === "DELIVERY_SITE" ? jobAddress : deliveryMethod === "DELIVERY_SHOP" ? "209 W. River Rd, Hooksett, NH 03106" : null,
      items: requests.map(r => ({
        name: r.stockItem?.name ?? r.customItemName ?? "Custom Item",
        description: buildItemDescription(r),
        quantity: r.quantity,
        unit: r.quantityUnit ?? r.stockItem?.unitOfMeasure ?? "EA",
        note: r.note ?? null,
      })),
      notes: deliveryNotes ?? null,
      title: isConsumables ? "PICKUP LIST" : "MATERIAL ORDER",
      orderType: (groupOrderType ?? 'ORDER') as 'ORDER' | 'QUOTE' | 'COMPETITIVE_QUOTE',
    };

    // Generate PDF (for both electrical and consumables)
    let pdfBuffer: Buffer | null = null;
    const filePrefix = groupOrderType === 'COMPETITIVE_QUOTE' ? 'CompQuote'
      : groupOrderType === 'QUOTE' ? 'Quote'
      : 'Order';
    const pdfFileName = isConsumables
      ? `PickupList_${job.jobNumber}_${todayShort.replace(/,?\s/g, "_")}.pdf`
      : `${supplierName ?? "Order"}_${filePrefix}_${job.jobNumber}_${todayShort.replace(/,?\s/g, "_")}.pdf`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pdfBuffer = Buffer.from(await renderToBuffer(React.createElement(StockOrderPdf, { data: pdfData }) as any));
      console.log(`[stock-order] PDF generation: ${pdfBuffer ? pdfBuffer.length + " bytes" : "FAILED"}`);
    } catch (err) {
      console.error("[stock-order] PDF generation failed:", err);
    }

    // Generate Word doc
    let docxBuffer: Buffer | null = null;
    try {
      docxBuffer = await generateOrderDocx(pdfData);
    } catch (err) {
      console.error("[stock-order] DOCX generation failed:", err);
    }

    // Send email
    if (transport) {
      const toEmails = isConsumables
        ? [MICHAEL_EMAIL, JUSTIN_EMAIL].filter(Boolean)
        : supplierEmail
          ? [supplierEmail]
          : [JUSTIN_EMAIL]; // fallback if no supplier email

      const foremanEmail = ccForeman ? (job.foreman?.email ?? null) : null;
      const ccEmails = [...new Set(
        [SAM_CC, JUSTIN_EMAIL, foremanEmail, ...additionalCcEmails]
          .filter((e): e is string => !!e && !toEmails.includes(e))
      )];

      const emailSubject = (!isConsumables && !supplierEmail)
        ? `[NO SUPPLIER EMAIL] ${subject}`
        : subject;

      console.log(`[stock-order] Sending email to: ${toEmails.join(", ")}, cc: ${ccEmails.join(", ")}`);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mailOptions: any = {
          from: `"Oak Ridge Electrical" <${FROM}>`,
          to: toEmails.join(", "),
          cc: ccEmails.join(", "),
          subject: emailSubject,
          text: emailBodyText,
        };

        if (pdfBuffer) {
          mailOptions.attachments = [{
            filename: pdfFileName,
            content: pdfBuffer,
            contentType: "application/pdf",
          }];
        }

        await transport.sendMail(mailOptions);
        console.log(`[stock-order] Email sent OK`);
      } catch (err) {
        console.error("[stock-order] email failed:", err);
      }
    }

    // Save StockOrder
    const order = await prisma.stockOrder.create({
      data: {
        jobId,
        supplierName: supplierName || "Pickup",
        supplierEmail: supplierEmail || null,
        deliveryMethod: deliveryMethod || "PICKUP",
        orderType: groupOrderType,
        poNumber: poNumber || null,
        deliveryNotes: deliveryNotes || null,
        items: requests.map(r => ({
          name: r.stockItem?.name ?? r.customItemName,
          variables: r.variables,
          quantity: r.quantity,
          unit: r.quantityUnit ?? r.stockItem?.unitOfMeasure,
          note: r.note,
          deliveryMethod: r.deliveryMethod,
          addedBy: r.user.name,
        })),
        sentById: session.user.id,
      },
    });

    // Archive PDF to Document Vault
    const docLabel = groupOrderType === 'COMPETITIVE_QUOTE' ? 'Competitive Quote'
      : groupOrderType === 'QUOTE' ? 'Quote Request'
      : 'Stock Order';
    const docName = isConsumables
      ? `${todayISO} — Pickup List — Stock Order`
      : `${todayISO} — ${supplierName} — ${docLabel}`;

    const docContent = pdfBuffer
      ? `data:application/pdf;base64,${pdfBuffer.toString("base64")}`
      : `data:text/plain;base64,${Buffer.from(emailBodyText).toString("base64")}`;

    const docFileName = pdfBuffer ? pdfFileName : `${docName}.txt`;

    await prisma.document.create({
      data: {
        jobId,
        uploadedById: session.user.id,
        category: "STOCK_ORDERS",
        name: docName,
        fileUrl: docContent,
        fileName: docFileName,
      },
    });

    console.log(`[stock-order] Document saved: ${docName}`);

    // Archive Word doc to Document Vault (if generated)
    if (docxBuffer) {
      const docxName = isConsumables
        ? `${todayISO} — Pickup List — Stock Order (Word)`
        : `${todayISO} — ${supplierName} — ${docLabel} (Word)`;
      const docxFileName = isConsumables
        ? `PickupList_${job.jobNumber}_${todayISO}.docx`
        : `${supplierName}_${filePrefix}_${job.jobNumber}_${todayISO}.docx`;

      await prisma.document.create({
        data: {
          jobId,
          uploadedById: session.user.id,
          category: "STOCK_ORDERS",
          name: docxName,
          fileUrl: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${docxBuffer.toString("base64")}`,
          fileName: docxFileName,
        },
      });
      console.log(`[stock-order] Word doc saved: ${docxName}`);
    }

    // Mark requests as SENT
    await prisma.stockRequest.updateMany({
      where: { id: { in: requestIds } },
      data: { status: "SENT" },
    });

    // Handle saveToMasterList custom items
    const saveItems = requests.filter(r => r.saveToMasterList && !r.stockItemId && r.customItemName);
    for (const r of saveItems) {
      const existing = await prisma.stockItem.findFirst({ where: { name: r.customItemName! } });
      if (!existing) {
        await prisma.stockItem.create({
          data: {
            category: r.customCategory ?? "Misc Hardware & Specialty",
            name: r.customItemName!,
            unitOfMeasure: r.quantityUnit ?? "EA",
          },
        });
        // FIX 1: Notification for "Save to Master List" removed — no email sent when stock item is added to master list
      }
    }

    results.push({ supplierName, itemCount: requests.length, orderId: order.id });
  }

  return NextResponse.json({ ok: true, orders: results });
}
