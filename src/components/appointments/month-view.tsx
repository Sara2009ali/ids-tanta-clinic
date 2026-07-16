import { cn } from "@/lib/utils";
import { addDays, dateKey, groupByDateKey } from "@/lib/appointments/calendar-dates";
import type { ScheduleRow } from "@/lib/appointments/queries";

const MAX_VISIBLE_PER_DAY = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** `start` must be the grid-start Sunday returned by `getViewRange("month", anchor).start`. */
export function MonthView({ rows, start, anchor }: { rows: ScheduleRow[]; start: Date; anchor: Date }) {
  const grouped = groupByDateKey(rows);
  const today = dateKey(new Date().toISOString());
  const currentMonth = anchor.getMonth();
  const days = Array.from({ length: 42 }, (_, index) => addDays(start, index));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => {
          const key = dateKey(day.toISOString());
          const dayRows = (grouped.get(key) ?? []).slice().sort((a, b) =>
            a.scheduled_start.localeCompare(b.scheduled_start),
          );
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = key === today;
          const visible = dayRows.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayRows.length - visible.length;

          return (
            <div
              key={key}
              className={cn("min-h-26 bg-card p-1.5", !isCurrentMonth && "bg-card/50 text-muted-foreground")}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-xs",
                  isToday && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {visible.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px]"
                    style={{ backgroundColor: `${row.visit_type_color}22` }}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.visit_type_color }}
                      aria-hidden
                    />
                    <span className="truncate">
                      {formatTime(row.scheduled_start)} {row.patient_name}
                    </span>
                  </div>
                ))}
                {overflow > 0 && <p className="px-1 text-[11px] text-muted-foreground">+{overflow} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
