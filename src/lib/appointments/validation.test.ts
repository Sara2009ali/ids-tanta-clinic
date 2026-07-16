import { describe, it, expect } from "vitest";
import {
  calculateEndTime,
  computeAvailabilityWindows,
  isInPast,
  isWithinAvailability,
  isWithinWorkingHours,
  hasOverlap,
  validateAppointment,
} from "@/lib/appointments/validation";
import type {
  DoctorScheduleInput,
  ExistingBooking,
  ScheduleExceptionBlock,
  VacationRange,
  WeeklyHoursBlock,
} from "@/lib/appointments/validation";

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

  it("accepts a slot inside a doctor's configured availabilityWindows even outside DEFAULT_CLINIC_HOURS", () => {
    const result = validateAppointment({
      scheduledStart: "2026-07-06T22:00:00", // 10 PM, outside the 9-21 default
      durationMinutes: 30,
      doctorBookings: [],
      chairBookings: [],
      availabilityWindows: [{ startMinutes: 21 * 60, endMinutes: 23 * 60 }],
      now,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a slot outside every configured availabilityWindows, with a doctor-specific message", () => {
    const result = validateAppointment({
      scheduledStart: "2026-07-06T13:00:00", // inside the old default, but not this doctor's window
      durationMinutes: 30,
      doctorBookings: [],
      chairBookings: [],
      availabilityWindows: [{ startMinutes: 9 * 60, endMinutes: 12 * 60 }],
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Appointment must fall within the doctor's available hours.");
  });

  it("rejects any slot when availabilityWindows is empty (doctor fully unavailable that day), with a distinct message", () => {
    const result = validateAppointment({
      scheduledStart: "2026-07-06T10:00:00",
      durationMinutes: 30,
      doctorBookings: [],
      chairBookings: [],
      availabilityWindows: [],
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("This doctor is not available on the selected date.");
  });
});

describe("isWithinAvailability", () => {
  it("returns true when the slot fits inside any one of multiple windows (split shift)", () => {
    const windows = [
      { startMinutes: 9 * 60, endMinutes: 13 * 60 },
      { startMinutes: 14 * 60, endMinutes: 18 * 60 },
    ];
    expect(isWithinAvailability("2026-07-06T10:00:00", "2026-07-06T10:30:00", windows)).toBe(true);
    expect(isWithinAvailability("2026-07-06T15:00:00", "2026-07-06T15:30:00", windows)).toBe(true);
  });

  it("returns false for a slot that falls in the break between two windows", () => {
    const windows = [
      { startMinutes: 9 * 60, endMinutes: 13 * 60 },
      { startMinutes: 14 * 60, endMinutes: 18 * 60 },
    ];
    expect(isWithinAvailability("2026-07-06T13:15:00", "2026-07-06T13:45:00", windows)).toBe(false);
  });

  it("returns false for an empty windows list", () => {
    expect(isWithinAvailability("2026-07-06T10:00:00", "2026-07-06T10:30:00", [])).toBe(false);
  });
});

describe("computeAvailabilityWindows", () => {
  const weeklyHours: WeeklyHoursBlock[] = [
    { dayOfWeek: 1, startMinutes: 9 * 60, endMinutes: 13 * 60 }, // Monday morning
    { dayOfWeek: 1, startMinutes: 14 * 60, endMinutes: 18 * 60 }, // Monday afternoon (break 13-14)
  ];

  it("returns null when the doctor has no schedule configured at all", () => {
    const schedule: DoctorScheduleInput = { weeklyHours: [], vacations: [], exceptions: [] };
    expect(computeAvailabilityWindows("2026-07-06", schedule)).toBeNull();
  });

  it("returns the weekly template's blocks for a configured weekday (2026-07-06 is a Monday)", () => {
    const schedule: DoctorScheduleInput = { weeklyHours, vacations: [], exceptions: [] };
    expect(computeAvailabilityWindows("2026-07-06", schedule)).toEqual([
      { startMinutes: 9 * 60, endMinutes: 13 * 60 },
      { startMinutes: 14 * 60, endMinutes: 18 * 60 },
    ]);
  });

  it("returns [] for a weekday with no weekly-template blocks (configured doctor, day off)", () => {
    // 2026-07-07 is a Tuesday; the doctor only has Monday blocks configured.
    const schedule: DoctorScheduleInput = { weeklyHours, vacations: [], exceptions: [] };
    expect(computeAvailabilityWindows("2026-07-07", schedule)).toEqual([]);
  });

  it("returns [] for any date covered by a vacation, even one with weekly hours and exceptions", () => {
    const vacations: VacationRange[] = [{ startDate: "2026-07-05", endDate: "2026-07-10" }];
    const exceptions: ScheduleExceptionBlock[] = [
      { date: "2026-07-06", startMinutes: 10 * 60, endMinutes: 11 * 60 },
    ];
    const schedule: DoctorScheduleInput = { weeklyHours, vacations, exceptions };
    expect(computeAvailabilityWindows("2026-07-06", schedule)).toEqual([]);
  });

  it("vacation precedence is inclusive of both endpoints, and stops applying the day after", () => {
    const vacations: VacationRange[] = [{ startDate: "2026-07-05", endDate: "2026-07-10" }];
    const schedule: DoctorScheduleInput = { weeklyHours, vacations, exceptions: [] };
    expect(computeAvailabilityWindows("2026-07-05", schedule)).toEqual([]);
    expect(computeAvailabilityWindows("2026-07-10", schedule)).toEqual([]);
    // 2026-07-11 is a Saturday, outside the vacation and with no weekly-hours
    // block configured for Saturday, so it's [] too — just for a different
    // reason (no template for that weekday, not the vacation).
    expect(computeAvailabilityWindows("2026-07-11", schedule)).toEqual([]);
    // 2026-07-13 is the next Monday — back to the normal weekly template.
    expect(computeAvailabilityWindows("2026-07-13", schedule)).toEqual([
      { startMinutes: 9 * 60, endMinutes: 13 * 60 },
      { startMinutes: 14 * 60, endMinutes: 18 * 60 },
    ]);
  });

  it("an exception for the exact date overrides the weekly template entirely", () => {
    const exceptions: ScheduleExceptionBlock[] = [
      { date: "2026-07-06", startMinutes: 8 * 60, endMinutes: 10 * 60 },
    ];
    const schedule: DoctorScheduleInput = { weeklyHours, vacations: [], exceptions };
    expect(computeAvailabilityWindows("2026-07-06", schedule)).toEqual([
      { startMinutes: 8 * 60, endMinutes: 10 * 60 },
    ]);
  });

  it("an exception on an unrelated date does not affect the weekly template", () => {
    const exceptions: ScheduleExceptionBlock[] = [
      { date: "2026-07-08", startMinutes: 8 * 60, endMinutes: 10 * 60 },
    ];
    const schedule: DoctorScheduleInput = { weeklyHours, vacations: [], exceptions };
    expect(computeAvailabilityWindows("2026-07-06", schedule)).toEqual([
      { startMinutes: 9 * 60, endMinutes: 13 * 60 },
      { startMinutes: 14 * 60, endMinutes: 18 * 60 },
    ]);
  });

  it("accepts a full ISO datetime, not just a YYYY-MM-DD date", () => {
    const schedule: DoctorScheduleInput = { weeklyHours, vacations: [], exceptions: [] };
    expect(computeAvailabilityWindows("2026-07-06T15:30:00", schedule)).toEqual([
      { startMinutes: 9 * 60, endMinutes: 13 * 60 },
      { startMinutes: 14 * 60, endMinutes: 18 * 60 },
    ]);
  });
});
