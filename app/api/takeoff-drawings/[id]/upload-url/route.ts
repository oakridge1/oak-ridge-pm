export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

function canEstimate(u: any) {
  if (!u) return false;
  return u.role === "ADMIN" || u.estimatingPermission === true;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new NextResponse("Storage not configured", { status: 500 });
  }

  const { id } = await params;
  const drawing = await prisma.takeoffDrawing.findUnique({ where: { id } });
  if (!drawing) return new NextResponse("Drawing not found", { status: 404 });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Ensure bucket exists (idempotent — ignore "already exists" error)
  await supabase.storage.createBucket("takeoff-pdfs", { public: false });

  const filePath = `${id}.pdf`;
  const { data, error } = await supabase.storage
    .from("takeoff-pdfs")
    .createSignedUploadUrl(filePath);

  if (error || !data) {
    console.error("[upload-url] Signed URL error:", error);
    return new NextResponse(`Signed URL error: ${error?.message ?? "unknown"}`, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    storagePath: `takeoff-pdfs/${filePath}`,
  });
}
