/**
 * Pure appointment-reminder eligibility logic (Batch 8) — no I/O, kept
 * separate from the scheduler job's own Supabase calls so the actual
 * business rule is unit-testable against hand-built fixtures, the same
 * calculations.ts/actions.ts split every domain module in this codebase
 * already uses.
 *
 * Reminder policy: exactly one window for v1 — the day before the
 * appointment, in the clinic's own configured timezone (never the
 * server's). This is a single, clearly named policy rather than a
 * per-clinic configurable field: no product requirement or existing
 * schema asked for a configurable window yet, and a second reminder
 * window (e.g. "2 hours before") can be added later as a second entry in
 * APPOINTMENT_REMINDER_WINDOWS without changing this eligibility function
 * or the event-key shape.
 */

import { isTomorrowInTimezone } from "@/lib/scheduler/timezone";

export type AppointmentReminderWindow = "next_day";

export const APPOINTMENT_REMINDER_WINDOW: AppointmentReminderWindow = "next_day";

/** appointment_status values that must never receive a reminder — the appointment either won't happen (cancelled/no_show) or already did (completed). */
const INELIGIBLE_STATUSES = new Set(["cancelled", "completed", "no_show"]);

export interface AppointmentReminderCandidate {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  status: string;
  scheduledStart: Date;
  deletedAt: string | null;
}

/**
 * True only for an appointment that should receive a reminder right now:
 * not soft-deleted, not cancelled/completed/no-show, not already in the
 * past, and — the actual reminder condition — scheduled for "tomorrow" in
 * the clinic's own local calendar, never the server's. `clinicId`/
 * `patientId`/`doctorId` are required (not optional) on the candidate
 * itself, matching appointments.patient_id/doctor_id/clinic_id all being
 * NOT NULL columns — there is no code path where an eligible appointment
 * lacks enough information to identify who it's for.
 */
export function isAppointmentReminderEligible(
  appointment: AppointmentReminderCandidate,
  now: Date,
  clinicTimezone: string,
): boolean {
  if (appointment.deletedAt) return false;
  if (INELIGIBLE_STATUSES.has(appointment.status)) return false;
  if (appointment.scheduledStart.getTime() <= now.getTime()) return false;

  return isTomorrowInTimezone(appointment.scheduledStart, now, clinicTimezone);
}

/** The database-enforced idempotency key (notifications.event_key, 0040_notification_event_key.sql) — one reminder per appointment per window, ever, regardless of how many times the scheduler runs or retries. */
export function buildAppointmentReminderEventKey(appointmentId: string, window: AppointmentReminderWindow): string {
  return `appointment_reminder:${appointmentId}:${window}`;
}
