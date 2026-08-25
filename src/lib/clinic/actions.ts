"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { fieldErrorsFromZod } from "@/lib/forms/zod-errors";
import {
  clinicUpdateFormSchema,
  clinicUpdateFormValuesFromFormData,
  isStoragePathForClinic,
  extractClinicLogoStoragePath,
  CLINIC_LOGOS_BUCKET,
} from "@/lib/clinic/schema";

export interface ClinicActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  logoUrl?: string | null;
}

const CLINIC_SETTINGS_PATH = "/settings/clinic";

/**
 * Clinic identity + regional settings. Relies on the "admins can update
 * their own clinic" RLS policy (0035_clinic_admin.sql) — an authenticated,
 * RLS-scoped write, not a service-role bypass, since this is an ordinary
 * row update with no auth.users involvement (unlike onboarding/doctors,
 * which need the Admin API). clinic_id always comes from the caller's own
 * session, never the form, so this can never target another clinic even if
 * a request were somehow crafted to try.
 */
export async function updateClinic(formData: FormData): Promise<ClinicActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = clinicUpdateFormSchema.safeParse(clinicUpdateFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinics")
    .update({
      name: values.name,
      phone: values.phone ?? null,
      address: values.address ?? null,
      timezone: values.timezone,
    })
    .eq("id", staff.clinic_id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    console.error("updateClinic: update failed", error);
    return { error: "Couldn't update the clinic. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "clinic.updated",
    entityType: "clinic",
    entityId: staff.clinic_id,
  });

  revalidatePath(CLINIC_SETTINGS_PATH);
  return { success: true };
}

/**
 * Saves a logo already uploaded client-side (see clinic-logo-uploader.tsx)
 * to the clinic-logos bucket — the same "upload under RLS from the browser,
 * then a server action records the result" split FileUploadZone/
 * recordPatientFile already establishes, so no service-role client is
 * needed here at all. `storagePath` is re-validated against this clinic's
 * own folder before being trusted (isStoragePathForClinic) — defense in
 * depth on top of the storage INSERT policy that already restricted where
 * the upload itself could land.
 */
export async function updateClinicLogo(storagePath: string): Promise<ClinicActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  if (!isStoragePathForClinic(storagePath, staff.clinic_id)) {
    return { error: "That upload doesn't belong to this clinic." };
  }

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("clinics")
    .select("logo_url")
    .eq("id", staff.clinic_id)
    .maybeSingle();

  const { data: publicUrlData } = supabase.storage.from(CLINIC_LOGOS_BUCKET).getPublicUrl(storagePath);
  const logoUrl = publicUrlData.publicUrl;

  const { error } = await supabase.from("clinics").update({ logo_url: logoUrl }).eq("id", staff.clinic_id);

  if (error) {
    console.error("updateClinicLogo: update failed", error);
    return { error: "Couldn't save the new logo. Please try again." };
  }

  // Best-effort cleanup of the previous file — never blocks the save the
  // admin is actually waiting on. A leftover orphaned object in storage is
  // harmless; failing to show their new logo would not be.
  const oldPath = extractClinicLogoStoragePath(current?.logo_url);
  if (oldPath && oldPath !== storagePath) {
    const { error: removeError } = await supabase.storage.from(CLINIC_LOGOS_BUCKET).remove([oldPath]);
    if (removeError) console.error("updateClinicLogo: old logo cleanup failed", removeError);
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "clinic.logo_updated",
    entityType: "clinic",
    entityId: staff.clinic_id,
  });

  revalidatePath(CLINIC_SETTINGS_PATH);
  return { success: true, logoUrl };
}

export async function removeClinicLogo(): Promise<ClinicActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("clinics")
    .select("logo_url")
    .eq("id", staff.clinic_id)
    .maybeSingle();

  const { error } = await supabase.from("clinics").update({ logo_url: null }).eq("id", staff.clinic_id);

  if (error) {
    console.error("removeClinicLogo: update failed", error);
    return { error: "Couldn't remove the logo. Please try again." };
  }

  const oldPath = extractClinicLogoStoragePath(current?.logo_url);
  if (oldPath) {
    const { error: removeError } = await supabase.storage.from(CLINIC_LOGOS_BUCKET).remove([oldPath]);
    if (removeError) console.error("removeClinicLogo: storage cleanup failed", removeError);
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "clinic.logo_removed",
    entityType: "clinic",
    entityId: staff.clinic_id,
  });

  revalidatePath(CLINIC_SETTINGS_PATH);
  return { success: true, logoUrl: null };
}
