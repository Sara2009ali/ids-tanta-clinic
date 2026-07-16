import { describe, it, expect } from "vitest";
import {
  addDays,
  addMonths,
  dateKey,
  formatViewLabel,
  getViewRange,
  groupByDateKey,
  navigateView,
  parseDateParam,
  toDateParam,
} from "@/lib/appointments/calendar-dates";

describe("addDays / addMonths", () => {
  it("adds days without mutating the input", () => {
    const start = new Date("2026-07-15T00:00:00");
    const result = addDays(start, 3);
    expect(result.toISOString()).toBe(new Date("2026-07-18T00:00:00").toISOString());
    expect(start.toISOString()).toBe(new Date("2026-07-15T00:00:00").toISOString());
  });

  it("crosses a month boundary", () => {
    expect(addDays(new Date("2026-07-30T00:00:00"), 3).getDate()).toBe(2);
  });

  it("adds months, clamped by JS Date's own end-of-month rollover", () => {
    expect(addMonths(new Date("2026-07-15T00:00:00"), 1).getMonth()).toBe(7); // August
  });
});

describe("getViewRange", () => {
  it("day: returns [midnight, midnight+1day)", () => {
    const { start, end } = getViewRange("day", new Date("2026-07-15T14:30:00"));
    expect(start.toISOString()).toBe(new Date("2026-07-15T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-16T00:00:00").toISOString());
  });

  it("week: starts on the Sunday on/before the anchor and spans 7 days", () => {
    // 2026-07-15 is a Wednesday.
    const { start, end } = getViewRange("week", new Date("2026-07-15T00:00:00"));
    expect(start.getDay()).toBe(0);
    expect(start.toISOString()).toBe(new Date("2026-07-12T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-07-19T00:00:00").toISOString());
  });

  it("week: an anchor that's already a Sunday stays put", () => {
    const { start } = getViewRange("week", new Date("2026-07-12T00:00:00"));
    expect(start.toISOString()).toBe(new Date("2026-07-12T00:00:00").toISOString());
  });

  it("month: spans a full 42-day (6-week) grid starting on a Sunday", () => {
    const { start, end } = getViewRange("month", new Date("2026-07-15T00:00:00"));
    expect(start.getDay()).toBe(0);
    // July 2026's 1st is a Wednesday, so the grid starts 2026-06-28.
    expect(start.toISOString()).toBe(new Date("2026-06-28T00:00:00").toISOString());
    expect(end.toISOString()).toBe(new Date("2026-08-09T00:00:00").toISOString());
  });
});

describe("navigateView", () => {
  it("day: moves by 1 day", () => {
    const anchor = new Date("2026-07-15T00:00:00");
    expect(navigateView("day", anchor, 1).toISOString()).toBe(
      new Date("2026-07-16T00:00:00").toISOString(),
    );
    expect(navigateView("day", anchor, -1).toISOString()).toBe(
      new Date("2026-07-14T00:00:00").toISOString(),
    );
  });

  it("week: moves by 7 days", () => {
    const anchor = new Date("2026-07-15T00:00:00");
    expect(navigateView("week", anchor, 1).toISOString()).toBe(
      new Date("2026-07-22T00:00:00").toISOString(),
    );
  });

  it("month: moves by 1 month, preserving the day of month where possible", () => {
    const anchor = new Date("2026-07-15T00:00:00");
    expect(navigateView("month", anchor, 1).getMonth()).toBe(7);
    expect(navigateView("month", anchor, -1).getMonth()).toBe(5);
  });
});

describe("parseDateParam / toDateParam", () => {
  it("round-trips a well-formed date param", () => {
    const date = parseDateParam("2026-07-15");
    expect(toDateParam(date)).toBe("2026-07-15");
  });

  it("falls back to today for a missing value", () => {
    const today = toDateParam(new Date());
    expect(toDateParam(parseDateParam(undefined))).toBe(today);
  });

  it("falls back to today for a malformed value", () => {
    const today = toDateParam(new Date());
    expect(toDateParam(parseDateParam("not-a-date"))).toBe(today);
    expect(toDateParam(parseDateParam("2026/07/15"))).toBe(today);
  });

  it("pads single-digit months and days", () => {
    expect(toDateParam(new Date("2026-01-05T00:00:00"))).toBe("2026-01-05");
  });
});

describe("dateKey / groupByDateKey", () => {
  it("keys by local calendar day regardless of time-of-day", () => {
    expect(dateKey("2026-07-15T08:00:00")).toBe("2026-07-15");
    expect(dateKey("2026-07-15T23:59:00")).toBe("2026-07-15");
  });

  it("groups rows by day and preserves each day's original order", () => {
    const rows = [
      { id: "a", scheduled_start: "2026-07-15T09:00:00" },
      { id: "b", scheduled_start: "2026-07-16T10:00:00" },
      { id: "c", scheduled_start: "2026-07-15T14:00:00" },
    ];
    const grouped = groupByDateKey(rows);
    expect(Array.from(grouped.keys())).toEqual(["2026-07-15", "2026-07-16"]);
    expect(grouped.get("2026-07-15")?.map((row) => row.id)).toEqual(["a", "c"]);
    expect(grouped.get("2026-07-16")?.map((row) => row.id)).toEqual(["b"]);
  });
});

describe("formatViewLabel", () => {
  it("day: full weekday/month/day/year", () => {
    expect(formatViewLabel("day", new Date("2026-07-15T00:00:00"))).toBe("Wednesday, July 15, 2026");
  });

  it("week: short month/day range with a single trailing year", () => {
    expect(formatViewLabel("week", new Date("2026-07-15T00:00:00"))).toBe("Jul 12 – Jul 18, 2026");
  });

  it("month: month name and year", () => {
    expect(formatViewLabel("month", new Date("2026-07-15T00:00:00"))).toBe("July 2026");
  });
});
