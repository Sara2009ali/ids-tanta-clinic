// Plain date-math utility, no "server-only" — pure functions, safe to call
// from Server Components (defaults) and shared with client filter
// components (formatting) alike.

export interface ReportDateRange {
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Inclusive, YYYY-MM-DD. */
  end: string;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** This calendar month to date — the same default window Compensation's and Billing's own dashboards already use ("this month"). */
export function defaultReportRange(): ReportDateRange {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start: toDateString(start), end: toDateString(now) };
}

/** Inclusive start / exclusive end as ISO timestamps — the same endIsoExclusive shape getScheduleForRange() already uses, so every date-range query in this module reads the same way. */
export function rangeToTimestampBounds(range: ReportDateRange): { startIso: string; endIsoExclusive: string } {
  const endExclusive = new Date(`${range.end}T00:00:00.000Z`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return {
    startIso: `${range.start}T00:00:00.000Z`,
    endIsoExclusive: endExclusive.toISOString(),
  };
}
