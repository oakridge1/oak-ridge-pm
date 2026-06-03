/**
 * Date utilities that avoid the UTC-midnight off-by-one bug.
 *
 * Dates stored as date-only in Postgres come back from Prisma as
 * "YYYY-MM-DDT00:00:00.000Z" (midnight UTC). Calling new Date() on
 * that string and then reading it with local-time methods (getDate,
 * toLocaleDateString, etc.) shifts the date back by one day for
 * anyone west of UTC (e.g. Eastern = UTC-4/5).
 *
 * Fix: force noon local time so no timezone offset can roll the
 * date back to the previous calendar day.
 */

export function parseLocalDate(d: Date | string | null | undefined): Date {
  if (!d) return new Date();
  const str = typeof d === "string" ? d : d.toISOString();
  // Append local noon — keeps the date correct in any UTC-X timezone
  return new Date(str.slice(0, 10) + "T12:00:00");
}

export function formatLocalDate(
  d: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!d) return "—";
  return parseLocalDate(d).toLocaleDateString(
    "en-US",
    options ?? { month: "short", day: "numeric", year: "numeric" }
  );
}

/**
 * Returns a "YYYY-MM-DD" string suitable for <input type="date">.
 * Uses the UTC date from the ISO string, which matches what was
 * stored — safe because inputs send back the same YYYY-MM-DD string.
 */
export function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const str = typeof d === "string" ? d : d.toISOString();
  return str.slice(0, 10);
}

/**
 * Formats a "HH:MM" 24-hour string as 12-hour time (e.g. "08:30" → "8:30 AM").
 */
export function formatHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Formats an ISO timestamp string as 12-hour time (e.g. "2026-06-03T14:30:00Z" → "2:30 PM").
 */
export function formatTime12(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
