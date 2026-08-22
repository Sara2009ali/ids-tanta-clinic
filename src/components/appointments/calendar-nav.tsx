import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCalendarHref } from "@/components/appointments/calendar-query-params";
import { navigateView, toDateParam, type CalendarView } from "@/lib/appointments/calendar-dates";

/** Prev/Today/Next controls. Pure links — no client state needed, so this stays a Server Component. */
export function CalendarNav({
  view,
  anchor,
  previousLabel = "Previous",
  todayLabel = "Today",
  nextLabel = "Next",
}: {
  view: CalendarView;
  anchor: Date;
  /** All three default to English — pass the translated labels from the (localized) caller page. */
  previousLabel?: string;
  todayLabel?: string;
  nextLabel?: string;
}) {
  const prevHref = buildCalendarHref({}, { view, date: toDateParam(navigateView(view, anchor, -1)) });
  const nextHref = buildCalendarHref({}, { view, date: toDateParam(navigateView(view, anchor, 1)) });
  const todayHref = buildCalendarHref({}, { view });

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" render={<Link href={prevHref} aria-label={previousLabel} />}>
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </Button>
      <Button variant="outline" size="sm" render={<Link href={todayHref} />}>
        {todayLabel}
      </Button>
      <Button variant="outline" size="icon" render={<Link href={nextHref} aria-label={nextLabel} />}>
        <ChevronRight className="size-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
