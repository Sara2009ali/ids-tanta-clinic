import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildCalendarHref } from "@/components/appointments/calendar-query-params";
import { toDateParam, type CalendarView } from "@/lib/appointments/calendar-dates";

const VIEWS: CalendarView[] = ["day", "week", "month"];

/** Day/Week/Month switcher. Pure links — the current date carries over, only `view` changes. */
export function CalendarViewSwitcher({
  view,
  anchor,
  viewLabels,
}: {
  view: CalendarView;
  anchor: Date;
  /** Defaults to English — pass the translated labels from the (localized) caller page. */
  viewLabels?: Record<CalendarView, string>;
}) {
  const date = toDateParam(anchor);
  const labels = viewLabels ?? { day: "Day", week: "Week", month: "Month" };

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-[3px]">
      {VIEWS.map((candidate) => (
        <Button
          key={candidate}
          size="sm"
          variant={candidate === view ? "default" : "ghost"}
          render={<Link href={buildCalendarHref({}, { view: candidate, date })} />}
        >
          {labels[candidate]}
        </Button>
      ))}
    </div>
  );
}
