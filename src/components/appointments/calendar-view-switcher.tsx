import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildCalendarHref } from "@/components/appointments/calendar-query-params";
import { toDateParam, type CalendarView } from "@/lib/appointments/calendar-dates";

const VIEWS: CalendarView[] = ["day", "week", "month"];
const VIEW_LABELS: Record<CalendarView, string> = { day: "Day", week: "Week", month: "Month" };

/** Day/Week/Month switcher. Pure links — the current date carries over, only `view` changes. */
export function CalendarViewSwitcher({ view, anchor }: { view: CalendarView; anchor: Date }) {
  const date = toDateParam(anchor);

  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-muted p-[3px]">
      {VIEWS.map((candidate) => (
        <Button
          key={candidate}
          size="sm"
          variant={candidate === view ? "default" : "ghost"}
          render={<Link href={buildCalendarHref({}, { view: candidate, date })} />}
        >
          {VIEW_LABELS[candidate]}
        </Button>
      ))}
    </div>
  );
}
