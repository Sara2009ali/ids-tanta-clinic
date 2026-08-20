import { WeekView } from "@/components/appointments/week-view";
import { addDays, dateKey } from "@/lib/appointments/calendar-dates";
import { describeDoctorAvailability, type DoctorScheduleInput } from "@/lib/appointments/validation";
import { formatAvailabilityWindows } from "@/lib/appointments/schedule-format";
import type { ScheduleRow } from "@/lib/appointments/queries";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Thin wrapper around the shared WeekView: computes this doctor's
 * availability for each of the 7 days up front and hands WeekView the
 * per-day annotation/dim it needs, so the grid itself stays free of any
 * scheduling logic. Week granularity intentionally only shows *whether* a
 * day is a working day (and its hours) — the Day view is where the full
 * "available vs. occupied" picture lives.
 */
export function DoctorScheduleWeekView({
  rows,
  start,
  schedule,
  locale,
  dict,
}: {
  rows: ScheduleRow[];
  start: Date;
  schedule: DoctorScheduleInput;
  locale?: string;
  dict: Dictionary["doctorSchedule"];
}) {
  const dayAnnotations = new Map<string, string>();
  const dimmedDateKeys = new Set<string>();

  for (let index = 0; index < 7; index += 1) {
    const day = addDays(start, index);
    const key = dateKey(day.toISOString());
    const availability = describeDoctorAvailability(day.toISOString(), schedule);

    if (availability.kind === "vacation" || availability.kind === "off") {
      dayAnnotations.set(key, dict.offDay);
      dimmedDateKeys.add(key);
    } else {
      dayAnnotations.set(key, formatAvailabilityWindows(availability.windows, locale).join(", "));
    }
  }

  return (
    <WeekView
      rows={rows}
      start={start}
      locale={locale}
      emptyDayLabel={dict.noAppointmentsShort}
      dayAnnotations={dayAnnotations}
      dimmedDateKeys={dimmedDateKeys}
    />
  );
}
