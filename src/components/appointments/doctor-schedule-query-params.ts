// Plain utility, deliberately kept out of any "use client" file — mirrors
// calendar-query-params.ts exactly, but scoped to /doctor-schedule and
// carrying doctorId as a third param. Not reusing buildCalendarHref
// directly since that one is hardcoded to the /appointments base path and
// has no doctorId concept.
import type { CalendarView } from "@/lib/appointments/calendar-dates";

export interface DoctorScheduleQueryParams {
  doctorId?: string;
  view?: Extract<CalendarView, "day" | "week">;
  date?: string;
}

export function buildDoctorScheduleHref(base: DoctorScheduleQueryParams, updates: DoctorScheduleQueryParams) {
  const merged: DoctorScheduleQueryParams = { ...base, ...updates };
  const params = new URLSearchParams();
  if (merged.doctorId) params.set("doctorId", merged.doctorId);
  if (merged.view) params.set("view", merged.view);
  if (merged.date) params.set("date", merged.date);
  const qs = params.toString();
  return qs ? `/doctor-schedule?${qs}` : "/doctor-schedule";
}
