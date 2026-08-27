import { describe, it, expect } from "vitest";
import {
  isAppointmentReminderEligible,
  buildAppointmentReminderEventKey,
  type AppointmentReminderCandidate,
} from "@/lib/appointments/reminders";

const NOW = new Date("2026-06-15T09:00:00Z");
const CAIRO = "Africa/Cairo";

function candidate(overrides: Partial<AppointmentReminderCandidate> = {}): AppointmentReminderCandidate {
  return {
    id: "appt-1",
    clinicId: "clinic-1",
    patientId: "patient-1",
    doctorId: "doctor-1",
    status: "scheduled",
    scheduledStart: new Date("2026-06-16T10:00:00Z"), // tomorrow, Cairo
    deletedAt: null,
    ...overrides,
  };
}

describe("isAppointmentReminderEligible", () => {
  it("is eligible for a scheduled appointment tomorrow in the clinic's timezone", () => {
    expect(isAppointmentReminderEligible(candidate(), NOW, CAIRO)).toBe(true);
  });

  it("is eligible for a confirmed appointment too", () => {
    expect(isAppointmentReminderEligible(candidate({ status: "confirmed" }), NOW, CAIRO)).toBe(true);
  });

  it("excludes a cancelled appointment", () => {
    expect(isAppointmentReminderEligible(candidate({ status: "cancelled" }), NOW, CAIRO)).toBe(false);
  });

  it("excludes a completed appointment", () => {
    expect(isAppointmentReminderEligible(candidate({ status: "completed" }), NOW, CAIRO)).toBe(false);
  });

  it("excludes a no-show appointment", () => {
    expect(isAppointmentReminderEligible(candidate({ status: "no_show" }), NOW, CAIRO)).toBe(false);
  });

  it("excludes a soft-deleted appointment", () => {
    expect(isAppointmentReminderEligible(candidate({ deletedAt: "2026-06-14T00:00:00Z" }), NOW, CAIRO)).toBe(false);
  });

  it("excludes an appointment that is already in the past", () => {
    expect(isAppointmentReminderEligible(candidate({ scheduledStart: new Date("2026-06-15T08:00:00Z") }), NOW, CAIRO)).toBe(false);
  });

  it("excludes an appointment happening today (not yet tomorrow)", () => {
    expect(isAppointmentReminderEligible(candidate({ scheduledStart: new Date("2026-06-15T15:00:00Z") }), NOW, CAIRO)).toBe(false);
  });

  it("excludes an appointment two days out (window boundary — only exactly tomorrow qualifies)", () => {
    expect(isAppointmentReminderEligible(candidate({ scheduledStart: new Date("2026-06-17T10:00:00Z") }), NOW, CAIRO)).toBe(false);
  });

  it("uses the clinic's own timezone, not the server's — the same instant is eligible for one clinic and not another", () => {
    // now = noon UTC (June 15 everywhere reasonable). This instant is
    // June 16 in Riyadh (UTC+3) but still June 15 in New York (UTC-4).
    const now = new Date("2026-06-15T12:00:00Z");
    const appointment = candidate({ scheduledStart: new Date("2026-06-16T02:00:00Z") });
    expect(isAppointmentReminderEligible(appointment, now, "Asia/Riyadh")).toBe(true);
    expect(isAppointmentReminderEligible(appointment, now, "America/New_York")).toBe(false);
  });

  it("handles a midnight/date-rollover boundary correctly using the clinic's timezone", () => {
    // now is 23:00 UTC on Jan 1 — already Jan 2 in Riyadh (UTC+3). An
    // appointment at Jan 3 00:00 Riyadh time is "tomorrow" from the
    // clinic's point of view.
    const now = new Date("2026-01-01T23:00:00Z");
    const appointment = candidate({ scheduledStart: new Date("2026-01-02T21:00:00Z") });
    expect(isAppointmentReminderEligible(appointment, now, "Asia/Riyadh")).toBe(true);
  });
});

describe("buildAppointmentReminderEventKey", () => {
  it("builds a stable, unique key per appointment and window", () => {
    expect(buildAppointmentReminderEventKey("appt-1", "next_day")).toBe("appointment_reminder:appt-1:next_day");
  });

  it("produces different keys for different appointments", () => {
    expect(buildAppointmentReminderEventKey("appt-1", "next_day")).not.toBe(
      buildAppointmentReminderEventKey("appt-2", "next_day"),
    );
  });
});
