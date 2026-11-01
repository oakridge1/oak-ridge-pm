// ── lib/photo-zip.ts ──────────────────────────────────────────────────────────
// Builds a dated ZIP of job photos (plus a "Photo Notes" text file) entirely in
// the browser, so it isn't limited by the serverless response size. Photos are
// public Supabase Storage URLs, which allow cross-origin reads.

const TZ = "America/New_York";

export type ZipPhoto = {
  id: string;
  url: string;
  caption: string | null;
  createdAt: Date | string;
  user: { name: string | null };
};

export type PhotoZipResult = {
  blob: Blob;
  fileName: string;
  total: number;
  failed: number;
};

// YYYY-MM-DD in New York time (en-CA formats dates as year-month-day).
export function nyDate(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(d));
}

function nyDateTime(d: Date | string): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(new Date(d));
  return `${nyDate(d)} ${time}`;
}

function safePart(s: string, max: number): string {
  return s
    .replace(/[^A-Za-z0-9 _-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, max)
    .replace(/[_-]+$/, "");
}

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/gif": "gif", "image/heic": "heic", "image/heif": "heif",
};

function extensionFor(url: string, mime: string): string {
  try {
    const last = new URL(url).pathname.split("/").pop() ?? "";
    const m = last.match(/\.([A-Za-z0-9]{2,5})$/);
    if (m) return m[1].toLowerCase();
  } catch { /* fall through to the MIME type */ }
  return MIME_EXT[mime.toLowerCase()] ?? "jpg";
}

export async function buildPhotoZip(opts: {
  photos: ZipPhoto[];
  jobNumber: string;
  jobName: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<PhotoZipResult> {
  const { jobNumber, jobName, onProgress } = opts;
  const JSZip = (await import("jszip")).default;

  // Oldest to newest, numbered in that order.
  const photos = [...opts.photos].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const total = photos.length;
  const width = Math.max(3, String(total).length);

  const today = nyDate(new Date());
  const zip = new JSZip();
  const entries: { name: string; photo: ZipPhoto; ok: boolean }[] = new Array(total);
  // Downloads finish in any order, so hold the files and add them to the ZIP in
  // numbered order afterwards.
  const blobs: (Blob | null)[] = new Array(total).fill(null);

  let done = 0;
  onProgress?.(0, total);

  async function fetchOne(i: number) {
    const photo = photos[i];
    const num = String(i + 1).padStart(width, "0");
    const cap = photo.caption ? safePart(photo.caption, 40) : "";
    let name = `${nyDate(photo.createdAt)}_${num}${cap ? `_${cap}` : ""}.jpg`;
    let ok = false;
    try {
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = extensionFor(photo.url, blob.type || "");
      name = name.replace(/\.jpg$/, `.${ext}`);
      blobs[i] = blob;
      ok = true;
    } catch {
      // leave ok = false; counted as failed and listed in the notes file
    }
    entries[i] = { name, photo, ok };
    done += 1;
    onProgress?.(done, total);
  }

  // A few at a time keeps memory and connections reasonable.
  let next = 0;
  const workers = Array.from({ length: Math.min(4, total) }, async () => {
    while (next < total) {
      const i = next++;
      await fetchOne(i);
    }
  });
  await Promise.all(workers);

  // Add in numbered order (001, 002, 003…).
  for (let i = 0; i < total; i++) {
    const blob = blobs[i];
    if (blob) zip.file(entries[i].name, blob);
  }

  const failedEntries = entries.filter((e) => !e.ok);
  const nl = "\r\n";
  const lines: string[] = [
    "Oak Ridge Electrical",
    `Job #: ${jobNumber}`,
    `Job: ${jobName}`,
    `Downloaded: ${today}`,
    `Photos: ${total - failedEntries.length}`,
    "",
  ];
  for (const e of entries.filter((x) => x.ok)) {
    lines.push(
      e.name,
      `  Uploaded: ${nyDateTime(e.photo.createdAt)}`,
      `  Uploaded by: ${e.photo.user.name ?? "Unknown"}`,
      `  Notes: ${e.photo.caption?.trim() || "(none)"}`,
      "",
    );
  }
  if (failedEntries.length > 0) {
    lines.push(`NOT INCLUDED (${failedEntries.length} photo${failedEntries.length !== 1 ? "s" : ""} could not be downloaded):`);
    for (const e of failedEntries) {
      lines.push(
        `  ${e.name}`,
        `    Uploaded: ${nyDateTime(e.photo.createdAt)} by ${e.photo.user.name ?? "Unknown"}`,
        `    Notes: ${e.photo.caption?.trim() || "(none)"}`,
      );
    }
  }
  zip.file(`Photo Notes ${today}.txt`, lines.join(nl) + nl);

  // Photos are already compressed, so store them as-is (faster).
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });

  const safeNumber = jobNumber.replace(/[^A-Za-z0-9._-]+/g, "_");
  const safeName = jobName.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 50);
  return {
    blob,
    fileName: `${safeNumber}_${safeName}_Photos_${today}.zip`,
    total,
    failed: failedEntries.length,
  };
}
