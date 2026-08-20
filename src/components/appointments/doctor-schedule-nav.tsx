import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildDoctorScheduleHref } from "@/components/appointments/doctor-schedule-query-params";
import { navigateView, toDateParam } from "@/lib/appointments/calendar-dates";
import type { CalendarView } from "@/lib/appointments/calendar-dates";
import type { Dictionary } from "@/lib/i18n/types";

/** Prev/Today/Next controls for the Doctor Schedule page — mirrors CalendarNav exactly, scoped to doctorId+day/week instead of /appointments' day/week/month. */
export function DoctorScheduleNav({
  doctorId,
  view,
  anchor,
  dict,
}: {
  doctorId: string | undefined;
  view: Extract<CalendarView, "day" | "week">;
  anchor: Date;
  dict: Dictionary["doctorSchedule"];
}) {
  const prevHref = buildDoctorScheduleHref({ doctorId, view }, { date: toDateParam(navigateView(view, anchor, -1)) });
  const nextHref = buildDoctorScheduleHref({ doctorId, view }, { date: toDateParam(navigateView(view, anchor, 1)) });
  const todayHref = buildDoctorScheduleHref({ doctorId, view }, { date: toDateParam(new Date()) });

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" render={<Link href={prevHref} aria-label={dict.previous} scroll={false} />}>
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </Button>
      <Button variant="outline" size="sm" render={<Link href={todayHref} scroll={false} />}>
        {dict.today}
      </Button>
      <Button variant="outline" size="icon" render={<Link href={nextHref} aria-label={dict.next} scroll={false} />}>
        <ChevronRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
