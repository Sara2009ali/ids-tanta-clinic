import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { addDays, dateKey, groupByDateKey } from "@/lib/appointments/calendar-dates";
import type { ScheduleRow } from "@/lib/appointments/queries";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * `start` must be the Sunday returned by `getViewRange("week", anchor).start`.
 *
 * `locale`/`emptyDayLabel`/`dayAnnotations`/`dimmedDateKeys` are all
 * optional and additive — every existing call site (the plain /appointments
 * week view) keeps its exact previous behavior by omitting them. Doctor
 * Schedule's week view is the one that supplies them, to annotate each day
 * with that doctor's working hours without this component needing to know
 * anything about availability or i18n itself.
 */
export function WeekView({
  rows,
  start,
  locale = "en-US",
  emptyDayLabel = "No appointments",
  dayAnnotations,
  dimmedDateKeys,
}: {
  rows: ScheduleRow[];
  start: Date;
  locale?: string;
  emptyDayLabel?: string;
  /** Rendered under the day header, keyed by the same YYYY-MM-DD `dateKey()` used elsewhere in this module. */
  dayAnnotations?: Map<string, ReactNode>;
  /** Days that get a dimmed, non-working-day treatment instead of the plain border. */
  dimmedDateKeys?: Set<string>;
}) {
  const grouped = groupByDateKey(rows);
  const today = dateKey(new Date().toISOString());
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const dayHeaderFormatter = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" });

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[840px] grid-cols-7 gap-2">
        {days.map((day) => {
          const key = dateKey(day.toISOString());
          const dayRows = (grouped.get(key) ?? []).slice().sort((a, b) =>
            a.scheduled_start.localeCompare(b.scheduled_start),
          );
          const isToday = key === today;
          const isDimmed = dimmedDateKeys?.has(key) ?? false;

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-72 flex-col gap-2 rounded-xl border p-2",
                isToday ? "border-primary/25 bg-primary/[0.03]" : "border-border",
                isDimmed && !isToday && "bg-muted/30",
              )}
            >
              <div>
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium",
                    isToday ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {dayHeaderFormatter.format(day)}
                  {isToday && <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />}
                </p>
                {dayAnnotations?.get(key) && (
                  <p className="text-[11px] text-muted-foreground/70">{dayAnnotations.get(key)}</p>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {dayRows.length === 0 && (
                  <p className="m-auto text-xs text-muted-foreground/50">{emptyDayLabel}</p>
                )}
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
