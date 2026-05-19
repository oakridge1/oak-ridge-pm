export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// One-time seed: POST /api/admin/seed-wages
// Seeds EmployeeWage records for the known crew and CompanyRates with bid rates.
// Safe to call multiple times — uses upsert.

const BID_RATES: Record<string, number> = {
  "Apprentice:1st": 45,
  "Apprentice:2nd": 48,
  "Apprentice:3rd": 52,
  "Apprentice:4th": 56,
  "Journeyman:1st": 65,
  "Journeyman:2nd": 68,
  "Journeyman:3rd": 72,
  "Master Electrician:": 85,
  "Foreman:": 90,
  "General Foreman:": 95,
};

const CREW: {
  email: string;
  title: string;
  year: string;
  hourlyWage: number;
  isFieldCrew: boolean;
  notes?: string;
}[] = [
  { email: "tyler@oakridgeelectrical.com",   title: "Apprentice",        year: "1st", hourlyWage: 16, isFieldCrew: true },
  { email: "michael@oakridgeelectrical.com", title: "Apprentice",        year: "1st", hourlyWage: 17, isFieldCrew: true },
  { email: "caleb@oakridgeelectrical.com",   title: "Journeyman",        year: "1st", hourlyWage: 35, isFieldCrew: true },
  { email: "steven@oakridgeelectrical.com",  title: "Master Electrician", year: "",   hourlyWage: 41, isFieldCrew: true },
  { email: "sam@oakridgeelectrical.com",     title: "Office",            year: "",   hourlyWage: 0,  isFieldCrew: false, notes: "Overhead — not a field cost" },
  { email: "beth@oakridgeelectrical.com",    title: "Office",            year: "",   hourlyWage: 0,  isFieldCrew: false, notes: "Unpaid" },
  { email: "justin@oakridgeelectrical.com",  title: "Owner",             year: "",   hourlyWage: 0,  isFieldCrew: false, notes: "Owner — not included in field labor cost" },
];

export async function POST() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const results: { email: string; status: string }[] = [];

  for (const crew of CREW) {
    const user = await prisma.user.findUnique({
      where: { email: crew.email },
      select: { id: true },
    });

    if (!user) {
      // Try partial match by name pattern in email
      results.push({ email: crew.email, status: "user not found — skipped" });
      continue;
    }

    await prisma.employeeWage.upsert({
      where: { userId: user.id },
      update: {
        title: crew.title,
        year: crew.year,
        hourlyWage: crew.hourlyWage,
        isFieldCrew: crew.isFieldCrew,
        notes: crew.notes ?? null,
        updatedBy: session.user.id ?? null,
      },
      create: {
        userId: user.id,
        title: crew.title,
        year: crew.year,
        hourlyWage: crew.hourlyWage,
        burdenRate: 0.35,
        paySchedule: "biweekly",
        isFieldCrew: crew.isFieldCrew,
        notes: crew.notes ?? null,
        wageHistory: [],
        updatedBy: session.user.id ?? null,
      },
    });

    results.push({ email: crew.email, status: "upserted" });
  }

  // Seed CompanyRates singleton
  await prisma.companyRates.upsert({
    where: { id: "singleton" },
    update: { bidRates: BID_RATES },
    create: { id: "singleton", defaultBurden: 0.35, bidRates: BID_RATES },
  });

  return NextResponse.json({
    ok: true,
    companyRates: "seeded",
    crew: results,
  });
}
