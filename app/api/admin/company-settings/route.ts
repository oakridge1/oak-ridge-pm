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
  const {
    name, address, city, state, zip, phone, email, logoUrl, defaultPaymentTerms,
    accountantEmail, overheadAllocMethod, taxYearStartMonth, fiscalYearType,
  } = body;

  const data = {
    name, address, city, state, zip, phone, email, logoUrl, defaultPaymentTerms,
    ...(accountantEmail !== undefined ? { accountantEmail } : {}),
    ...(overheadAllocMethod !== undefined ? { overheadAllocMethod } : {}),
    ...(taxYearStartMonth !== undefined ? { taxYearStartMonth: Number(taxYearStartMonth) } : {}),
    ...(fiscalYearType !== undefined ? { fiscalYearType } : {}),
  };

  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.active) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  const body = await req.json();

  const mondayReminder  = body.mondayReminder  ?? undefined;
  const fridayReminder  = body.fridayReminder  ?? undefined;
  const reminderMessage = body.reminderMessage ?? undefined;

  const data = {
    ...(mondayReminder  !== undefined && { mondayReminder }),
    ...(fridayReminder  !== undefined && { fridayReminder }),
    ...(reminderMessage !== undefined && { reminderMessage }),
  };

  const settings = await prisma.companySettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });
  return NextResponse.json(settings);
}
