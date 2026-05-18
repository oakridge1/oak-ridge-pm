export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer, Document, Page, View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import React from "react";
import fs from "fs";
import path from "path";

const NAVY = "#002D72";
const ORANGE = "#FF5910";
const GRAY = "#555555";
const BORDER = "#e0e0e0";

const DS = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 50, color: "#1a1a1a" },
  headerCenter: { alignItems: "center", marginBottom: 16 },
  logo: { width: 56, height: 56, marginBottom: 6 },
  companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "center", letterSpacing: 0.8 },
  companyInfo: { fontSize: 8, color: GRAY, textAlign: "center", marginTop: 3, lineHeight: 1.5 },
  divider: { borderBottomWidth: 2, borderBottomColor: NAVY, borderBottomStyle: "solid", marginVertical: 10 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: ORANGE, textAlign: "center", marginVertical: 14, letterSpacing: 1 },
  toSection: { marginBottom: 14 },
  label: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, marginBottom: 4, textTransform: "uppercase" as const },
  value: { fontSize: 10, color: "#1a1a1a", lineHeight: 1.5 },
  amountBox: {
    backgroundColor: "#f0f4ff", borderRadius: 4, padding: 14,
    marginVertical: 16, borderWidth: 1, borderColor: BORDER, borderStyle: "solid",
  },
  amountLabel: { fontSize: 8, color: GRAY, marginBottom: 4 },
  amountValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: NAVY },
  amountSub: { fontSize: 9, color: GRAY, marginTop: 4 },
  dueDate: { fontSize: 10, color: "#1a1a1a", marginTop: 6 },
  notes: { fontSize: 9, color: GRAY, marginTop: 10, lineHeight: 1.6 },
  payInstructions: { marginTop: 20, borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: "solid", paddingTop: 12 },
  payLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 0.8, marginBottom: 6 },
  payText: { fontSize: 9, color: GRAY, lineHeight: 1.6 },
  signature: { marginTop: 24, fontSize: 9, color: GRAY },
  footer: {
    position: "absolute", bottom: 28, left: 50, right: 50,
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 1, borderTopColor: BORDER, borderTopStyle: "solid", paddingTop: 5,
  },
  footerText: { fontSize: 7, color: "#aaaaaa" },
});

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch { /* ignore */ }
  return undefined;
}

function fmt$(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id: jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      jobName: true,
      jobNumber: true,
      gcContactName: true,
      gcCompany: true,
      gcEmail: true,
      address: true,
      city: true,
      state: true,
      zip: true,
    },
  });
  if (!job) return new NextResponse("Job not found", { status: 404 });

  const body = await req.json();
  const { amountType, fixedAmount, percentage, contractValue, dueDate, description, notes } = body;

  let depositAmount: number;
  let amountSubtext = "";

  if (amountType === "percentage") {
    const pct = parseFloat(percentage) || 0;
    const contract = parseFloat(contractValue) || 0;
    depositAmount = contract * (pct / 100);
    amountSubtext = `${pct}% of contract value of ${fmt$(contract)}`;
  } else {
    depositAmount = parseFloat(fixedAmount) || 0;
  }

  // Build the "To" address block
  const toLines: string[] = [];
  if (job.gcContactName) toLines.push(job.gcContactName);
  if (job.gcCompany) toLines.push(job.gcCompany);
  const addrParts = [job.address, [job.city, job.state].filter(Boolean).join(", "), job.zip].filter(Boolean);
  if (addrParts.length > 0) toLines.push(addrParts.join(" "));
  const toText = toLines.length > 0 ? toLines.join("\n") : "—";

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const logoSrc = getLogoSrc();

  const pdfDoc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "LETTER", style: DS.page } as Record<string, unknown>,
      // Header
      React.createElement(
        View,
        { style: DS.headerCenter } as Record<string, unknown>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        logoSrc ? React.createElement(Image as React.ComponentType<any>, { src: logoSrc, style: DS.logo }) : null,
        React.createElement(Text, { style: DS.companyName } as Record<string, unknown>, "OAK RIDGE ELECTRICAL LLC"),
        React.createElement(Text, { style: DS.companyInfo } as Record<string, unknown>, "209 W. River Rd, Hooksett, NH 03106\n603-660-4651  |  Justin@oakridgeelectrical.com")
      ),
      React.createElement(View, { style: DS.divider } as Record<string, unknown>),
      React.createElement(Text, { style: DS.title } as Record<string, unknown>, "DEPOSIT REQUEST"),
      // To section
      React.createElement(
        View,
        { style: DS.toSection } as Record<string, unknown>,
        React.createElement(Text, { style: DS.label } as Record<string, unknown>, "To"),
        React.createElement(Text, { style: DS.value } as Record<string, unknown>, toText)
      ),
      React.createElement(
        View,
        { style: DS.toSection } as Record<string, unknown>,
        React.createElement(Text, { style: DS.label } as Record<string, unknown>, "Project"),
        React.createElement(Text, { style: DS.value } as Record<string, unknown>,
          `${job.jobName}  (Job #${job.jobNumber})`
        ),
        React.createElement(Text, { style: DS.value } as Record<string, unknown>, `Date: ${today}`)
      ),
      // Amount box
      React.createElement(
        View,
        { style: DS.amountBox } as Record<string, unknown>,
        React.createElement(Text, { style: DS.amountLabel } as Record<string, unknown>, "DEPOSIT AMOUNT"),
        React.createElement(Text, { style: DS.amountValue } as Record<string, unknown>, fmt$(depositAmount)),
        amountSubtext ? React.createElement(Text, { style: DS.amountSub } as Record<string, unknown>, amountSubtext) : null,
        dueDate ? React.createElement(Text, { style: DS.dueDate } as Record<string, unknown>,
          `Due Date: ${new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
        ) : null,
        description ? React.createElement(Text, { style: DS.dueDate } as Record<string, unknown>, description) : null
      ),
      // Notes
      notes ? React.createElement(Text, { style: DS.notes } as Record<string, unknown>, notes) : null,
      // Payment instructions
      React.createElement(
        View,
        { style: DS.payInstructions } as Record<string, unknown>,
        React.createElement(Text, { style: DS.payLabel } as Record<string, unknown>, "Payment Instructions"),
        React.createElement(Text, { style: DS.payText } as Record<string, unknown>,
          "Please remit payment to:\nOak Ridge Electrical LLC\n209 W. River Rd, Hooksett, NH 03106\nChecks payable to \"Oak Ridge Electrical LLC\""
        )
      ),
      React.createElement(Text, { style: DS.signature } as Record<string, unknown>,
        "\n\nJustin Marceau, Owner\nOak Ridge Electrical LLC"
      ),
      // Footer
      React.createElement(
        View,
        { style: DS.footer, fixed: true } as Record<string, unknown>,
        React.createElement(Text, { style: DS.footerText } as Record<string, unknown>,
          "Thank you for your business! Oak Ridge Electrical LLC — Justin Marceau, Owner — 603-660-4651 | Justin@oakridgeelectrical.com"
        ),
        React.createElement(Text, { style: DS.footerText } as Record<string, unknown>, `Generated ${today}`)
      )
    )
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = Buffer.from(await renderToBuffer(pdfDoc as any));

  const filename = `DepositRequest_${job.jobNumber}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
