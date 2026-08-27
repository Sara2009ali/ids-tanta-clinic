/**
 * Timezone-aware date math for scheduler jobs — pure, no I/O. Appointments
 * are stored as `timestamptz` (an absolute instant), so comparing two
 * instants (e.g. "is this within the next N hours") never needs a
 * timezone at all. What DOES need one is any "which *calendar day*" —
 * "today"/"tomorrow" only mean something relative to a specific place, and
 * a clinic in Cairo and a server running in UTC can disagree about what
 * day it is for several hours around midnight. This is exactly the bug
 * class the batch 8 brief calls out: never compare local appointment dates
 * against UTC dates without conversion.
 *
 * Uses the built-in Intl API (no new dependency) — `en-CA` is a convenient
 * locale whose default date format is already YYYY-MM-DD.
 */

const LOCAL_DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function localDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = LOCAL_DATE_FORMATTER_CACHE.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    LOCAL_DATE_FORMATTER_CACHE.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * The YYYY-MM-DD calendar date `instant` falls on on in `timeZone` — e.g.
 * 2026-01-01T23:30:00Z is still "2025-12-31" in Africa/Cairo (UTC+2) but
 * already "2026-01-01" in a UTC+3 zone. An invalid IANA timezone name
 * throws (from Intl itself) rather than silently falling back to UTC —
 * callers should treat that as a configuration error, not a valid "no
 * timezone" case.
 */
export function localDateString(instant: Date, timeZone: string): string {
  return localDateFormatter(timeZone).format(instant);
}

/** Adds `days` to a YYYY-MM-DD date string, returned in the same format — pure string/date arithmetic, no timezone involved (both sides are already "a calendar date", not an instant). */
export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** True if `instant`'s calendar date in `timeZone` is exactly "tomorrow" relative to `now`'s calendar date in that same timezone — the reminder window this batch implements (see appointments/reminders.ts). */
export function isTomorrowInTimezone(instant: Date, now: Date, timeZone: string): boolean {
  const today = localDateString(now, timeZone);
  const tomorrow = addDaysToDateString(today, 1);
  return localDateString(instant, timeZone) === tomorrow;
}
