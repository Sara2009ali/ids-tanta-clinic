"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  insurancePlanFormSchema,
  insurancePlanFormValuesFromFormData,
  insurerFormSchema,
  insurerFormValuesFromFormData,
} from "@/lib/insurance/schema";

export interface InsuranceActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  id?: string;
}

const UNIQUE_VIOLATION = "23505";
const INSURANCE_SETTINGS_PATH = "/settings/insurance";

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

function revalidateInsurancePaths() {
  revalidatePath(INSURANCE_SETTINGS_PATH);
  revalidatePath("/patients");
}

export async function createInsurer(formData: FormData): Promise<InsuranceActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = insurerFormSchema.safeParse(insurerFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurers")
    .insert({ name: parsed.data.name, clinic_id: staff.clinic_id })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "An insurer with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createInsurer: insert failed", error);
    return { error: "Couldn't create the insurer. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "insurer.created",
    entityType: "insurer",
    entityId: data.id,
  });

  revalidateInsurancePaths();
  return { success: true, id: data.id };
}

export async function toggleInsurerActive(insurerId: string, isActive: boolean): Promise<InsuranceActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("insurers").update({ is_active: isActive }).eq("id", insurerId);

  if (error) {
    console.error("toggleInsurerActive: update failed", error);
    return { error: "Couldn't update the insurer. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "insurer.enabled" : "insurer.disabled",
    entityType: "insurer",
    entityId: insurerId,
  });

  revalidateInsurancePaths();
  return { success: true };
}

/** Blocks deleting an insurer that still has plans — disable it instead, same "check first" shape as deleteVisitType(). */
export async function deleteInsurer(insurerId: string): Promise<InsuranceActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("insurance_plans")
    .select("*", { count: "exact", head: true })
    .eq("insurer_id", insurerId);
  if (count && count > 0) {
    return { error: "This insurer has plans on it. Delete or reassign those plans first, or disable it instead." };
  }

  const { error } = await supabase.from("insurers").delete().eq("id", insurerId);
  if (error) {
    console.error("deleteInsurer: delete failed", error);
    return { error: "Couldn't delete the insurer. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "insurer.deleted",
    entityType: "insurer",
    entityId: insurerId,
  });

  revalidateInsurancePaths();
  return { success: true };
}

export async function createInsurancePlan(insurerId: string, formData: FormData): Promise<InsuranceActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = insurancePlanFormSchema.safeParse(insurancePlanFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("insurance_plans")
    .insert({
      insurer_id: insurerId,
      clinic_id: staff.clinic_id,
      name: parsed.data.name,
      coverage_percent: parsed.data.coverage_percent,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "This insurer already has a plan with this name.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createInsurancePlan: insert failed", error);
    return { error: "Couldn't create the plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "insurance_plan.created",
    entityType: "insurance_plan",
    entityId: data.id,
  });

  revalidateInsurancePaths();
  return { success: true, id: data.id };
}

export async function toggleInsurancePlanActive(planId: string, isActive: boolean): Promise<InsuranceActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("insurance_plans").update({ is_active: isActive }).eq("id", planId);

  if (error) {
    console.error("toggleInsurancePlanActive: update failed", error);
    return { error: "Couldn't update the plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "insurance_plan.enabled" : "insurance_plan.disabled",
    entityType: "insurance_plan",
    entityId: planId,
  });

  revalidateInsurancePaths();
  return { success: true };
}

/** Deleting a plan never touches existing patient_insurance rows — insurance_plan_id is `on delete set null` (0032_insurance_foundation.sql). */
export async function deleteInsurancePlan(planId: string): Promise<InsuranceActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("insurance_plans").delete().eq("id", planId);

  if (error) {
    console.error("deleteInsurancePlan: delete failed", error);
    return { error: "Couldn't delete the plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "insurance_plan.deleted",
    entityType: "insurance_plan",
    entityId: planId,
  });

  revalidateInsurancePaths();
  return { success: true };
}
