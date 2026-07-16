"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  scheduleExceptionSchema,
  scheduleExceptionValuesFromFormData,
  vacationSchema,
  vacationValuesFromFormData,
  weeklyHoursBlockSchema,
  weeklyHoursBlockValuesFromFormData,
} from "@/lib/appointments/doctor-schedule-schema";

export interface DoctorScheduleActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const EXCLUSION_VIOLATION = "23P01";
const SCHEDULE_PATH = "/appointments/doctor-schedule";

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

export async function addWeeklyHoursBlock(formData: FormData): Promise<DoctorScheduleActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = weeklyHoursBlockSchema.safeParse(weeklyHoursBlockValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_weekly_hours")
    .insert({ ...parsed.data, clinic_id: staff.clinic_id })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === EXCLUSION_VIOLATION) {
      return { error: "This overlaps with another block already configured for that day." };
    }
    console.error("addWeeklyHoursBlock: insert failed", error);
    return { error: "Couldn't save the schedule block. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor_schedule.weekly_hours_added",
    entityType: "doctor_weekly_hours",
    entityId: data.id,
  });

  revalidatePath(SCHEDULE_PATH);
  return { success: true };
}

export async function removeWeeklyHoursBlock(id: string): Promise<DoctorScheduleActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("doctor_weekly_hours").delete().eq("id", id);

  if (error) {
    console.error("removeWeeklyHoursBlock: delete failed", error);
    return { error: "Couldn't remove the schedule block. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor_schedule.weekly_hours_removed",
    entityType: "doctor_weekly_hours",
    entityId: id,
  });

  revalidatePath(SCHEDULE_PATH);
  return { success: true };
}

export async function addVacation(formData: FormData): Promise<DoctorScheduleActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = vacationSchema.safeParse(vacationValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_vacations")
    .insert({
      doctor_id: parsed.data.doctor_id,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      reason: parsed.data.reason ?? null,
      clinic_id: staff.clinic_id,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("addVacation: insert failed", error);
    return { error: "Couldn't save the vacation. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor_schedule.vacation_added",
    entityType: "doctor_vacation",
    entityId: data.id,
  });

  revalidatePath(SCHEDULE_PATH);
  return { success: true };
}

export async function removeVacation(id: string): Promise<DoctorScheduleActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("doctor_vacations").delete().eq("id", id);

  if (error) {
    console.error("removeVacation: delete failed", error);
    return { error: "Couldn't remove the vacation. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor_schedule.vacation_removed",
    entityType: "doctor_vacation",
    entityId: id,
  });

  revalidatePath(SCHEDULE_PATH);
  return { success: true };
}

export async function addScheduleException(formData: FormData): Promise<DoctorScheduleActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = scheduleExceptionSchema.safeParse(scheduleExceptionValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("doctor_schedule_exceptions")
    .insert({ ...parsed.data, reason: parsed.data.reason ?? null, clinic_id: staff.clinic_id, created_by: staff.id })
    .select()
    .single();

  if (error || !data) {
    console.error("addScheduleException: insert failed", error);
    return { error: "Couldn't save the exception. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor_schedule.exception_added",
    entityType: "doctor_schedule_exception",
    entityId: data.id,
  });

  revalidatePath(SCHEDULE_PATH);
  return { success: true };
}

export async function removeScheduleException(id: string): Promise<DoctorScheduleActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("doctor_schedule_exceptions").delete().eq("id", id);

  if (error) {
    console.error("removeScheduleException: delete failed", error);
    return { error: "Couldn't remove the exception. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor_schedule.exception_removed",
    entityType: "doctor_schedule_exception",
    entityId: id,
  });

  revalidatePath(SCHEDULE_PATH);
  return { success: true };
}
