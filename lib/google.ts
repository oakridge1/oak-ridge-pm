import { prisma } from "@/lib/prisma";
import { APP_URL } from "@/lib/app-url";

export const SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
];

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
];

// NOTE: Adding Drive scope requires users to reconnect their Google account
// to grant the new permission via the OAuth consent screen.
export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

export const ALL_GOOGLE_SCOPES = [
  "email",
  "profile",
  ...SHEETS_SCOPES,
  ...CALENDAR_SCOPES,
  ...DRIVE_SCOPES,
];

export async function getGoogleConnection() {
  return prisma.googleConnection.findFirst();
}

export async function getValidAccessToken(): Promise<string | null> {
  const conn = await getGoogleConnection();
  if (!conn) return null;

  const now = new Date();
  const bufferMs = 60 * 1000; // refresh 1 minute before expiry

  if (conn.accessToken && conn.tokenExpiry && conn.tokenExpiry.getTime() - bufferMs > now.getTime()) {
    return conn.accessToken;
  }

  // Refresh the access token
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    console.error("[google] token refresh failed:", await res.text());
    return null;
  }

  const data = await res.json() as {
    access_token: string;
    expires_in: number;
  };

  const expiry = new Date(Date.now() + data.expires_in * 1000);

  await prisma.googleConnection.update({
    where: { id: conn.id },
    data: {
      accessToken: data.access_token,
      tokenExpiry: expiry,
    },
  });

  return data.access_token;
}

export async function googleFetch(
  url: string,
  init: RequestInit = {},
  accessToken: string,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export function getGoogleOAuthUrl(baseUrl: string): string {
  const clientId = process.env.AUTH_GOOGLE_ID;
  if (!clientId) throw new Error("AUTH_GOOGLE_ID is not set");

  const redirectUri = `${baseUrl}/api/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: ALL_GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Map app recurrence strings to Google Calendar RRULE format
function toRRule(recurrence: string | null | undefined): string[] {
  const map: Record<string, string> = {
    DAILY: "RRULE:FREQ=DAILY",
    WEEKLY: "RRULE:FREQ=WEEKLY",
    BIWEEKLY: "RRULE:FREQ=WEEKLY;INTERVAL=2",
    MONTHLY: "RRULE:FREQ=MONTHLY",
    YEARLY: "RRULE:FREQ=YEARLY",
  };
  const rule = recurrence && recurrence !== "NONE" ? map[recurrence] : null;
  return rule ? [rule] : [];
}

export async function syncCalendarEventToGoogle(params: {
  eventId: string;
  title: string;
  date: Date;
  endDate?: Date | null;
  allDay?: boolean;
  note?: string | null;
  recurrence?: string | null;
  recurrenceEndDate?: Date | null;
  job: { id: string; jobNumber: string; jobName: string } | null;
  googleEventId?: string | null;
}): Promise<string | null> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return null;

  const { title, date, endDate, allDay = true, note, recurrence, recurrenceEndDate, job, googleEventId } = params;

  const summary = job ? `${job.jobNumber} — ${title}` : title;
  const jobLink = job ? `${APP_URL}/jobs/${job.id}` : "";
  const description = [
    job ? `Job: ${job.jobName} (${job.jobNumber})` : null,
    note || null,
    jobLink || null,
  ].filter(Boolean).join("\n");

  const rrules = toRRule(recurrence);
  if (recurrenceEndDate && rrules.length > 0) {
    const until = recurrenceEndDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    rrules[0] = rrules[0] + `;UNTIL=${until}`;
  }

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const toDateTimeStr = (d: Date) => d.toISOString();

  let startObj: Record<string, string>;
  let endObj: Record<string, string>;

  if (allDay) {
    startObj = { date: toDateStr(date) };
    const endD = endDate ?? new Date(date.getTime() + 86400000);
    endObj = { date: toDateStr(endD) };
  } else {
    startObj = { dateTime: toDateTimeStr(date), timeZone: "America/New_York" };
    const endD = endDate ?? new Date(date.getTime() + 3600000);
    endObj = { dateTime: toDateTimeStr(endD), timeZone: "America/New_York" };
  }

  const body = JSON.stringify({
    summary,
    description,
    start: startObj,
    end: endObj,
    ...(rrules.length > 0 ? { recurrence: rrules } : {}),
  });

  if (googleEventId) {
    const res = await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
      { method: "PUT", body },
      accessToken,
    );
    if (!res.ok) {
      console.error("[calendar-sync] update failed:", await res.text());
      return googleEventId;
    }
    return googleEventId;
  } else {
    const res = await googleFetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      { method: "POST", body },
      accessToken,
    );
    if (!res.ok) {
      console.error("[calendar-sync] create failed:", await res.text());
      return null;
    }
    const data = await res.json() as { id: string };
    return data.id;
  }
}

export async function deleteCalendarEventFromGoogle(googleEventId: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return;

  const res = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    { method: "DELETE" },
    accessToken,
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error("[calendar-sync] delete failed:", await res.text());
  }
}
