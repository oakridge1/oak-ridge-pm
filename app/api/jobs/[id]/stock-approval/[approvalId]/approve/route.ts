export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const FROM = process.env.EMAIL_FROM;
const PASS = process.env.GMAIL_APP_PASSWORD;
const SAM_CC = "sam@oakridgeelectrical.com";

function getTransport() {
  if (!FROM || !PASS) return null;
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 587, secure: false, auth: { user: FROM, pass: PASS } });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; approvalId: string }> }) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "FOREMAN") return new NextResponse("Forbidden", { status: 403 });

  const { id: jobId, approvalId } = await params;

  const approval = await prisma.stockApprovalRequest.findUnique({
    where: { id: approvalId },
    include: {
      requests: {
        include: { stockItem: { select: { name: true, lingo: true, unitOfMeasure: true } }, user: { select: { name: true } } },
      },
      requestedBy: { select: { name: true, email: true } },
      job: { select: { jobName: true, jobNumber: true } },
    },
  });

  if (!approval || approval.jobId !== jobId) return new NextResponse("Not found", { status: 404 });
  if (approval.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 400 });

  // Update approval status
  await prisma.stockApprovalRequest.update({
    where: { id: approvalId },
    data: { status: "APPROVED", reviewedById: session.user.id, reviewedAt: new Date() },
  });

  // Mark requests as PENDING (ready to send)
  await prisma.stockRequest.updateMany({
    where: { approvalRequestId: approvalId },
    data: { status: "PENDING" },
  });

  // Notify requester
  const transport = getTransport();
  if (transport && approval.requestedBy.email) {
    try {
      await transport.sendMail({
        from: `"Oak Ridge Electrical" <${FROM}>`,
        to: approval.requestedBy.email,
        cc: SAM_CC,
        subject: `Order Approved — ${approval.job.jobNumber} ${approval.job.jobName}`,
        text: `Hi ${approval.requestedBy.name ?? ""},\n\nYour material order request for job ${approval.job.jobNumber} ${approval.job.jobName} has been APPROVED. The order will be sent.\n\nOak Ridge Electrical LLC`,
      });
    } catch (err) {
      console.error("[approval approve] email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
