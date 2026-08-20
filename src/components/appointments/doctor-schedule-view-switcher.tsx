import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildDoctorScheduleHref } from "@/components/appointments/doctor-schedule-query-params";
import { toDateParam } from "@/lib/appointments/calendar-dates";
import type { CalendarView } from "@/lib/appointments/calendar-dates";
import type { Dictionary } from "@/lib/i18n/types";

type DoctorScheduleView = Extract<CalendarView, "day" | "week">;
const VIEWS: DoctorScheduleView[] = ["day", "week"];

/** Day/Week switcher — mirrors CalendarViewSwitcher, no month (not needed for a doctor-focused planning view; the admin config page already covers the recurring-template picture). */
export function DoctorScheduleViewSwitcher({
  doctorId,
  view,
  anchor,
  dict,
}: {
  doctorId: string | undefined;
  view: DoctorScheduleView;
  anchor: Date;
  dict: Dictionary["doctorSchedule"];
}) {
  const date = toDateParam(anchor);
  const labels: Record<DoctorScheduleView, string> = { day: dict.viewDay, week: dict.viewWeek };

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-[3px]">
      {VIEWS.map((candidate) => (
        <Button
          key={candidate}
          size="sm"
          variant={candidate === view ? "default" : "ghost"}
          render={<Link href={buildDoctorScheduleHref({ doctorId }, { view: candidate, date })} scroll={false} />}
        >
          {labels[candidate]}
        </Button>
      ))}
    </div>
  );
}
