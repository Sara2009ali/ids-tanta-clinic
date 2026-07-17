"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { chairFormSchema, chairFormValuesFromFormData } from "@/lib/appointments/chair-schema";

export interface ChairActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

const UNIQUE_VIOLATION = "23505";
const CHAIRS_PATH = "/appointments/chairs";

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

function revalidateChairPaths() {
  revalidatePath(CHAIRS_PATH);
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
}

export async function createChair(formData: FormData): Promise<ChairActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = chairFormSchema.safeParse(chairFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chairs")
    .insert({ label: parsed.data.label, clinic_id: staff.clinic_id })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "A chair with this name already exists.", fieldErrors: { label: "Already in use" } };
    }
    console.error("createChair: insert failed", error);
    return { error: "Couldn't create the chair. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "chair.created",
    entityType: "chair",
    entityId: data.id,
  });

  revalidateChairPaths();
  return { success: true };
}

export async function updateChair(chairId: string, formData: FormData): Promise<ChairActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = chairFormSchema.safeParse(chairFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("chairs").update({ label: parsed.data.label }).eq("id", chairId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A chair with this name already exists.", fieldErrors: { label: "Already in use" } };
    }
    console.error("updateChair: update failed", error);
    return { error: "Couldn't update the chair. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "chair.updated",
    entityType: "chair",
    entityId: chairId,
  });

  revalidateChairPaths();
  return { success: true };
}

export async function toggleChairActive(chairId: string, isActive: boolean): Promise<ChairActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("chairs").update({ is_active: isActive }).eq("id", chairId);

  if (error) {
    console.error("toggleChairActive: update failed", error);
    return { error: "Couldn't update the chair. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "chair.enabled" : "chair.disabled",
    entityType: "chair",
    entityId: chairId,
  });

  revalidateChairPaths();
  return { success: true };
}

export async function deleteChair(chairId: string): Promise<ChairActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("chairs").delete().eq("id", chairId);

  if (error) {
    console.error("deleteChair: delete failed", error);
    return { error: "Couldn't delete the chair. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "chair.deleted",
    entityType: "chair",
    entityId: chairId,
  });

  revalidateChairPaths();
  return { success: true };
}
