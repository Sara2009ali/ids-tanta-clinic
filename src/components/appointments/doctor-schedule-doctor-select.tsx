import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildDoctorScheduleHref } from "@/components/appointments/doctor-schedule-query-params";
import type { DoctorOption } from "@/lib/patients/queries";
import type { CalendarView } from "@/lib/appointments/calendar-dates";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Pure links (same "no client state needed" reasoning as CalendarNav) —
 * switching doctor preserves the current view/date, only doctorId changes.
 * A row of buttons rather than a dropdown Select: this clinic's doctor list
 * is small enough (same assumption DoctorScheduleSelector already makes for
 * the admin config page) that every doctor being visible and one click away
 * beats an extra open-menu step.
 */
export function DoctorScheduleDoctorSelect({
  doctors,
  selectedDoctorId,
  view,
  date,
  dict,
}: {
  doctors: DoctorOption[];
  selectedDoctorId: string | undefined;
  view: Extract<CalendarView, "day" | "week">;
  date: string;
  dict: Dictionary["doctorSchedule"];
}) {
  if (doctors.length === 0) {
    return <p className="text-sm text-muted-foreground">{dict.noDoctors}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={dict.doctorSelectLabel}>
      {doctors.map((doctor) => (
        <Button
          key={doctor.id}
          size="sm"
          variant={doctor.id === selectedDoctorId ? "default" : "outline"}
          render={<Link href={buildDoctorScheduleHref({}, { doctorId: doctor.id, view, date })} scroll={false} />}
        >
          {doctor.full_name}
        </Button>
      ))}
    </div>
  );
}
