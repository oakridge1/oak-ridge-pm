export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function canEstimate(u: any) {
  if (!u) return false;
  return u.role === "ADMIN" || u.estimatingPermission === true;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new NextResponse("Storage not configured", { status: 500 });
  }

  const { id } = await params;

  const drawing = await prisma.takeoffDrawing.findUnique({ where: { id } });
  if (!drawing) return new NextResponse("Drawing not found", { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return new NextResponse("No file", { status: 400 });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Ensure bucket exists
  const { error: bucketErr } = await supabase.storage.createBucket("takeoff-pdfs", { public: false });
  if (bucketErr && !bucketErr.message.includes("already exists") && !bucketErr.message.includes("Duplicate")) {
    console.error("Supabase bucket setup error:", bucketErr);
    return new NextResponse(`Bucket error: ${bucketErr.message}`, { status: 500 });
  }

  const storagePath = `${id}.pdf`;
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

  // Save the storage path — not base64
  await prisma.takeoffDrawing.update({
    where: { id },
    data: { pdfData: `takeoff-pdfs/${storagePath}` },
  });

  return NextResponse.json({ path: `takeoff-pdfs/${storagePath}` });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.active || !canEstimate(session.user)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new NextResponse("Storage not configured", { status: 500 });
  }

  const { id } = await params;
  const drawing = await prisma.takeoffDrawing.findUnique({ where: { id } });
  if (!drawing?.pdfData) return new NextResponse("No PDF", { status: 404 });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // pdfData is stored as "takeoff-pdfs/<id>.pdf" — extract just the file path within the bucket
  const bucketPath = drawing.pdfData.startsWith("takeoff-pdfs/")
    ? drawing.pdfData.slice("takeoff-pdfs/".length)
    : drawing.pdfData;

  const { data, error } = await supabase.storage
    .from("takeoff-pdfs")
    .download(bucketPath);

  if (error || !data) {
    console.error("Supabase download error:", error);
    return new NextResponse("PDF not found in storage", { status: 404 });
  }

  const bytes = await data.arrayBuffer();
  return new NextResponse(bytes, {
    headers: { "Content-Type": "application/pdf" },
  });
}
