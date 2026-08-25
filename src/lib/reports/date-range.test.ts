import { describe, it, expect } from "vitest";
import { rangeToTimestampBounds } from "@/lib/reports/date-range";

describe("rangeToTimestampBounds — Revenue's date-range boundaries", () => {
  it("starts exactly at midnight UTC on the range's start date (inclusive)", () => {
    const { startIso } = rangeToTimestampBounds({ start: "2026-03-01", end: "2026-03-31" });
    expect(startIso).toBe("2026-03-01T00:00:00.000Z");
  });

  it("ends exclusively at midnight UTC the day AFTER the range's end date, so a payment on the end date itself is included", () => {
    const { endIsoExclusive } = rangeToTimestampBounds({ start: "2026-03-01", end: "2026-03-31" });
    expect(endIsoExclusive).toBe("2026-04-01T00:00:00.000Z");
  });

  it("handles a single-day range (start === end) as one full day, not zero-width", () => {
    const { startIso, endIsoExclusive } = rangeToTimestampBounds({ start: "2026-03-15", end: "2026-03-15" });
    expect(startIso).toBe("2026-03-15T00:00:00.000Z");
    expect(endIsoExclusive).toBe("2026-03-16T00:00:00.000Z");
  });

  it("rolls the exclusive end over a month boundary correctly", () => {
    const { endIsoExclusive } = rangeToTimestampBounds({ start: "2026-01-01", end: "2026-01-31" });
    expect(endIsoExclusive).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rolls the exclusive end over a year boundary correctly", () => {
    const { endIsoExclusive } = rangeToTimestampBounds({ start: "2026-12-01", end: "2026-12-31" });
    expect(endIsoExclusive).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rolls the exclusive end over a leap-day correctly (2028 is a leap year)", () => {
    const { endIsoExclusive } = rangeToTimestampBounds({ start: "2028-02-01", end: "2028-02-29" });
    expect(endIsoExclusive).toBe("2028-03-01T00:00:00.000Z");
  });
});
