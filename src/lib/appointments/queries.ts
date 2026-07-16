import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, Chair, DoctorScheduleException, DoctorVacation, DoctorWeeklyHours, VisitType } from "@/types/domain";
import type { DoctorScheduleInput } from "@/lib/appointments/validation";

/** Active (non-inactive) visit types for the current clinic, for the booking dialog's dropdown. */
export async function listVisitTypes(): Promise<VisitType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_types")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return data ?? [];
}

/** Active chairs for the current clinic, for the booking dialog's dropdown. */
export async function listChairs(): Promise<Chair[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chairs")
    .select("*")
    .eq("is_active", true)
    .order("label");

  return data ?? [];
}

function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfTomorrowIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  return start.toISOString();
}

export interface DashboardCounts {
  todayTotal: number;
  waiting: number;
  inTreatment: number;
  completedToday: number;
  cancelledToday: number;
  noShowToday: number;
  newPatientsToday: number;
}

/** Reception Dashboard stat cards — one round trip per card, run in parallel. */
export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = await createClient();
  const todayStart = startOfTodayIso();
  const todayEnd = startOfTomorrowIso();

  const todayRange = (query: ReturnType<typeof supabase.from>) =>
    query.gte("scheduled_start", todayStart).lt("scheduled_start", todayEnd);

  const countFor = async (status?: AppointmentStatus | AppointmentStatus[]) => {
    let query = supabase.from("appointments").select("*", { count: "exact", head: true });
    query = todayRange(query) as typeof query;
    if (status) {
      query = Array.isArray(status) ? query.in("status", status) : query.eq("status", status);
    }
    const { count } = await query;
    return count ?? 0;
  };

  const [todayTotal, waiting, inTreatment, completedToday, cancelledToday, noShowToday, newPatientsToday] =
    await Promise.all([
      countFor(),
      countFor("waiting"),
      countFor("in_treatment"),
      countFor("completed"),
      countFor("cancelled"),
      countFor("no_show"),
      supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd)
        .then((res) => res.count ?? 0),
    ]);

  return { todayTotal, waiting, inTreatment, completedToday, cancelledToday, noShowToday, newPatientsToday };
}

export interface ScheduleRow {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatus;
  priority: string;
  is_emergency: boolean;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  chair_label: string | null;
  visit_type_name: string;
  visit_type_color: string;
}

interface ScheduleQueryRow {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: AppointmentStatus;
  priority: string;
  is_emergency: boolean;
  patient_id: string;
  doctor_id: string;
  patients: { full_name: string } | null;
  staff_profiles: { full_name: string } | null;
  chairs: { label: string } | null;
  visit_types: { name: string; color: string } | null;
}

/** Schedule for [startIso, endIsoExclusive), oldest-first, with patient/doctor/chair/visit-type names already joined in. */
export async function getScheduleForRange(
  startIso: string,
  endIsoExclusive: string,
): Promise<ScheduleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select(
      `id, scheduled_start, scheduled_end, status, priority, is_emergency, patient_id, doctor_id,
       patients ( full_name ),
       staff_profiles!appointments_doctor_id_fkey ( full_name ),
       chairs ( label ),
       visit_types ( name, color )`,
    )
    .gte("scheduled_start", startIso)
    .lt("scheduled_start", endIsoExclusive)
    .is("deleted_at", null)
    .order("scheduled_start", { ascending: true });

  if (error) {
    console.error("getScheduleForRange failed", error);
    return [];
  }

  return ((data ?? []) as unknown as ScheduleQueryRow[]).map((row) => ({
    id: row.id,
    scheduled_start: row.scheduled_start,
    scheduled_end: row.scheduled_end,
    status: row.status,
    priority: row.priority,
    is_emergency: row.is_emergency,
    patient_id: row.patient_id,
    patient_name: row.patients?.full_name ?? "—",
    doctor_id: row.doctor_id,
    doctor_name: row.staff_profiles?.full_name ?? "—",
    chair_label: row.chairs?.label ?? null,
    visit_type_name: row.visit_types?.name ?? "—",
    visit_type_color: row.visit_types?.color ?? "#6366f1",
  }));
}

/** Today's full schedule — a thin wrapper around `getScheduleForRange` for the Reception Dashboard. */
export async function getTodaysSchedule(): Promise<ScheduleRow[]> {
  return getScheduleForRange(startOfTodayIso(), startOfTomorrowIso());
}

export interface RecentActivityRow {
  id: string;
  appointment_id: string;
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus;
  created_at: string;
  patient_name: string;
}

