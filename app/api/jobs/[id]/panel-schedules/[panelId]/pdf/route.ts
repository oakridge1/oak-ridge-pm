export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import fs from "fs";
import path from "path";
import { PanelSchedulePdf, type Sleeve } from "./_panel-templates";

function getLogoSrc(): string | undefined {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; panelId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });

    const { panelId } = await params;
    const sleeveParam = new URL(req.url).searchParams.get("sleeve");
    const sleeve: Sleeve = sleeveParam === "7x7" ? "7x7" : "6x9";

    const panel = await prisma.panelSchedule.findUnique({
      where: { id: panelId },
      include: {
        circuits: { orderBy: { ckt: "asc" } },
        job: { select: { jobName: true, address: true, city: true, state: true, zip: true } },
      },
    });
    if (!panel) return new NextResponse("Not found", { status: 404 });

    const logoSrc = getLogoSrc();

    const doc = React.createElement(PanelSchedulePdf, {
      panel: {
        name: panel.name,
        system: panel.system,
        phases: panel.phases,
        busAmps: panel.busAmps,
        mainType: panel.mainType,
        mainAmps: panel.mainAmps,
        fedAmps: panel.fedAmps,
        fedFrom: panel.fedFrom,
        location: panel.location,
        breakerType: panel.breakerType,
        catalogNumber: panel.catalogNumber,
        circuitCount: panel.circuitCount,
        afc: panel.afc,
        aicRating: panel.aicRating,
        enclosure: panel.enclosure,
        integralTVSS: panel.integralTVSS,
      },
      circuits: panel.circuits.map((c) => ({
        ckt: c.ckt,
        status: c.status,
        description: c.description,
        poles: c.poles,
        amps: c.amps,
        flags: c.flags,
      })),
      job: panel.job,
      logoSrc,
      sleeve,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buf = await renderToBuffer(doc as any);

    const filename = `${panel.name.replace(/\s+/g, "_")}_Panel_Schedule_${sleeve}.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[Panel PDF] Error generating PDF:", err);
    return new NextResponse(
      `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }
}
