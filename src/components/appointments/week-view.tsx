import { cn } from "@/lib/utils";
import { addDays, dateKey, groupByDateKey } from "@/lib/appointments/calendar-dates";
import type { ScheduleRow } from "@/lib/appointments/queries";

const DAY_HEADER_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" });

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** `start` must be the Sunday returned by `getViewRange("week", anchor).start`. */
export function WeekView({ rows, start }: { rows: ScheduleRow[]; start: Date }) {
  const grouped = groupByDateKey(rows);
  const today = dateKey(new Date().toISOString());
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 gap-2">
        {days.map((day) => {
          const key = dateKey(day.toISOString());
          const dayRows = (grouped.get(key) ?? []).slice().sort((a, b) =>
            a.scheduled_start.localeCompare(b.scheduled_start),
          );
          const isToday = key === today;

          return (
            <div key={key} className="flex min-h-64 flex-col gap-2 rounded-xl border border-border p-2">
              <p className={cn("text-xs font-medium", isToday ? "text-primary" : "text-muted-foreground")}>
                {DAY_HEADER_FORMATTER.format(day)}
              </p>
              <div className="flex flex-1 flex-col gap-1.5">
                {dayRows.length === 0 && <p className="text-xs text-muted-foreground/60">—</p>}
                {dayRows.map((row) => (
                  <div key={row.id} className="rounded-lg bg-card p-1.5 text-xs ring-1 ring-foreground/10">
                    <div className="flex items-center gap-1">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: row.visit_type_color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium">{row.patient_name}</span>
                    </div>
                    <p className="truncate text-muted-foreground">{formatTime(row.scheduled_start)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
