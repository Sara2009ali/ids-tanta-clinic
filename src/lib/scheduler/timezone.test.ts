import { describe, it, expect } from "vitest";
import { localDateString, addDaysToDateString, isTomorrowInTimezone } from "@/lib/scheduler/timezone";

describe("localDateString", () => {
  it("returns the calendar date in the given timezone for a mid-day instant", () => {
    expect(localDateString(new Date("2026-06-15T12:00:00Z"), "Africa/Cairo")).toBe("2026-06-15");
  });

  it("disagrees with UTC near midnight — the exact bug class this module exists to prevent", () => {
    // 23:30 UTC on Dec 31 is already Jan 1 in a UTC+3 zone.
    const instant = new Date("2025-12-31T23:30:00Z");
    expect(localDateString(instant, "UTC")).toBe("2025-12-31");
    expect(localDateString(instant, "Asia/Riyadh")).toBe("2026-01-01"); // UTC+3
  });

  it("rolls the other direction for a negative-offset timezone", () => {
    // 01:30 UTC is still the previous calendar day in UTC-5.
    const instant = new Date("2026-03-10T01:30:00Z");
    expect(localDateString(instant, "UTC")).toBe("2026-03-10");
    expect(localDateString(instant, "America/New_York")).toBe("2026-03-09");
  });
});

describe("addDaysToDateString", () => {
  it("adds a day within the same month", () => {
    expect(addDaysToDateString("2026-06-15", 1)).toBe("2026-06-16");
  });

  it("rolls over a month boundary", () => {
    expect(addDaysToDateString("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("rolls over a year boundary", () => {
    expect(addDaysToDateString("2025-12-31", 1)).toBe("2026-01-01");
  });
});

describe("isTomorrowInTimezone", () => {
  it("is true for an appointment exactly one clinic-local calendar day ahead", () => {
    const now = new Date("2026-06-15T09:00:00Z");
    const appointment = new Date("2026-06-16T10:00:00Z");
    expect(isTomorrowInTimezone(appointment, now, "Africa/Cairo")).toBe(true);
  });

  it("is false for an appointment happening today", () => {
    const now = new Date("2026-06-15T09:00:00Z");
    const appointment = new Date("2026-06-15T15:00:00Z");
    expect(isTomorrowInTimezone(appointment, now, "Africa/Cairo")).toBe(false);
  });

  it("is false for an appointment two days out", () => {
    const now = new Date("2026-06-15T09:00:00Z");
    const appointment = new Date("2026-06-17T10:00:00Z");
    expect(isTomorrowInTimezone(appointment, now, "Africa/Cairo")).toBe(false);
  });

  it("correctly handles a near-midnight now that would give the wrong answer if compared in UTC instead of the clinic's timezone", () => {
    // It's 23:00 UTC on Jan 1 — already Jan 2 in Asia/Riyadh (UTC+3). An
    // appointment on Jan 3 local time is "tomorrow" from that clinic's
    // point of view, even though naively adding a day to the UTC date
    // (Jan 1 -> Jan 2) would wrongly expect the appointment on Jan 2 UTC
    // instead.
    const now = new Date("2026-01-01T23:00:00Z"); // Jan 2, 02:00 in Riyadh
    const appointmentTomorrowLocal = new Date("2026-01-02T21:00:00Z"); // Jan 3, 00:00 Riyadh
    expect(isTomorrowInTimezone(appointmentTomorrowLocal, now, "Asia/Riyadh")).toBe(true);

    const appointmentTodayUtcButNotTomorrowLocal = new Date("2026-01-02T10:00:00Z"); // Jan 2, 13:00 Riyadh — still "today" locally
    expect(isTomorrowInTimezone(appointmentTodayUtcButNotTomorrowLocal, now, "Asia/Riyadh")).toBe(false);
  });

  it("gives a different (correct) answer per clinic timezone for the same pair of instants", () => {
    // now = noon UTC: unambiguously June 15 in both zones ("today" agrees
    // everywhere reasonable). The appointment is chosen to land on June 16
    // (tomorrow) once shifted into Riyadh (UTC+3) but still June 15
    // (today) once shifted into New York (UTC-4 in June, EDT).
    const now = new Date("2026-06-15T12:00:00Z");
    const appointment = new Date("2026-06-16T02:00:00Z"); // 05:00 Jun 16 in Riyadh; 22:00 Jun 15 in New York
    expect(isTomorrowInTimezone(appointment, now, "Asia/Riyadh")).toBe(true);
    expect(isTomorrowInTimezone(appointment, now, "America/New_York")).toBe(false);
  });
});
