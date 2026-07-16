import { describe, it, expect } from "vitest";
import {
  calculateEndTime,
  isInPast,
  isWithinWorkingHours,
  hasOverlap,
  validateAppointment,
} from "@/lib/appointments/validation";
import type { ExistingBooking } from "@/lib/appointments/validation";

describe("calculateEndTime", () => {
  it("adds the duration in minutes to the start time", () => {
    const start = "2026-07-05T10:00:00";
    const expected = new Date(new Date(start).getTime() + 30 * 60_000).toISOString();
    expect(calculateEndTime(start, 30)).toBe(expected);
  });

  it("returns an ISO string", () => {
    expect(calculateEndTime("2026-07-05T10:00:00", 15)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

describe("isInPast", () => {
  const now = new Date("2026-07-05T12:00:00");

  it("returns true for a date before now", () => {
    expect(isInPast("2026-07-05T10:00:00", now)).toBe(true);
  });

  it("returns false for a date after now", () => {
    expect(isInPast("2026-07-05T14:00:00", now)).toBe(false);
  });

  it("returns false for a date exactly equal to now", () => {
    expect(isInPast("2026-07-05T12:00:00", now)).toBe(false);
  });
});

describe("isWithinWorkingHours", () => {
  it("passes for a slot fully inside 9:00-21:00", () => {
    expect(isWithinWorkingHours("2026-07-05T10:00:00", "2026-07-05T10:30:00")).toBe(true);
  });

  it("fails for a slot starting before 9:00", () => {
    expect(isWithinWorkingHours("2026-07-05T08:30:00", "2026-07-05T09:15:00")).toBe(false);
  });

  it("fails for a slot ending after 21:00", () => {
    expect(isWithinWorkingHours("2026-07-05T20:45:00", "2026-07-05T21:15:00")).toBe(false);
  });

  it("respects a custom working-hours override", () => {
    const earlyHours = { startMinutes: 7 * 60, endMinutes: 12 * 60 };
    expect(isWithinWorkingHours("2026-07-05T08:00:00", "2026-07-05T08:30:00", earlyHours)).toBe(true);
    expect(isWithinWorkingHours("2026-07-05T08:00:00", "2026-07-05T08:30:00")).toBe(false);
  });
});

describe("hasOverlap", () => {
  const existing: ExistingBooking[] = [
    { id: "a", scheduledStart: "2026-07-05T10:00:00", scheduledEnd: "2026-07-05T10:30:00" },
  ];

  it("returns true when ranges overlap", () => {
    expect(hasOverlap("2026-07-05T10:15:00", "2026-07-05T10:45:00", existing)).toBe(true);
  });

  it("returns false for back-to-back non-overlapping ranges (one ends exactly when the other starts)", () => {
    expect(hasOverlap("2026-07-05T10:30:00", "2026-07-05T11:00:00", existing)).toBe(false);
    expect(hasOverlap("2026-07-05T09:30:00", "2026-07-05T10:00:00", existing)).toBe(false);
  });

  it("excludes a booking matching excludeId", () => {
    expect(hasOverlap("2026-07-05T10:00:00", "2026-07-05T10:30:00", existing, "a")).toBe(false);
  });

  it("still detects overlap with other bookings when excludeId doesn't match", () => {
    expect(hasOverlap("2026-07-05T10:00:00", "2026-07-05T10:30:00", existing, "other-id")).toBe(true);
  });
});

describe("validateAppointment", () => {
  const now = new Date("2026-07-05T08:00:00");

  it("returns valid: true with no errors for a fully valid input", () => {
    const result = validateAppointment({
      scheduledStart: "2026-07-06T10:00:00",
      durationMinutes: 30,
      doctorBookings: [],
      chairBookings: [],
      now,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.scheduledEnd).toBe(calculateEndTime("2026-07-06T10:00:00", 30));
  });

  it("flags a past appointment", () => {
    const result = validateAppointment({
      scheduledStart: "2026-07-05T07:00:00",
      durationMinutes: 30,
      doctorBookings: [],
      chairBookings: [],
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Appointments can't be scheduled in the past.");
  });

  it("flags a doctor double-booking", () => {
    const doctorBookings: ExistingBooking[] = [
      { id: "appt-1", scheduledStart: "2026-07-06T10:00:00", scheduledEnd: "2026-07-06T10:30:00" },
    ];
    const result = validateAppointment({
      scheduledStart: "2026-07-06T10:15:00",
      durationMinutes: 30,
      doctorBookings,
      chairBookings: [],
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((message) => message.toLowerCase().includes("doctor"))).toBe(true);
  });

  it("flags a chair double-booking", () => {
    const chairBookings: ExistingBooking[] = [
      { id: "appt-2", scheduledStart: "2026-07-06T10:00:00", scheduledEnd: "2026-07-06T10:30:00" },
    ];
    const result = validateAppointment({
      scheduledStart: "2026-07-06T10:15:00",
      durationMinutes: 30,
      doctorBookings: [],
      chairBookings,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((message) => message.toLowerCase().includes("chair"))).toBe(true);
  });

  it("accumulates multiple simultaneous errors (past AND doctor conflict)", () => {
    const doctorBookings: ExistingBooking[] = [
      { id: "appt-3", scheduledStart: "2026-07-05T07:00:00", scheduledEnd: "2026-07-05T07:30:00" },
    ];
    const result = validateAppointment({
      scheduledStart: "2026-07-05T07:00:00",
      durationMinutes: 30,
      doctorBookings,
      chairBookings: [],
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Appointments can't be scheduled in the past.");
    expect(result.errors.some((message) => message.toLowerCase().includes("doctor"))).toBe(true);
    expect(result.errors.length).toBe(2);
  });

  it("excludes the appointment's own booking via excludeAppointmentId when editing", () => {
    const doctorBookings: ExistingBooking[] = [
      { id: "appt-self", scheduledStart: "2026-07-06T10:00:00", scheduledEnd: "2026-07-06T10:30:00" },
    ];
    const result = validateAppointment({
      scheduledStart: "2026-07-06T10:00:00",
      durationMinutes: 30,
      doctorBookings,
      chairBookings: [],
      excludeAppointmentId: "appt-self",
      now,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("computes scheduledEnd via calculateEndTime regardless of validity", () => {
    const scheduledStart = "2026-07-05T07:00:00"; // in the past relative to `now`, and an invalid duration
    const result = validateAppointment({
      scheduledStart,
      durationMinutes: -5,
      doctorBookings: [],
      chairBookings: [],
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.scheduledEnd).toBe(calculateEndTime(scheduledStart, -5));
  });
});
