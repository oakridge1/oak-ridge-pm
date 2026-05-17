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
  const body = await req.json();
  const { reason } = body;

  const approval = await prisma.stockApprovalRequest.findUnique({
    where: { id: approvalId },
    include: {
      requestedBy: { select: { name: true, email: true } },
      job: { select: { jobName: true, jobNumber: true } },
    },
  });

  if (!approval || approval.jobId !== jobId) return new NextResponse("Not found", { status: 404 });
  if (approval.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 400 });

  await prisma.stockApprovalRequest.update({
    where: { id: approvalId },
    data: { status: "REJECTED", rejectionReason: reason || null, reviewedById: session.user.id, reviewedAt: new Date() },
  });

  await prisma.stockRequest.updateMany({
    where: { approvalRequestId: approvalId },
    data: { status: "CANCELLED" },
  });

  // Notify requester
  const transport = getTransport();
  if (transport && approval.requestedBy.email) {
    try {
      await transport.sendMail({
        from: `"Oak Ridge Electrical" <${FROM}>`,
        to: approval.requestedBy.email,
        cc: SAM_CC,
        subject: `Order Request Not Approved — ${approval.job.jobNumber} ${approval.job.jobName}`,
        text: `Hi ${approval.requestedBy.name ?? ""},\n\nYour material order request for job ${approval.job.jobNumber} ${approval.job.jobName} was not approved.${reason ? `\n\nReason: ${reason}` : ""}\n\nPlease contact your Foreman or Admin for details.\n\nOak Ridge Electrical LLC`,
      });
    } catch (err) {
      console.error("[approval reject] email failed:", err);
    }
  }

  return NextResponse.json({ ok: true });
}
