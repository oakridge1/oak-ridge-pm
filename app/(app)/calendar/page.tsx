import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Calendar } from "lucide-react";
import { MasterCalendar } from "./master-calendar";

export default async function CalendarPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");

  const [events, jobs] = await Promise.all([
    prisma.calendarEvent.findMany({
      orderBy: { date: "asc" },
      include: {
        user: { select: { name: true } },
        job: {
          select: {
            jobName: true,
            jobNumber: true,
            calendarColor: true,
          },
        },
      },
    }),
    prisma.job.findMany({
      where: { status: { in: ["ACTIVE", "ON_HOLD"] } },
      select: {
        id: true,
        jobName: true,
        jobNumber: true,
        calendarColor: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-[#002D72] flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#002D72]">Master Calendar</h1>
        </div>
        <p className="text-sm text-gray-500">
          All events across all active jobs — milestones, completions, and days
          off.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <MasterCalendar
          events={events}
          jobs={jobs}
          role={session.user.role}
        />
      </div>
    </div>
  );
}
