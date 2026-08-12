"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  doctorCreateFormSchema,
  doctorCreateFormValuesFromFormData,
  doctorEditFormSchema,
  doctorEditFormValuesFromFormData,
} from "@/lib/doctors/schema";

export interface DoctorActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  doctorId?: string;
}

export interface DoctorAccessActionState {
  error?: string;
  success?: boolean;
  /** Only set by enableDoctorAccess() — shown to the admin exactly once, never stored. */
  temporaryPassword?: string;
}

const DOCTORS_PATH = "/settings/doctors";
/** Supabase's documented convention for an effectively permanent ban (~100 years) — there is no literal "forever" value. */
const PERMANENT_BAN = "876000h";
/** A handful of visually distinct swatches to auto-assign at creation, matching visit_types' own default color rather than asking the admin to pick one up front. */
const DOCTOR_COLOR_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#0ea5e9", "#ec4899", "#14b8a6"];

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

function revalidateDoctorPaths(doctorId?: string) {
  revalidatePath(DOCTORS_PATH);
  if (doctorId) revalidatePath(`${DOCTORS_PATH}/${doctorId}`);
}

/** 14 random bytes as base64url (~19 chars) — short enough to read aloud, well past Supabase's default minimum password strength. */
function generateTemporaryPassword(): string {
  return randomBytes(14).toString("base64url");
}

function randomDoctorColor(): string {
  return DOCTOR_COLOR_PALETTE[Math.floor(Math.random() * DOCTOR_COLOR_PALETTE.length)];
}

function isDuplicateEmailError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  return /already been registered|already exists/i.test(error.message ?? "");
}

/**
 * Creates the doctor's clinic record AND their login identity in one
 * action — staff_profiles.id is a hard FK to auth.users.id
 * (0001_phase1_foundation.sql), so one cannot exist without the other, no
 * matter how the UI frames it. The auth user is created permanently
 * banned: nobody can sign in with it until an admin explicitly calls
 * enableDoctorAccess(). Any failure after the auth user is created rolls
 * it back (compensating delete), the same pattern createInvoice() uses for
 * invoice+items.
 */
export async function createDoctor(formData: FormData): Promise<DoctorActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = doctorCreateFormSchema.safeParse(doctorCreateFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("createDoctor: admin client unavailable", error);
    return { error: "Doctor accounts aren't configured in this environment yet. Contact your administrator." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: values.email,
    password: generateTemporaryPassword(),
    email_confirm: true,
    ban_duration: PERMANENT_BAN,
  });

  if (createError || !created?.user) {
    if (isDuplicateEmailError(createError)) {
      return { error: "This email is already in use.", fieldErrors: { email: "Already in use" } };
    }
    console.error("createDoctor: auth user creation failed", createError);
    return { error: "Couldn't create the doctor's account. Please try again." };
  }

  const doctorId = created.user.id;
  const supabase = await createClient();

  const { error: staffError } = await supabase.from("staff_profiles").insert({
    id: doctorId,
    clinic_id: staff.clinic_id,
    full_name: values.full_name,
    role: "doctor",
    phone: values.phone ?? null,
  });

  if (staffError) {
    console.error("createDoctor: staff_profiles insert failed", staffError);
    await admin.auth.admin.deleteUser(doctorId);
    return { error: "Couldn't create the doctor. Please try again." };
  }

  const { error: profileError } = await supabase.from("doctor_profiles").insert({
    doctor_id: doctorId,
    clinic_id: staff.clinic_id,
    specialty: values.specialty ?? null,
    license_number: values.license_number ?? null,
    color: randomDoctorColor(),
  });

  if (profileError) {
    console.error("createDoctor: doctor_profiles insert failed", profileError);
    await supabase.from("staff_profiles").delete().eq("id", doctorId);
    await admin.auth.admin.deleteUser(doctorId);
    return { error: "Couldn't create the doctor. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor.created",
    entityType: "doctor",
    entityId: doctorId,
  });

  revalidateDoctorPaths(doctorId);
  return { success: true, doctorId };
}

