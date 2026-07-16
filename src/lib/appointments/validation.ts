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

/**
 * Doctor Schedule Management (Phase 3B, Milestone 2) inputs — plain,
 * camelCase mirrors of the doctor_weekly_hours/doctor_vacations/
 * doctor_schedule_exceptions rows. The query layer maps DB rows into
 * these; this module stays free of any DB/Supabase import.
 */
export interface WeeklyHoursBlock {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
}

export interface VacationRange {
  /** YYYY-MM-DD, inclusive. */
  startDate: string;
  /** YYYY-MM-DD, inclusive. */
  endDate: string;
}

export interface ScheduleExceptionBlock {
  /** YYYY-MM-DD. */
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export interface DoctorScheduleInput {
  weeklyHours: readonly WeeklyHoursBlock[];
  vacations: readonly VacationRange[];
  exceptions: readonly ScheduleExceptionBlock[];
}

/**
 * Computes the availability windows for a doctor on a given date, applying
 * vacation > exception > weekly-template precedence:
 *   1. Any vacation covering the date -> fully unavailable ([]).
 *   2. Any exception rows for the exact date -> those hours only, the
 *      weekly template is ignored for that date.
 *   3. Otherwise -> the weekly template's blocks for that day of week
 *      (empty if the doctor has a template but no blocks on this weekday,
 *      e.g. a doctor who doesn't work Sundays).
 *
 * Returns `null` — not `[]` — when the doctor has zero rows across all
 * three inputs, so the caller can distinguish "never configured, fall back
 * to DEFAULT_CLINIC_HOURS" from "configured, and unavailable today."
 */
export function computeAvailabilityWindows(
  dateIso: string,
  schedule: DoctorScheduleInput,
): WorkingHours[] | null {
  const hasAnyConfiguration =
    schedule.weeklyHours.length > 0 || schedule.vacations.length > 0 || schedule.exceptions.length > 0;
  if (!hasAnyConfiguration) return null;

  const date = dateIso.slice(0, 10);

  const onVacation = schedule.vacations.some((v) => date >= v.startDate && date <= v.endDate);
  if (onVacation) return [];

  const exceptionsForDate = schedule.exceptions.filter((exception) => exception.date === date);
  if (exceptionsForDate.length > 0) {
    return exceptionsForDate.map((exception) => ({
      startMinutes: exception.startMinutes,
      endMinutes: exception.endMinutes,
    }));
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  return schedule.weeklyHours
    .filter((block) => block.dayOfWeek === dayOfWeek)
    .map((block) => ({ startMinutes: block.startMinutes, endMinutes: block.endMinutes }));
}

/** Same as `isWithinWorkingHours`, but against multiple candidate windows (e.g. a split shift with a break). */
export function isWithinAvailability(
  scheduledStartIso: string,
  scheduledEndIso: string,
  windows: readonly WorkingHours[],
): boolean {
  const start = new Date(scheduledStartIso);
  const end = new Date(scheduledEndIso);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  if (endMinutes <= startMinutes) return false;
  return windows.some((window) => startMinutes >= window.startMinutes && endMinutes <= window.endMinutes);
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
  /**
   * The doctor's actual availability windows for the scheduled date (see
   * `computeAvailabilityWindows`), taking precedence over `workingHours`
   * when provided. Falls back to `[workingHours ?? DEFAULT_CLINIC_HOURS]`
   * when omitted, so callers that predate Doctor Schedule Management keep
   * their exact previous behavior.
   */
  availabilityWindows?: WorkingHours[];
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
  const availabilityWindows = input.availabilityWindows ?? [input.workingHours ?? DEFAULT_CLINIC_HOURS];
  if (errors.length === 0 && !isWithinAvailability(input.scheduledStart, scheduledEnd, availabilityWindows)) {
    errors.push(
      availabilityWindows.length === 0
        ? "This doctor is not available on the selected date."
        : "Appointment must fall within the doctor's available hours.",
    );
  }
  if (hasOverlap(input.scheduledStart, scheduledEnd, input.doctorBookings, input.excludeAppointmentId)) {
    errors.push("This doctor already has an appointment at that time.");
  }
  if (hasOverlap(input.scheduledStart, scheduledEnd, input.chairBookings, input.excludeAppointmentId)) {
    errors.push("This chair is already booked at that time.");
  }

  return { valid: errors.length === 0, errors, scheduledEnd };
}
