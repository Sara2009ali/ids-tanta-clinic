/**
 * Pure appointment business rules — Module 4 (Smart Validation). No
 * Supabase/IO here on purpose: this file is usable from both the server
 * action (final authority) and the client form (instant feedback before
 * submitting), and is trivially unit-testable in isolation.
 *
 * The database is still the ultimate backstop against double-booking (see
 * the `appointments_doctor_no_overlap`/`appointments_chair_no_overlap`
 * exclusion constraints in supabase/migrations/0008_appointments.sql) —
 * this module exists to give a fast, friendly error *before* ever reaching
 * that constraint, not to replace it.
 */

export interface WorkingHours {
  /** Minutes since midnight, e.g. 9:00 -> 540. */
  startMinutes: number;
  endMinutes: number;
}

/**
 * Clinic-wide default hours, used until Phase 3B's per-doctor Doctor
 * Schedule module replaces this with real working-hours/break/vacation
 * data. Intentionally simple for Phase 3A — see docs/Phase-3A.md.
 */
export const DEFAULT_CLINIC_HOURS: WorkingHours = { startMinutes: 9 * 60, endMinutes: 21 * 60 };

export function calculateEndTime(scheduledStartIso: string, durationMinutes: number): string {
  const start = new Date(scheduledStartIso);
  return new Date(start.getTime() + durationMinutes * 60_000).toISOString();
}

export function isInPast(scheduledStartIso: string, now: Date = new Date()): boolean {
  return new Date(scheduledStartIso).getTime() < now.getTime();
}

/**
 * Same-day working-hours check. Appointments are expected to be short
 * (minutes, not days), so this deliberately does not handle multi-day
 * ranges — durations long enough to cross midnight should be rejected by
 * the duration bound in `validateAppointment`, not silently accepted here.
 */
export function isWithinWorkingHours(
  scheduledStartIso: string,
  scheduledEndIso: string,
  hours: WorkingHours = DEFAULT_CLINIC_HOURS,
): boolean {
  const start = new Date(scheduledStartIso);
  const end = new Date(scheduledEndIso);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return startMinutes >= hours.startMinutes && endMinutes <= hours.endMinutes && endMinutes > startMinutes;
}

export interface ExistingBooking {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
}

/** True if [scheduledStartIso, scheduledEndIso) overlaps any booking in `existing` (excluding `excludeId`, for edits). */
export function hasOverlap(
  scheduledStartIso: string,
  scheduledEndIso: string,
  existing: readonly ExistingBooking[],
  excludeId?: string,
): boolean {
  const start = new Date(scheduledStartIso).getTime();
  const end = new Date(scheduledEndIso).getTime();
  return existing.some((booking) => {
    if (excludeId && booking.id === excludeId) return false;
    const bookingStart = new Date(booking.scheduledStart).getTime();
    const bookingEnd = new Date(booking.scheduledEnd).getTime();
    return start < bookingEnd && end > bookingStart;
  });
}

export interface AppointmentValidationInput {
  scheduledStart: string;
  durationMinutes: number;
  doctorBookings: readonly ExistingBooking[];
  chairBookings: readonly ExistingBooking[];
  excludeAppointmentId?: string;
  now?: Date;
  workingHours?: WorkingHours;
}

export interface AppointmentValidationResult {
  valid: boolean;
  errors: string[];
  scheduledEnd: string;
}

/**
 * Runs every Phase 3A validation rule and returns the *complete* list of
 * problems (not just the first one), so the UI can show everything wrong
 * at once instead of a frustrating one-at-a-time correction loop.
 */
export function validateAppointment(input: AppointmentValidationInput): AppointmentValidationResult {
  const errors: string[] = [];
  const scheduledEnd = calculateEndTime(input.scheduledStart, input.durationMinutes);

  if (!Number.isFinite(input.durationMinutes) || input.durationMinutes <= 0) {
    errors.push("Duration must be greater than zero.");
  }
  if (isInPast(input.scheduledStart, input.now)) {
    errors.push("Appointments can't be scheduled in the past.");
  }
  if (errors.length === 0 && !isWithinWorkingHours(input.scheduledStart, scheduledEnd, input.workingHours)) {
    errors.push("Appointment must fall within clinic working hours (9:00 AM–9:00 PM).");
  }
  if (hasOverlap(input.scheduledStart, scheduledEnd, input.doctorBookings, input.excludeAppointmentId)) {
    errors.push("This doctor already has an appointment at that time.");
  }
  if (hasOverlap(input.scheduledStart, scheduledEnd, input.chairBookings, input.excludeAppointmentId)) {
    errors.push("This chair is already booked at that time.");
  }

  return { valid: errors.length === 0, errors, scheduledEnd };
}
