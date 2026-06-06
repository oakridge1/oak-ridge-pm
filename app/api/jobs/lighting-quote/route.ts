export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

const JUSTIN = 'justin@oakridgeelectrical.com';
const SAM    = 'sam@oakridgeelectrical.com';

interface QuoteItem {
  typeLabel:   string;
  description: string;
  qty:         number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.active) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fd = await req.formData();

  const jobId       = fd.get('jobId')       as string;
  const jobNumber   = fd.get('jobNumber')   as string;
  const jobName     = fd.get('jobName')     as string;
  const vendorName  = fd.get('vendorName')  as string;
  const vendorEmail = fd.get('vendorEmail') as string;
  const items       = JSON.parse(fd.get('items')    as string) as QuoteItem[];
  const notes       = (fd.get('notes')      as string) ?? '';
  const ccEmails    = JSON.parse((fd.get('ccEmails') as string) ?? '[]') as string[];
  const drawings    = fd.getAll('drawings') as File[];

  if (!vendorEmail || !items?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // ── Build HTML table ──────────────────────────────────────────────────────
  const itemRows = items.map((item, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'}">
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:bold;color:#1a3a5c;">
        ${item.typeLabel}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;">
        ${item.description}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center;font-weight:bold;">
        ${item.qty}</td>
    </tr>
  `).join('');

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;">
      <div style="background:#1a3a5c;padding:24px;border-radius:8px 8px 0 0;">
        <h1 style="color:white;margin:0;font-size:22px;letter-spacing:1px;">
          LIGHTING FIXTURE QUOTE REQUEST
        </h1>
        <p style="color:#93c5fd;margin:6px 0 0;font-size:14px;">Oak Ridge Electrical LLC</p>
      </div>

      <div style="background:#eff6ff;padding:14px 20px;border:1px solid #bfdbfe;border-top:none;">
        <p style="margin:0;color:#1d4ed8;font-size:14px;">
          Please provide your best unit pricing for the fixtures listed below.
          Project drawings are attached for reference.
        </p>
      </div>

      <div style="padding:20px;border:1px solid #e5e7eb;border-top:none;">
        <table style="margin-bottom:16px;font-size:13px;">
          <tr>
            <td style="color:#6b7280;padding:3px 16px 3px 0;font-size:12px;
              text-transform:uppercase;letter-spacing:.5px;">Job</td>
            <td style="font-weight:bold;">${jobName}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:3px 16px 3px 0;font-size:12px;
              text-transform:uppercase;letter-spacing:.5px;">Job #</td>
            <td style="font-weight:bold;">${jobNumber}</td>
          </tr>
          <tr>
            <td style="color:#6b7280;padding:3px 16px 3px 0;font-size:12px;
              text-transform:uppercase;letter-spacing:.5px;">Date</td>
            <td>${today}</td>
          </tr>
        </table>

        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
          <thead>
            <tr style="background:#1a3a5c;color:white;">
              <th style="padding:10px 12px;text-align:left;border:1px solid #1a3a5c;width:100px;">
                Type</th>
              <th style="padding:10px 12px;text-align:left;border:1px solid #1a3a5c;">
                Fixture Description</th>
              <th style="padding:10px 12px;text-align:center;border:1px solid #1a3a5c;width:60px;">
                Qty</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        ${notes ? `
          <div style="padding:12px;background:#fefce8;border:1px solid #fde047;
            border-radius:6px;font-size:13px;margin-bottom:16px;">
            <strong>Notes:</strong> ${notes}
          </div>` : ''}

        <div style="padding:14px;background:#f9fafb;border-radius:6px;
          font-size:12px;color:#4b5563;">
          Oak Ridge Electrical is soliciting competitive quotes from multiple vendors.
          We will award based on pricing and availability.
          Please reply with unit pricing per fixture type.
        </div>
      </div>

      <div style="padding:14px 20px;background:#f3f4f6;border:1px solid #e5e7eb;
        border-top:none;border-radius:0 0 8px 8px;font-size:11px;color:#9ca3af;">
        Oak Ridge Electrical LLC &nbsp;|&nbsp; 209 W. River Rd, Hooksett, NH 03106
        &nbsp;|&nbsp; 603-660-4651 &nbsp;|&nbsp; Justin@oakridgeelectrical.com
      </div>
    </div>
  `;

  // ── Build attachments ─────────────────────────────────────────────────────
  const emailAttachments = await Promise.all(
    drawings.map(async file => ({
      filename:    file.name,
      content:     Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'application/pdf',
    }))
  );

  // ── Send email ────────────────────────────────────────────────────────────
  const FROM = process.env.EMAIL_FROM;
  const PASS = process.env.GMAIL_APP_PASSWORD;

  if (FROM && PASS) {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: FROM, pass: PASS },
    });

    const ccList = [SAM, JUSTIN, ...ccEmails].filter(
      (e, i, arr) => e && e !== vendorEmail && arr.indexOf(e) === i
    );

    await transport.sendMail({
      from:        `"Oak Ridge Electrical" <${FROM}>`,
      to:          vendorEmail,
      cc:          ccList.join(', '),
      subject:     `Lighting Quote Request — ${vendorName} — ${jobNumber} ${jobName}`,
      html,
      attachments: emailAttachments,
    });
  }

  // ── Mark pending items as QUOTED ──────────────────────────────────────────
  if (jobId) {
    await prisma.lightingScheduleItem.updateMany({
      where: { jobId, quoteStatus: 'PENDING' },
      data:  { quoteStatus: 'QUOTED' },
    });
  }

  return NextResponse.json({ success: true });
}
