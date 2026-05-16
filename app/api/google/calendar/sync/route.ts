export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, googleFetch } from "@/lib/google";

const GOOGLE_CALENDAR_ID = "primary";

function toRRule(recurrence: string | null | undefined): string | null {
  switch (recurrence) {
    case "DAILY": return "RRULE:FREQ=DAILY";
    case "WEEKLY": return "RRULE:FREQ=WEEKLY";
    case "BIWEEKLY": return "RRULE:FREQ=WEEKLY;INTERVAL=2";
    case "MONTHLY": return "RRULE:FREQ=MONTHLY";
    case "YEARLY": return "RRULE:FREQ=YEARLY";
    default: return null;
  }
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildEventBody(event: {
  title: string;
  date: Date;
  endDate: Date | null;
  note: string | null;
  recurrence: string | null;
  job: { jobName: string } | null;
}) {
  const description = [
    event.note ?? "",
    event.job ? `Job: ${event.job.jobName}` : "",
  ].filter(Boolean).join("\n");

  const startDate = toDateString(event.date);
  // Google Calendar end date for all-day events is exclusive, so add one day
  const endDateObj = event.endDate
    ? new Date(event.endDate.getTime() + 86400000)
    : new Date(event.date.getTime() + 86400000);
  const endDate = toDateString(endDateObj);

  const body: Record<string, unknown> = {
    summary: event.title,
    description,
    start: { date: startDate },
    end: { date: endDate },
  };

  const rrule = toRRule(event.recurrence);
  if (rrule) body.recurrence = [rrule];

  return body;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.active || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: "Google not connected" }, { status: 400 });
  }

  const events = await prisma.calendarEvent.findMany({
    include: { job: { select: { jobName: true } } },
  });

  let synced = 0;
  let updated = 0;
  let failed = 0;

  for (const event of events) {
    const body = buildEventBody({
      title: event.title,
      date: event.date,
      endDate: event.endDate,
      note: event.note,
      recurrence: event.recurrence,
      job: event.job,
    });

    try {
      if (!event.googleEventId) {
        // Create
        const res = await googleFetch(
          `https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events`,
          { method: "POST", body: JSON.stringify(body) },
          accessToken,
        );

        if (!res.ok) {
          console.error(`[calendar/sync] create failed for event ${event.id}:`, await res.text());
          failed++;
          continue;
        }

        const created = await res.json() as { id: string };
        await prisma.calendarEvent.update({
          where: { id: event.id },
          data: { googleEventId: created.id },
        });
        synced++;
      } else {
        // Update
        const res = await googleFetch(
          `https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events/${event.googleEventId}`,
          { method: "PUT", body: JSON.stringify(body) },
          accessToken,
        );

        if (!res.ok) {
          const errText = await res.text();
          // If event was deleted from Google, create it fresh
          if (res.status === 404) {
            const createRes = await googleFetch(
              `https://www.googleapis.com/calendar/v3/calendars/${GOOGLE_CALENDAR_ID}/events`,
              { method: "POST", body: JSON.stringify(body) },
              accessToken,
            );

            if (!createRes.ok) {
              console.error(`[calendar/sync] recreate failed for event ${event.id}:`, await createRes.text());
              failed++;
              continue;
            }

            const created = await createRes.json() as { id: string };
            await prisma.calendarEvent.update({
              where: { id: event.id },
              data: { googleEventId: created.id },
            });
            synced++;
          } else {
            console.error(`[calendar/sync] update failed for event ${event.id}:`, errText);
            failed++;
          }
          continue;
        }

        updated++;
      }
    } catch (err) {
      console.error(`[calendar/sync] unexpected error for event ${event.id}:`, err);
      failed++;
    }
  }

  return NextResponse.json({ synced, updated, failed });
}
