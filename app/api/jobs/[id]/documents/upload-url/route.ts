export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

// Signed direct-upload URL for the Document Vault — the browser PUTs the file
// straight to Supabase Storage, bypassing Vercel's ~4.5MB body limit.
// Modeled on app/api/takeoff-drawings/[id]/upload-url/route.ts.

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB — Supabase free tier max

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const body = await req.json().catch(() => null) as
    { fileName?: string; fileType?: string; fileSize?: number } | null;
  if (!body?.fileName) {
    return NextResponse.json({ error: "fileName required" }, { status: 400 });
  }
  if (typeof body.fileSize === "number" && body.fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum size is 100MB." }, { status: 413 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Ensure bucket exists (idempotent — same public bucket /api/upload uses)
  await supabase.storage.createBucket("job-documents", { public: true });

  const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${id}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from("job-documents")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[documents/upload-url] Signed URL error:", error);
    return NextResponse.json(
      { error: `Signed URL error: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  const { data: pub } = supabase.storage.from("job-documents").getPublicUrl(path);

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,
    publicUrl: pub.publicUrl,
  });
}
