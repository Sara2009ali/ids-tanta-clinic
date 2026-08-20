import { CalendarOff, Plane } from "lucide-react";
import { TodaysSchedule } from "@/components/appointments/todays-schedule";
import { formatAvailabilityWindows } from "@/lib/appointments/schedule-format";
import type { DoctorAvailabilityForDate } from "@/lib/appointments/validation";
import type { ScheduleRow } from "@/lib/appointments/queries";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * The doctor-day planning surface: a working-hours line (the "who's
 * available" half of the module) above that doctor's appointments for the
 * day (the "what's already occupying that time" half, reusing
 * TodaysSchedule exactly as-is — same list Reception/the day-view already
 * use, so an appointment looks identical wherever it's seen).
 */
export function DoctorScheduleDayView({
  rows,
  availability,
  locale,
  dict,
}: {
  rows: ScheduleRow[];
  availability: DoctorAvailabilityForDate;
  locale?: string;
  dict: Dictionary["doctorSchedule"];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 text-sm">
        {availability.kind === "vacation" ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Plane className="size-4" />
            {dict.onVacation}
          </span>
        ) : availability.kind === "off" ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <CalendarOff className="size-4" />
            {dict.offToday}
          </span>
        ) : (
          <>
            <span className="font-medium text-foreground">{dict.workingHoursLabel}:</span>
            <span className="text-muted-foreground">{formatAvailabilityWindows(availability.windows, locale).join(", ")}</span>
            {availability.kind === "unconfigured" && (
              <span className="text-xs text-muted-foreground/70">({dict.defaultHoursNotice})</span>
            )}
          </>
        )}
      </div>

      <TodaysSchedule rows={rows} emptyMessage={dict.noAppointmentsDay} />
    </div>
  );
}
