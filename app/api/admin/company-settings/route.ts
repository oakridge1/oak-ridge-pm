export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { name, address, city, state, zip, phone, email, logoUrl, defaultPaymentTerms } = body;

  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: { name, address, city, state, zip, phone, email, logoUrl, defaultPaymentTerms },
    create: { id: "singleton", name, address, city, state, zip, phone, email, logoUrl, defaultPaymentTerms },
  });
  return NextResponse.json(settings);
}
