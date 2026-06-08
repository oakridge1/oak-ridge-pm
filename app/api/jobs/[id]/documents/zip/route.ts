import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";

export const runtime = "nodejs";

interface Params { params: Promise<{ id: string }> }

const CATEGORY_LABELS: Record<string, string> = {
  PLANS: "Plans",
  SPECIFICATIONS: "Specs",
  PERMITS: "Permits",
  SUBMITTALS: "Submittals",
  SUBCONTRACTS: "Subcontracts",
  INSPECTION_REPORTS: "Inspection Reports",
  CLOSEOUT: "Closeout",
  MATERIAL_RECEIPTS: "Material Receipts",
  STOCK_ORDERS: "Stock Orders",
  RECEIPTS: "Receipts",
  OTHER: "Other",
};

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;
  const { categories, excludeCategories } = (await req.json()) as {
    categories?: string[];
    excludeCategories?: string[];
  };

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { jobName: true, jobNumber: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let docs = await prisma.document.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  if (categories && categories.length > 0) {
    docs = docs.filter(
      (d) =>
        categories.includes(d.category) ||
        categories.includes(d.customCategory ?? "")
    );
  }

  if (excludeCategories && excludeCategories.length > 0) {
    docs = docs.filter(
      (d) =>
        !excludeCategories.includes(d.category) &&
        !excludeCategories.includes(d.customCategory ?? "")
    );
  }

  if (docs.length === 0) {
    return NextResponse.json({ error: "No documents found" }, { status: 404 });
  }

  const zip = new JSZip();

  await Promise.all(
    docs.map(async (doc) => {
      try {
        const res = await fetch(doc.fileUrl);
        if (!res.ok) return;
        const buf = await res.arrayBuffer();

        const folder = doc.customCategory
          ? doc.customCategory
          : (CATEGORY_LABELS[doc.category] ?? doc.category);

        const safeName = doc.fileName.replace(/[^a-zA-Z0-9._\-\s]/g, "_");
        zip.folder(folder)?.file(safeName, buf);
      } catch {
        // skip files that fail to fetch
      }
    })
  );

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const jobSlug = `${job.jobNumber}_${job.jobName}`
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 50);

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${jobSlug}_Documents.zip"`,
    },
  });
}