/** Profile-only edit — no email field. The login identity isn't touched here; see enable/revokeDoctorAccess for account changes. */
export async function updateDoctor(doctorId: string, formData: FormData): Promise<DoctorActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = doctorEditFormSchema.safeParse(doctorEditFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const supabase = await createClient();

  const { error: staffError } = await supabase
    .from("staff_profiles")
    .update({ full_name: values.full_name, phone: values.phone ?? null })
    .eq("id", doctorId);

  if (staffError) {
    console.error("updateDoctor: staff_profiles update failed", staffError);
    return { error: "Couldn't update the doctor. Please try again." };
  }

  const { error: profileError } = await supabase
    .from("doctor_profiles")
    .update({
      specialty: values.specialty ?? null,
      license_number: values.license_number ?? null,
      bio: values.bio ?? null,
      color: values.color,
    })
    .eq("doctor_id", doctorId);

  if (profileError) {
    console.error("updateDoctor: doctor_profiles update failed", profileError);
    return { error: "Couldn't update the doctor's profile. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor.updated",
    entityType: "doctor",
    entityId: doctorId,
  });

  revalidateDoctorPaths(doctorId);
  return { success: true, doctorId };
}

/**
 * Deactivate/reactivate the doctor's clinic roster status (is_active) —
 * this is what removes them from booking/assignment dropdowns
 * (listDoctors() already filters on is_active) while every historical
 * appointment/treatment record/compensation row keeps referencing them
 * unchanged (all `on delete restrict`, none of this touches those rows).
 *
 * Deactivating also revokes login access — an ex-staff member's dormant
 * credentials should never stay usable. Reactivating does NOT restore
 * access automatically: access is a deliberate, separate grant
 * (enableDoctorAccess), not an automatic side effect of roster status.
 */
export async function setDoctorActive(doctorId: string, isActive: boolean): Promise<DoctorActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("staff_profiles").update({ is_active: isActive }).eq("id", doctorId);

  if (error) {
    console.error("setDoctorActive: update failed", error);
    return { error: "Couldn't update the doctor. Please try again." };
  }

  if (!isActive) {
    try {
      const admin = createAdminClient();
      const { error: banError } = await admin.auth.admin.updateUserById(doctorId, { ban_duration: PERMANENT_BAN });
      if (banError) throw banError;
    } catch (accessError) {
      console.error("setDoctorActive: revoking access failed", accessError);
    }
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "doctor.reactivated" : "doctor.deactivated",
    entityType: "doctor",
    entityId: doctorId,
  });

  revalidateDoctorPaths(doctorId);
  return { success: true, doctorId };
}

/** Un-bans the account and issues a fresh temporary password — safe to call again later purely as a password reset while access is already enabled. */
export async function enableDoctorAccess(doctorId: string): Promise<DoctorAccessActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("enableDoctorAccess: admin client unavailable", error);
    return { error: "Doctor accounts aren't configured in this environment yet. Contact your administrator." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(doctorId, {
    password: temporaryPassword,
    ban_duration: "none",
  });

  if (error) {
    console.error("enableDoctorAccess: update failed", error);
    return { error: "Couldn't enable access. Please try again." };
  }

  const supabase = await createClient();
  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor.access_enabled",
    entityType: "doctor",
    entityId: doctorId,
  });

  revalidateDoctorPaths(doctorId);
  return { success: true, temporaryPassword };
}

export async function revokeDoctorAccess(doctorId: string): Promise<DoctorAccessActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("revokeDoctorAccess: admin client unavailable", error);
    return { error: "Doctor accounts aren't configured in this environment yet. Contact your administrator." };
  }

  const { error } = await admin.auth.admin.updateUserById(doctorId, { ban_duration: PERMANENT_BAN });

  if (error) {
    console.error("revokeDoctorAccess: update failed", error);
    return { error: "Couldn't revoke access. Please try again." };
  }

  const supabase = await createClient();
  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "doctor.access_revoked",
    entityType: "doctor",
    entityId: doctorId,
  });

  revalidateDoctorPaths(doctorId);
  return { success: true };
}
