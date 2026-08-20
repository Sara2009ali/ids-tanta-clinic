/**
 * Pure display-formatting helpers for the Doctor Schedule view — kept
 * separate from validation.ts (booking-rule logic) since this is a
 * different concern: turning `WorkingHours`/minute values into strings for
 * the schedule screen, not deciding whether a booking is allowed. No i18n
 * dictionary import here, same convention as dental-chart/calculations.ts —
 * callers pass the current locale (for Intl formatting) and any surrounding
 * copy themselves.
 */

import type { WorkingHours } from "@/lib/appointments/validation";

/** "570" -> "9:30 AM" (or locale-appropriate equivalent). Minute overflow rolls into hours automatically via the Date constructor, so no manual div/mod is needed. */
export function formatMinutesAsTime(minutes: number, locale?: string): string {
  const date = new Date(2000, 0, 1, 0, minutes);
  return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

/** One "9:00 AM–1:00 PM" range string per window, in the given order — the caller decides how to join them and what to show for an empty list (day off vs. never configured are different messages, and this module has no opinion on either). */
export function formatAvailabilityWindows(windows: readonly WorkingHours[], locale?: string): string[] {
  return windows.map(
    (window) => `${formatMinutesAsTime(window.startMinutes, locale)}–${formatMinutesAsTime(window.endMinutes, locale)}`,
  );
}
