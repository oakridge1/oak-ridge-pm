export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") return null;
  return session;
}

// GET /api/admin/company-rates
export async function GET() {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "OFFICE") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const rates = await prisma.companyRates.findUnique({ where: { id: "singleton" } });
  if (!rates) {
    return NextResponse.json({ defaultBurden: 0.35, bidRates: {} });
  }
  return NextResponse.json(rates);
}

// PUT /api/admin/company-rates
export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (!session) return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();
  const { defaultBurden, bidRates } = body;

  if (typeof defaultBurden !== "number" || defaultBurden < 0 || defaultBurden > 2) {
    return NextResponse.json({ error: "Invalid burden rate (0–200%)" }, { status: 400 });
  }
  if (typeof bidRates !== "object" || bidRates === null) {
    return NextResponse.json({ error: "Invalid bid rates" }, { status: 400 });
  }

  const rates = await prisma.companyRates.upsert({
    where: { id: "singleton" },
    update: { defaultBurden, bidRates },
    create: { id: "singleton", defaultBurden, bidRates },
  });

  return NextResponse.json(rates);
}
