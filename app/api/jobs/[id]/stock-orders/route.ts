export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

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

function buildItemLine(req: {
  stockItem: { name: string; lingo: string | null; unitOfMeasure: string } | null;
  customItemName: string | null;
  variables: Record<string, string> | null;
  quantity: number;
  quantityUnit: string | null;
  note: string | null;
  deliveryMethod: string;
}): string {
  const name = req.stockItem?.name ?? req.customItemName ?? "Custom Item";
  const vars = req.variables ? Object.values(req.variables).filter(Boolean).join(", ") : "";
  const varStr = vars ? ` — ${vars}` : "";
  const delivery = req.deliveryMethod === "PICKUP" ? " [PICKUP]" : req.deliveryMethod === "DELIVERY_SHOP" ? " [DELIVERY: SHOP]" : " [DELIVERY: SITE]";
  return `• ${req.quantity} ${req.quantityUnit ?? req.stockItem?.unitOfMeasure ?? "EA"} — ${name}${varStr}${req.note ? ` (${req.note})` : ""}${delivery}`;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

  const { id: jobId } = await params;
  const role = session.user.role;

  // Check permission to send orders
  if (role === "TEAMMATE") {
    const perm = await prisma.userPermission.findFirst({
      where: { userId: session.user.id, permission: "ORDERING", OR: [{ scope: "GLOBAL" }, { scope: "JOB", jobId }] },
    });
    if (!perm) {
      return NextResponse.json({ error: "NEEDS_APPROVAL", message: "You don't have ordering permission. Request sent to Foreman/Admin for approval." }, { status: 403 });
    }
  }

  const body = await req.json();
  const { groups, poNumber, deliveryNotes } = body;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { jobName: true, jobNumber: true, address: true, city: true, state: true, foreman: { select: { email: true, name: true } } },
  });
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const jobAddress = [job.address, job.city, job.state].filter(Boolean).join(", ");
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const transport = getTransport();
  const results = [];

  for (const group of groups) {
    const { supplierName, supplierEmail, deliveryMethod, requestIds, isConsumables } = group;

    const rawRequests = await prisma.stockRequest.findMany({
      where: { id: { in: requestIds } },
      include: { user: { select: { name: true } }, stockItem: { select: { name: true, lingo: true, unitOfMeasure: true } } },
    });

    if (rawRequests.length === 0) continue;

    const requests = rawRequests.map(r => ({
      ...r,
      variables: (r.variables as Record<string, string> | null),
    }));

    const itemLines = requests.map(buildItemLine).join("\n");
    const deliveryStr = fmtDelivery(deliveryMethod, jobAddress);

    const subject = isConsumables
      ? `Pickup List — ${job.jobNumber} ${job.jobName} — ${today}`
      : `Material Order — ${supplierName} — ${job.jobNumber} ${job.jobName} — ${today}`;

    const emailBody = [
      isConsumables ? `PICKUP / CONSUMABLES LIST` : `MATERIAL ORDER`,
      `Job: ${job.jobName} (Job #${job.jobNumber})`,
      poNumber ? `PO / Job #: ${poNumber}` : "",
      `Delivery: ${deliveryStr}`,
      deliveryNotes ? `Notes: ${deliveryNotes}` : "",
      "",
      "ITEMS:",
      itemLines,
      "",
      "—",
      "Oak Ridge Electrical LLC",
      "209 W. River Rd, Hooksett, NH 03106",
      "603-660-4651",
    ].filter(s => s !== undefined).join("\n");

    // Send email
    if (transport) {
      const toEmails = isConsumables
        ? [MICHAEL_EMAIL, JUSTIN_EMAIL].filter(Boolean)
        : supplierEmail ? [supplierEmail] : [];

      const ccEmails = [SAM_CC, JUSTIN_EMAIL, job.foreman?.email].filter((e): e is string => !!e && !toEmails.includes(e));

      if (toEmails.length > 0) {
        try {
          await transport.sendMail({
            from: `"Oak Ridge Electrical" <${FROM}>`,
            to: toEmails.join(", "),
            cc: [...new Set(ccEmails)].join(", "),
            subject,
            text: emailBody,
          });
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
      ? `Pickup List — ${today}`
      : `Order — ${supplierName} — ${today}`;

    await prisma.document.create({
      data: {
        jobId,
        uploadedById: session.user.id,
        category: "STOCK_ORDERS",
        name: docName,
        fileUrl: `data:text/plain;base64,${Buffer.from(emailBody).toString("base64")}`,
        fileName: `${docName}.txt`,
      },
    });

    // Mark requests as SENT
    await prisma.stockRequest.updateMany({
      where: { id: { in: requestIds } },
      data: { status: "SENT" },
    });

    results.push({ supplierName, itemCount: requests.length, orderId: order.id });
  }

  return NextResponse.json({ ok: true, orders: results });
}
