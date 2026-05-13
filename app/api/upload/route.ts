import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET_MAP: Record<string, string> = {
  jobPhoto: "job-photos",
  materialAttachment: "material-attachments",
};

export async function POST(req: NextRequest) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json(
      { error: "Storage not configured — add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env" },
      { status: 500 }
    );
  }

  const session = await auth();
  if (!session?.user?.active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  const endpoint = (form.get("endpoint") as string) ?? "jobPhoto";
  const bucket = BUCKET_MAP[endpoint] ?? "job-photos";

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Ensure bucket exists (idempotent — ignores "already exists" error)
  const { error: bucketErr } = await supabase.storage.createBucket(bucket, { public: true });
  if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.includes("Duplicate")) {
    return NextResponse.json(
      { error: `Supabase bucket setup failed: ${bucketErr.message}` },
      { status: 500 }
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: `Supabase upload failed: ${uploadErr.message}` },
      { status: 500 }
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
