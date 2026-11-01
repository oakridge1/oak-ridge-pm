// ── lib/document-zip.ts ───────────────────────────────────────────────────────
// Builds a dated ZIP of selected job documents (plus a "Document List" text
// file) entirely in the browser, so it isn't limited by the serverless response
// size. Files are public Supabase Storage URLs, which allow cross-origin reads.
// Folder names match the server ZIP route (documents/zip/route.ts).

import { nyDate } from "./photo-zip";

export type ZipDocument = {
  id: string;
  category: string;
  customCategory?: string | null;
  fileUrl: string;
  fileName: string;
  createdAt: Date | string;
};

export type DocumentZipResult = {
  blob: Blob;
  fileName: string;
  total: number;
  failed: number;
};

// Same labels as CATEGORY_LABELS in app/api/jobs/[id]/documents/zip/route.ts.
const CATEGORY_FOLDERS: Record<string, string> = {
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

// Same rule as the server ZIP: the custom category value if set, else the label.
export function folderFor(doc: Pick<ZipDocument, "category" | "customCategory">): string {
  return doc.customCategory
    ? doc.customCategory
    : (CATEGORY_FOLDERS[doc.category] ?? doc.category);
}

export async function buildDocumentZip(opts: {
  docs: ZipDocument[];
  jobNumber: string;
  jobName: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<DocumentZipResult> {
  const { jobNumber, jobName, onProgress } = opts;
  const JSZip = (await import("jszip")).default;

  // Stable order: by folder, then oldest to newest.
  const docs = [...opts.docs].sort((a, b) => {
    const f = folderFor(a).localeCompare(folderFor(b));
    return f !== 0 ? f : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const total = docs.length;

  // Unique file name per folder (same rule as the server ZIP for the characters).
  const used = new Set<string>();
  const items = docs.map((doc) => {
    const folder = folderFor(doc);
    const safe = doc.fileName.replace(/[^a-zA-Z0-9._\-\s]/g, "_");
    let name = safe;
    let n = 2;
    while (used.has(`${folder}/${name}`)) {
      const dot = safe.lastIndexOf(".");
      name = dot > 0 ? `${safe.slice(0, dot)} (${n})${safe.slice(dot)}` : `${safe} (${n})`;
      n += 1;
    }
    used.add(`${folder}/${name}`);
    return { doc, folder, name, blob: null as Blob | null };
  });

  let done = 0;
  onProgress?.(0, total);

  // A few at a time keeps memory and connections reasonable.
  let next = 0;
  const workers = Array.from({ length: Math.min(4, total) }, async () => {
    while (next < total) {
      const i = next++;
      try {
        const res = await fetch(items[i].doc.fileUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        items[i].blob = await res.blob();
      } catch {
        // left null; counted as failed and listed in the document list
      }
      done += 1;
      onProgress?.(done, total);
    }
  });
  await Promise.all(workers);

  // Add in sorted order, regardless of the order downloads finished.
  const zip = new JSZip();
  for (const it of items) {
    if (it.blob) zip.folder(it.folder)?.file(it.name, it.blob);
  }

  const today = nyDate(new Date());
  const nl = "\r\n";
  const ok = items.filter((it) => it.blob);
  const failed = items.filter((it) => !it.blob);
  const lines: string[] = [
    "Oak Ridge Electrical",
    `Job #: ${jobNumber}`,
    `Job: ${jobName}`,
    `Downloaded: ${today}`,
    `Files: ${ok.length}`,
    "",
  ];
  for (const it of ok) {
    lines.push(
      `Folder: ${it.folder}`,
      `  File: ${it.name}`,
      `  Uploaded: ${nyDate(it.doc.createdAt)}`,
      "",
    );
  }
  if (failed.length > 0) {
    lines.push(`NOT INCLUDED (${failed.length} file${failed.length !== 1 ? "s" : ""} could not be downloaded):`);
    for (const it of failed) {
      lines.push(
        `Folder: ${it.folder}`,
        `  File: ${it.name}`,
        `  Uploaded: ${nyDate(it.doc.createdAt)}`,
        "",
      );
    }
  }
  zip.file(`Document List ${today}.txt`, lines.join(nl) + nl);

  // Documents are mostly PDFs/images (already compressed): store as-is (faster).
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });

  const safeNumber = jobNumber.replace(/[^A-Za-z0-9._-]+/g, "_");
  const safeName = jobName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 50);
  return {
    blob,
    fileName: `${safeNumber}_${safeName}_Documents_${today}.zip`,
    total,
    failed: failed.length,
  };
}
