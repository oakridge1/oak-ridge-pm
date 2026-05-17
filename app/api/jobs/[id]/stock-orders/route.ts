export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { StockOrderPdf } from "../pdf/_templates";

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

  // Check permission to send orders for TEAMMATE
  if (role === "TEAMMATE") {
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
  const results = [];

  for (const group of groups) {
    const { supplierName, supplierEmail, requestIds, isConsumables } = group;

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

    const subject = isConsumables
      ? `Pickup List — ${job.jobNumber} ${job.jobName} — ${today}`
      : `Material Order — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`;

    const emailBodyText = isConsumables
      ? [
          `PICKUP / CONSUMABLES LIST`,
          `Job: ${job.jobName} (Job #${job.jobNumber})`,
          poNumber ? `PO / Job #: ${poNumber}` : "",
          `Delivery: ${deliveryStr}`,
          deliveryNotes ? `Notes: ${deliveryNotes}` : "",
          "",
          "ITEMS:",
          requests.map(r => buildItemLine(r)).join("\n"),
          "",
          "—",
          "Oak Ridge Electrical LLC",
          "209 W. River Rd, Hooksett, NH 03106",
          "603-660-4651",
        ].filter(s => s !== undefined).join("\n")
      : `Please find our material order attached. Delivery: ${deliveryShort}. PO/Job: ${poNumber ?? job.jobNumber}. Thank you, Oak Ridge Electrical LLC — Justin Marceau, Owner — 603-660-4651 | Justin@oakridgeelectrical.com`;

    // Generate PDF for electrical orders
    let pdfBuffer: Buffer | null = null;
    const pdfFileName = `${supplierName ?? "Order"}_Order_${job.jobNumber}_${todayShort.replace(/,?\s/g, "_")}.pdf`;

    if (!isConsumables) {
      try {
        const pdfData = {
          supplierName: supplierName ?? "",
          supplierRepName: null,
          supplierEmail: supplierEmail ?? null,
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
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfBuffer = Buffer.from(await renderToBuffer(React.createElement(StockOrderPdf, { data: pdfData }) as any));
      } catch (err) {
        console.error("[stock-order] PDF generation failed:", err);
      }
    }

    // Send email
    if (transport) {
      const toEmails = isConsumables
        ? [MICHAEL_EMAIL, JUSTIN_EMAIL].filter(Boolean)
        : supplierEmail ? [supplierEmail] : [];

      const ccEmails = [SAM_CC, JUSTIN_EMAIL, job.foreman?.email].filter((e): e is string => !!e && !toEmails.includes(e));

      if (toEmails.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mailOptions: any = {
            from: `"Oak Ridge Electrical" <${FROM}>`,
            to: toEmails.join(", "),
            cc: [...new Set(ccEmails)].join(", "),
            subject,
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
        } catch (err) {
          console.error("[stock-order] email failed:", err);
        }
      }
    }

    // Save StockOrder
    const order = await prisma.stockOrder.create({
      data: {
        jobId,
        supplierName: supplierName || "Pickup",
        supplierEmail: supplierEmail || null,
        deliveryMethod: deliveryMethod || "PICKUP",
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

    // Archive to Document Vault
    const docName = isConsumables
      ? `Pickup List — ${todayShort}`
      : `Order — ${supplierName} — ${todayShort}`;

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
        // Notify admins
        if (transport) {
          const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { email: true } });
          const requesterName = r.user.name ?? "Unknown";
          const toAdmins = [JUSTIN_EMAIL, ...admins.map(a => a.email).filter((e): e is string => !!e)].filter((v, i, a) => a.indexOf(v) === i);
          try {
            await transport.sendMail({
              from: `"Oak Ridge Electrical" <${FROM}>`,
              to: toAdmins.join(", "),
              cc: SAM_CC,
              subject: `New Stock Item Added — ${r.customItemName}`,
              text: `New item added to master stock list: "${r.customItemName}" in ${r.customCategory ?? "Misc"} — added by ${requesterName}. Review in Admin → Settings → Stock List.`,
            });
          } catch (err) {
            console.error("[stock-order] save-to-master-list email failed:", err);
          }
        }
      }
    }

    results.push({ supplierName, itemCount: requests.length, orderId: order.id });
  }

  return NextResponse.json({ ok: true, orders: results });
}