/** Most recent appointment status changes across the clinic, for the dashboard's "Recent Activity" feed. */
export async function getRecentActivity(limit = 8): Promise<RecentActivityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointment_status_history")
    .select("id, appointment_id, from_status, to_status, created_at, appointments ( patients ( full_name ) )")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentActivity failed", error);
    return [];
  }

  return (
    data as unknown as {
      id: string;
      appointment_id: string;
      from_status: AppointmentStatus | null;
      to_status: AppointmentStatus;
      created_at: string;
      appointments: { patients: { full_name: string } | null } | null;
    }[]
  ).map((row) => ({
    id: row.id,
    appointment_id: row.appointment_id,
    from_status: row.from_status,
    to_status: row.to_status,
    created_at: row.created_at,
    patient_name: row.appointments?.patients?.full_name ?? "—",
  }));
}

export interface BookingWindow {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
}

const OVERLAP_CHECK_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "checked_in",
  "waiting",
  "in_treatment",
  "completed",
];

/** Same-day bookings for a doctor, for the pre-insert conflict check in createAppointment/updateAppointment. */
export async function getDoctorBookingsForDay(doctorId: string, dayIso: string): Promise<BookingWindow[]> {
  const supabase = await createClient();
  const dayStart = new Date(dayIso);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data } = await supabase
    .from("appointments")
    .select("id, scheduled_start, scheduled_end")
    .eq("doctor_id", doctorId)
    .in("status", OVERLAP_CHECK_STATUSES)
    .is("deleted_at", null)
    .gte("scheduled_start", dayStart.toISOString())
    .lt("scheduled_start", dayEnd.toISOString());

  return data ?? [];
}

/** Same-day bookings for a chair, for the pre-insert conflict check. */
export async function getChairBookingsForDay(chairId: string, dayIso: string): Promise<BookingWindow[]> {
  const supabase = await createClient();
  const dayStart = new Date(dayIso);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data } = await supabase
    .from("appointments")
    .select("id, scheduled_start, scheduled_end")
    .eq("chair_id", chairId)
    .in("status", OVERLAP_CHECK_STATUSES)
    .is("deleted_at", null)
    .gte("scheduled_start", dayStart.toISOString())
    .lt("scheduled_start", dayEnd.toISOString());

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Doctor Schedule Management (Phase 3B, Milestone 2).
// ---------------------------------------------------------------------------

/** A doctor's recurring weekly-hours blocks, ordered for display (day, then time). */
export async function listDoctorWeeklyHours(doctorId: string): Promise<DoctorWeeklyHours[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_weekly_hours")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("day_of_week")
    .order("start_minutes");

  if (error) {
    console.error("listDoctorWeeklyHours failed", error);
    return [];
  }
  return data ?? [];
}

/** A doctor's vacation date ranges, most recent first. */
export async function listDoctorVacations(doctorId: string): Promise<DoctorVacation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_vacations")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("start_date", { ascending: false });

  if (error) {
    console.error("listDoctorVacations failed", error);
    return [];
  }
  return data ?? [];
}

/** A doctor's single-date hour overrides, most recent first. */
export async function listDoctorScheduleExceptions(doctorId: string): Promise<DoctorScheduleException[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_schedule_exceptions")
    .select("*")
    .eq("doctor_id", doctorId)
    .order("exception_date", { ascending: false });

  if (error) {
    console.error("listDoctorScheduleExceptions failed", error);
    return [];
  }
  return data ?? [];
}

/**
 * Fetches and maps a doctor's full schedule configuration into the pure
 * `DoctorScheduleInput` shape `computeAvailabilityWindows` (validation.ts)
 * expects — the one round trip the booking Server Actions need before
 * running the availability check.
 */
export async function getDoctorScheduleInput(doctorId: string): Promise<DoctorScheduleInput> {
  const [weeklyHours, vacations, exceptions] = await Promise.all([
    listDoctorWeeklyHours(doctorId),
    listDoctorVacations(doctorId),
    listDoctorScheduleExceptions(doctorId),
  ]);

  return {
    weeklyHours: weeklyHours.map((row) => ({
      dayOfWeek: row.day_of_week,
      startMinutes: row.start_minutes,
      endMinutes: row.end_minutes,
    })),
    vacations: vacations.map((row) => ({ startDate: row.start_date, endDate: row.end_date })),
    exceptions: exceptions.map((row) => ({
      date: row.exception_date,
      startMinutes: row.start_minutes,
      endMinutes: row.end_minutes,
    })),
  };
}
