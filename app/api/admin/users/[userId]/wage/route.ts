export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

type RouteContext = { params: Promise<{ userId: string }> };

// GET /api/admin/users/[userId]/wage
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return new NextResponse("Forbidden", { status: 403 });

  const { userId } = await params;
  const wage = await prisma.employeeWage.findUnique({ where: { userId } });
  return NextResponse.json(wage ?? null);
}

// PUT /api/admin/users/[userId]/wage
export async function PUT(req: Request, { params }: RouteContext) {
  const session = await requireAdmin();
  if (!session) return new NextResponse("Forbidden", { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const { title, year, hourlyWage, burdenRate, paySchedule, isFieldCrew, notes } = body;

  // Validate
  if (typeof hourlyWage !== "number" || hourlyWage < 0) {
    return NextResponse.json({ error: "Invalid hourly wage" }, { status: 400 });
  }
  if (typeof burdenRate !== "number" || burdenRate < 0) {
    return NextResponse.json({ error: "Invalid burden rate" }, { status: 400 });
  }

  // Load current wage to store history entry if wage changed
  const existing = await prisma.employeeWage.findUnique({ where: { userId } });
  const history = (existing?.wageHistory as { date: string; wage: number; title: string }[]) ?? [];

  if (existing && existing.hourlyWage !== hourlyWage) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      wage: existing.hourlyWage,
      title: existing.title,
    });
    // Keep last 20 entries
    if (history.length > 20) history.splice(0, history.length - 20);
  }

  const wage = await prisma.employeeWage.upsert({
    where: { userId },
    update: {
      title: String(title ?? ""),
      year: String(year ?? ""),
      hourlyWage: Number(hourlyWage),
      burdenRate: Number(burdenRate),
      paySchedule: String(paySchedule ?? "biweekly"),
      isFieldCrew: Boolean(isFieldCrew),
      notes: notes ? String(notes) : null,
      wageHistory: history,
      updatedBy: session.user.id ?? null,
    },
    create: {
      userId,
      title: String(title ?? ""),
      year: String(year ?? ""),
      hourlyWage: Number(hourlyWage),
      burdenRate: Number(burdenRate),
      paySchedule: String(paySchedule ?? "biweekly"),
      isFieldCrew: Boolean(isFieldCrew),
      notes: notes ? String(notes) : null,
      wageHistory: [],
      updatedBy: session.user.id ?? null,
    },
  });

  return NextResponse.json(wage);
}
