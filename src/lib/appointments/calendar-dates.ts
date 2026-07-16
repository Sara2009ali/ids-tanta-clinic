/**
 * Pure calendar date-range math for Phase 3B's day/week/month views. No
 * I/O here on purpose — mirrors the validation.ts convention of pure,
 * independently-testable logic shared between server and client, and
 * usable directly from Server Components without a "use client" boundary.
 */

export type CalendarView = "day" | "week" | "month";

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** Sunday on or before `date`. */
function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  return addDays(start, -start.getDay());
}

function startOfMonth(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(1);
  return start;
}

/** Sunday on/before the 1st of `date`'s month — the first cell of a 6-row month grid. */
function startOfMonthGrid(date: Date): Date {
  return startOfWeek(startOfMonth(date));
}

export interface DateRange {
  start: Date;
  /** Exclusive. */
  end: Date;
}

/**
 * The [start, end) range to fetch and render for a given view. "month"
 * returns the full 6-week (42-day) grid range rather than just the
 * calendar month, so the padding days from adjacent months shown in the
 * grid have real appointment data instead of being silently blank.
 */
export function getViewRange(view: CalendarView, anchor: Date): DateRange {
  switch (view) {
    case "day": {
      const start = startOfDay(anchor);
      return { start, end: addDays(start, 1) };
    }
    case "week": {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 7) };
    }
    case "month": {
      const start = startOfMonthGrid(anchor);
      return { start, end: addDays(start, 42) };
    }
  }
}

/** Moves `anchor` to the next/previous day, week, or month depending on `view`. */
export function navigateView(view: CalendarView, anchor: Date, direction: 1 | -1): Date {
  switch (view) {
    case "day":
      return addDays(anchor, direction);
    case "week":
      return addDays(anchor, direction * 7);
    case "month":
      return addMonths(anchor, direction);
  }
}

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a `YYYY-MM-DD` URL query param, falling back to today for anything missing or malformed. */
export function parseDateParam(value: string | undefined): Date {
  if (value && DATE_PARAM_PATTERN.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return startOfDay(new Date());
}

/** Formats a Date as the `YYYY-MM-DD` URL query param `parseDateParam` reads back. */
export function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Local calendar-day key (YYYY-MM-DD) for grouping rows by day. */
export function dateKey(iso: string): string {
  return toDateParam(new Date(iso));
}

/** Groups rows by local calendar day, preserving each day's original order. */
export function groupByDateKey<T extends { scheduled_start: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = dateKey(row.scheduled_start);
    const group = map.get(key);
    if (group) group.push(row);
    else map.set(key, [row]);
  }
  return map;
}

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const WEEK_PART_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

/** Human-readable header label for the current view/anchor, e.g. "Jul 19 – Jul 25, 2026". */
export function formatViewLabel(view: CalendarView, anchor: Date): string {
  switch (view) {
    case "day":
      return DAY_FORMATTER.format(anchor);
    case "week": {
      const start = startOfWeek(anchor);
      const end = addDays(start, 6);
      return `${WEEK_PART_FORMATTER.format(start)} – ${WEEK_PART_FORMATTER.format(end)}, ${end.getFullYear()}`;
    }
    case "month":
      return MONTH_FORMATTER.format(startOfMonth(anchor));
  }
}
