// Plain utility, deliberately kept out of any "use client" file — it's
// called from Server Components (appointments/page.tsx) and would be
// called from Client Components too if the calendar grows client-side
// interactivity later. Mirrors patients-query-params.ts exactly.
import type { CalendarView } from "@/lib/appointments/calendar-dates";

export interface CalendarQueryParams {
  view?: CalendarView;
  date?: string;
}

export function buildCalendarHref(base: CalendarQueryParams, updates: CalendarQueryParams) {
  const merged: CalendarQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.view) params.set("view", merged.view);
  if (merged.date) params.set("date", merged.date);
  const qs = params.toString();
  return qs ? `/appointments?${qs}` : "/appointments";
}
