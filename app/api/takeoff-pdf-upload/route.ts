export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Unauthenticated upload/download endpoint for the standalone PDF takeoff
// tool (public/pdf-takeoff.html). The tool has no session context, so this
// route is intentionally not auth-gated — the estimateId scopes access.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Allow only safe path segments (uuids, dwg_<ts>, 'standalone')
const SAFE_ID = /^[a-zA-Z0-9_-]{1,64}$/;

function storageClient() {
  return createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false },
  });
}

// POST — multipart/form-data: file, estimateId, drawingId
// Uploads to takeoff-pdfs/{estimateId}/{drawingId}.pdf and returns a stable
// same-origin URL (this route's GET) so the link never expires — the bucket
// is private and signed URLs would die after their expiry window.
export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new NextResponse("Storage not configured", { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const estimateId = String(formData.get("estimateId") ?? "");
  const drawingId = String(formData.get("drawingId") ?? "");

  if (!file) return new NextResponse("No file", { status: 400 });
  if (!SAFE_ID.test(estimateId) || !SAFE_ID.test(drawingId)) {
    return new NextResponse("Invalid estimateId or drawingId", { status: 400 });
  }

  const supabase = storageClient();

  // Ensure bucket exists (same pattern as takeoff-drawings/[id]/upload-pdf)
  const { error: bucketErr } = await supabase.storage.createBucket("takeoff-pdfs", { public: false });
  if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.includes("Duplicate")) {
    console.error("Supabase bucket setup error:", bucketErr);
    return new NextResponse(`Bucket error: ${bucketErr.message}`, { status: 500 });
  }

  const storagePath = `${estimateId}/${drawingId}.pdf`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from("takeoff-pdfs")
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    return new NextResponse(`Storage error: ${error.message}`, { status: 500 });
  }

  return NextResponse.json({
    url: `/api/takeoff-pdf-upload?estimateId=${estimateId}&drawingId=${drawingId}`,
  });
}

// GET — ?estimateId=..&drawingId=.. → streams the PDF back from storage
export async function GET(req: Request) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new NextResponse("Storage not configured", { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const estimateId = searchParams.get("estimateId") ?? "";
  const drawingId = searchParams.get("drawingId") ?? "";

  if (!SAFE_ID.test(estimateId) || !SAFE_ID.test(drawingId)) {
    return new NextResponse("Invalid estimateId or drawingId", { status: 400 });
  }

  const supabase = storageClient();
  const { data, error } = await supabase.storage
    .from("takeoff-pdfs")
    .download(`${estimateId}/${drawingId}.pdf`);

  if (error || !data) {
    return new NextResponse("PDF not found in storage", { status: 404 });
  }

  const bytes = await data.arrayBuffer();
  return new NextResponse(bytes, {
    headers: { "Content-Type": "application/pdf" },
  });
}
