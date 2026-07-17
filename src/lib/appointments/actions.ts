"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  appointmentFormSchema,
  appointmentFormValuesFromFormData,
  type AppointmentFormValues,
} from "@/lib/appointments/schema";
import { computeAvailabilityWindows, validateAppointment } from "@/lib/appointments/validation";
import { getChairBookingsForDay, getDoctorBookingsForDay, getDoctorScheduleInput } from "@/lib/appointments/queries";
import type { AppointmentStatus } from "@/types/domain";

export interface AppointmentActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  appointmentId?: string;
}

const EXCLUSION_VIOLATION = "23P01";

function fieldErrorsFromZod(error: import("zod").ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function appointmentRowFromValues(values: AppointmentFormValues, clinicId: string, scheduledEnd: string) {
  return {
    clinic_id: clinicId,
    patient_id: values.patient_id,
    doctor_id: values.doctor_id,
    chair_id: values.chair_id ?? null,
    visit_type_id: values.visit_type_id,
    scheduled_start: values.scheduled_start,
    scheduled_end: scheduledEnd,
    priority: values.priority,
    is_emergency: values.is_emergency,
    chief_complaint: values.chief_complaint ?? null,
    notes: values.notes ?? null,
  };
}

/** Runs Module 4's business-rule checks against same-day bookings before ever touching the database. */
async function runConflictCheck(
  values: AppointmentFormValues,
  excludeAppointmentId?: string,
): Promise<{ valid: true; scheduledEnd: string } | { valid: false; error: string }> {
  const [doctorBookings, chairBookings, doctorSchedule] = await Promise.all([
    getDoctorBookingsForDay(values.doctor_id, values.scheduled_start),
    values.chair_id ? getChairBookingsForDay(values.chair_id, values.scheduled_start) : Promise.resolve([]),
    getDoctorScheduleInput(values.doctor_id),
  ]);

  // null = doctor has no schedule configured at all -> validateAppointment
  // falls back to its own DEFAULT_CLINIC_HOURS default, same as before
  // Doctor Schedule Management existed. A non-null (possibly empty) array
  // means the doctor's configured schedule is the authority instead.
  const availabilityWindows =
    computeAvailabilityWindows(values.scheduled_start, doctorSchedule) ?? undefined;

  const result = validateAppointment({
    scheduledStart: values.scheduled_start,
    durationMinutes: values.duration_minutes,
    doctorBookings: doctorBookings.map((b) => ({
      id: b.id,
      scheduledStart: b.scheduled_start,
      scheduledEnd: b.scheduled_end,
    })),
    chairBookings: chairBookings.map((b) => ({
      id: b.id,
      scheduledStart: b.scheduled_start,
      scheduledEnd: b.scheduled_end,
    })),
    excludeAppointmentId,
    availabilityWindows,
  });

  if (!result.valid) {
    return { valid: false, error: result.errors.join(" ") };
  }
  return { valid: true, scheduledEnd: result.scheduledEnd };
}

export async function createAppointment(formData: FormData): Promise<AppointmentActionState> {
  const authz = await ensurePermission(PERMISSIONS.APPOINTMENTS_CREATE);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = appointmentFormSchema.safeParse(appointmentFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const conflictCheck = await runConflictCheck(values);
  if (!conflictCheck.valid) {
    return { error: conflictCheck.error };
  }

  const supabase = await createClient();
  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      ...appointmentRowFromValues(values, staff.clinic_id, conflictCheck.scheduledEnd),
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !appointment) {
    if (error?.code === EXCLUSION_VIOLATION) {
      return { error: "This doctor or chair was just booked for that time by someone else. Please pick another slot." };
    }
    console.error("createAppointment: insert failed", error);
    return { error: "Couldn't save the appointment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "appointment.created",
    entityType: "appointment",
    entityId: appointment.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  return { success: true, appointmentId: appointment.id };
}

export async function updateAppointment(
  appointmentId: string,
  formData: FormData,
): Promise<AppointmentActionState> {
  const authz = await ensurePermission(PERMISSIONS.APPOINTMENTS_EDIT);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const parsed = appointmentFormSchema.safeParse(appointmentFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const conflictCheck = await runConflictCheck(values, appointmentId);
  if (!conflictCheck.valid) {
    return { error: conflictCheck.error };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      ...appointmentRowFromValues(values, staff.clinic_id, conflictCheck.scheduledEnd),
      updated_by: staff.id,
    })
    .eq("id", appointmentId);

  if (error) {
    if (error.code === EXCLUSION_VIOLATION) {
      return { error: "This doctor or chair was just booked for that time by someone else. Please pick another slot." };
    }
    console.error("updateAppointment: update failed", error);
    return { error: "Couldn't save the appointment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "appointment.updated",
    entityType: "appointment",
    entityId: appointmentId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  return { success: true, appointmentId };
}

/**
 * Shared implementation for the Reception Workspace's one-click status
 * actions (check in / complete / cancel). A plain status update — the
 * appointment_status_history row is written automatically by the existing
 * log_appointment_status_change() trigger (0008_appointments.sql), so
 * there's nothing extra to do here beyond the update itself and the usual
 * audit_log entry.
 */
async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  permission: Parameters<typeof ensurePermission>[0],
  auditAction: string,
): Promise<AppointmentActionState> {
  const authz = await ensurePermission(permission);
  if (!authz.ok) {
    return { error: authz.error };
  }
  const staff = authz.staff;
  if (!staff.clinic_id) {
    return { error: "Your account isn't assigned to a clinic yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status, updated_by: staff.id })
    .eq("id", appointmentId);

  if (error) {
    console.error(`${auditAction}: update failed`, error);
    return { error: "Couldn't update the appointment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: auditAction,
    entityType: "appointment",
    entityId: appointmentId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/appointments");
  return { success: true, appointmentId };
}

export async function checkInAppointment(appointmentId: string): Promise<AppointmentActionState> {
  return setAppointmentStatus(appointmentId, "checked_in", PERMISSIONS.APPOINTMENTS_EDIT, "appointment.checked_in");
}

export async function completeAppointment(appointmentId: string): Promise<AppointmentActionState> {
  return setAppointmentStatus(appointmentId, "completed", PERMISSIONS.APPOINTMENTS_EDIT, "appointment.completed");
}

/**
 * Gated by appointments.cancel rather than appointments.edit like the
 * other status actions. RLS's "authorized staff can update appointments"
 * policy enforces the same distinction underneath as of
 * 0013_appointments_cancel_permission_fix.sql — a transition to
 * 'cancelled' requires appointments.cancel in addition to the base
 * appointments.edit every update needs, mirroring how the patients update
 * policy conditionally requires patients.delete.
 */
export async function cancelAppointmentStatus(appointmentId: string): Promise<AppointmentActionState> {
  return setAppointmentStatus(appointmentId, "cancelled", PERMISSIONS.APPOINTMENTS_CANCEL, "appointment.cancelled");
}
