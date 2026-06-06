export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ProposalDoc, type ProposalPdfData } from '@/app/api/jobs/[id]/pdf/_templates';

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString('base64')}`;
    }
  } catch { /* ignore */ }
  return undefined;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await req.json() as ProposalPdfData;

  const logoSrc = getLogoSrc();
  const pdfData: ProposalPdfData = { ...data, logoSrc };

  const buffer = await renderToBuffer(
    React.createElement(ProposalDoc, { data: pdfData }) as any
  );

  const jobSlug = (data.jobNumber || 'proposal').replace(/[^a-z0-9]/gi, '_');
  const filename = `Oak_Ridge_Electrical_Proposal_${jobSlug}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
