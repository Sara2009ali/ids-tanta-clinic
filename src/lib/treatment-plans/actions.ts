"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  treatmentPlanFormSchema,
  treatmentPlanFormValuesFromFormData,
  treatmentPlanItemFormSchema,
  treatmentPlanItemFormValuesFromFormData,
  treatmentPlanItemStatusSchema,
} from "@/lib/treatment-plans/schema";
import { canTransitionPlanStatus, isAppointmentForPatient, type TreatmentPlanTransitionAction } from "@/lib/treatment-plans/calculations";
import type { Database } from "@/types/database.generated";

export interface TreatmentPlanActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  planId?: string;
}

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

function revalidateTreatmentPlanPaths(patientId: string, planId?: string) {
  revalidatePath(`/patients/${patientId}`);
  if (planId) revalidatePath(`/patients/${patientId}/treatment-plans/${planId}`);
}

/** Defense-in-depth: an appointment_id the client sends must actually belong to the patient the item is being written for — same pattern createClinicalNote()/updateClinicalNote() apply to patient_clinical_notes.appointment_id. */
async function appointmentBelongsToPatient(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  patientId: string,
): Promise<boolean> {
  const { data } = await supabase.from("appointments").select("patient_id").eq("id", appointmentId).maybeSingle();
  return isAppointmentForPatient(data, patientId);
}

/** clinic_id is derived from the patient row, never trusted from the client or from staff.clinic_id (nullable for super_admin) — same reasoning createClinicalNote() applies. */
export async function createTreatmentPlan(patientId: string, formData: FormData): Promise<TreatmentPlanActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = treatmentPlanFormSchema.safeParse(treatmentPlanFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", patientId)
    .maybeSingle();

  if (patientError || !patient) {
    console.error("createTreatmentPlan: patient lookup failed", patientError);
    return { error: "Couldn't find this patient." };
  }

  const { data, error } = await supabase
    .from("treatment_plans")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      created_by: staff.id,
      title: parsed.data.title ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createTreatmentPlan: insert failed", error);
    return { error: "Couldn't create this treatment plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: patient.clinic_id,
    actorId: staff.id,
    action: "treatment_plan.created",
    entityType: "treatment_plan",
    entityId: data.id,
    changes: { patient_id: patient.id },
  });

  revalidateTreatmentPlanPaths(patient.id, data.id);
  return { success: true, planId: data.id };
}

export async function updateTreatmentPlanTitle(planId: string, formData: FormData): Promise<TreatmentPlanActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = treatmentPlanFormSchema.safeParse(treatmentPlanFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_plans")
    .update({ title: parsed.data.title ?? null })
    .eq("id", planId)
    .select("id, clinic_id, patient_id")
    .maybeSingle();

  if (error || !data) {
    console.error("updateTreatmentPlanTitle: update failed", error);
    return { error: "Couldn't update this treatment plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: data.clinic_id,
    actorId: staff.id,
    action: "treatment_plan.updated",
    entityType: "treatment_plan",
    entityId: planId,
  });

  revalidateTreatmentPlanPaths(data.patient_id, planId);
  return { success: true };
}

/** Soft delete only — matches every other clinical table's convention. No hard-delete policy exists for authenticated on this table. */
export async function deleteTreatmentPlan(planId: string): Promise<TreatmentPlanActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_plans")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", planId)
    .select("id, clinic_id, patient_id")
    .maybeSingle();

  if (error || !data) {
    console.error("deleteTreatmentPlan: update failed", error);
    return { error: "Couldn't remove this treatment plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: data.clinic_id,
    actorId: staff.id,
    action: "treatment_plan.deleted",
    entityType: "treatment_plan",
    entityId: planId,
  });

  revalidateTreatmentPlanPaths(data.patient_id);
  return { success: true };
}

/**
 * The only three plan-level status changes the product exposes — each one
 * checks the plan's current status server-side via canTransitionPlanStatus()
 * before writing, so a stale client (two tabs open, a slow network) can
 * never push a nonsensical transition through even though the RLS policy
 * itself doesn't restrict which status value an update may set.
 */
async function transitionTreatmentPlanStatus(
  planId: string,
  action: TreatmentPlanTransitionAction,
  nextStatus: "active" | "completed" | "abandoned",
  auditAction: string,
): Promise<TreatmentPlanActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();
  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, clinic_id, patient_id, status")
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    console.error("transitionTreatmentPlanStatus: plan lookup failed", planError);
    return { error: "Couldn't find this treatment plan." };
  }

  if (!canTransitionPlanStatus(plan.status as "draft" | "active" | "completed" | "abandoned", action)) {
    return { error: `A ${plan.status} plan can't be moved to ${nextStatus}.` };
  }

  const { error } = await supabase.from("treatment_plans").update({ status: nextStatus }).eq("id", planId);

  if (error) {
    console.error("transitionTreatmentPlanStatus: update failed", error);
    return { error: "Couldn't update this treatment plan. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: plan.clinic_id,
    actorId: staff.id,
    action: auditAction,
    entityType: "treatment_plan",
    entityId: planId,
    changes: { from: plan.status, to: nextStatus },
  });

  revalidateTreatmentPlanPaths(plan.patient_id, planId);
  return { success: true };
}

export async function activateTreatmentPlan(planId: string): Promise<TreatmentPlanActionState> {
  return transitionTreatmentPlanStatus(planId, "activate", "active", "treatment_plan.activated");
}

export async function completeTreatmentPlan(planId: string): Promise<TreatmentPlanActionState> {
  return transitionTreatmentPlanStatus(planId, "complete", "completed", "treatment_plan.completed");
}

export async function abandonTreatmentPlan(planId: string): Promise<TreatmentPlanActionState> {
  return transitionTreatmentPlanStatus(planId, "abandon", "abandoned", "treatment_plan.abandoned");
}

export interface TreatmentPlanItemActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

/** clinic_id/patient_id are derived from the parent plan, never trusted from the client. sequence is server-computed (one past the current max) so the client never has to coordinate it for a plain add. */
export async function createTreatmentPlanItem(
  planId: string,
  formData: FormData,
): Promise<TreatmentPlanItemActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = treatmentPlanItemFormSchema.safeParse(treatmentPlanItemFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, clinic_id, patient_id")
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    console.error("createTreatmentPlanItem: plan lookup failed", planError);
    return { error: "Couldn't find this treatment plan." };
  }

  if (parsed.data.appointment_id) {
    const belongs = await appointmentBelongsToPatient(supabase, parsed.data.appointment_id, plan.patient_id);
    if (!belongs) {
      return {
        error: "That appointment doesn't belong to this patient.",
        fieldErrors: { appointment_id: "Invalid appointment" },
      };
    }
  }

  const { data: maxSequenceRow } = await supabase
    .from("treatment_plan_items")
    .select("sequence")
    .eq("treatment_plan_id", planId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSequence = (maxSequenceRow?.sequence ?? -1) + 1;

  const { data, error } = await supabase
    .from("treatment_plan_items")
    .insert({
      clinic_id: plan.clinic_id,
      treatment_plan_id: plan.id,
      visit_type_id: parsed.data.visit_type_id,
      procedure_name: parsed.data.procedure_name,
      estimated_price: parsed.data.estimated_price,
      quantity: parsed.data.quantity,
      tooth_reference: parsed.data.tooth_reference ?? null,
      sequence: nextSequence,
      priority: parsed.data.priority,
      notes: parsed.data.notes ?? null,
      appointment_id: parsed.data.appointment_id ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createTreatmentPlanItem: insert failed", error);
    return { error: "Couldn't add this item. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: plan.clinic_id,
    actorId: staff.id,
    action: "treatment_plan_item.created",
    entityType: "treatment_plan_item",
    entityId: data.id,
    changes: { treatment_plan_id: plan.id, procedure_name: parsed.data.procedure_name },
  });

  revalidateTreatmentPlanPaths(plan.patient_id, plan.id);
  return { success: true };
}

/** Looks up an item's parent plan (patient_id, status) via two plain queries rather than a relational embed — keeps this module's typing simple instead of depending on how precisely the (currently hand-augmented, pending live regeneration) generated types describe the treatment_plan_items -> treatment_plans relationship. */
async function findItemWithPlan(
  supabase: SupabaseClient<Database>,
  itemId: string,
): Promise<{ id: string; clinic_id: string; treatment_plan_id: string; patient_id: string; planStatus: string } | null> {
  const { data: item, error: itemError } = await supabase
    .from("treatment_plan_items")
    .select("id, clinic_id, treatment_plan_id")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) return null;

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("patient_id, status")
    .eq("id", item.treatment_plan_id)
    .maybeSingle();

  if (planError || !plan) return null;

  return { ...item, patient_id: plan.patient_id, planStatus: plan.status };
}

/** Content fields only — status and sequence are changed exclusively through changeTreatmentPlanItemStatus()/reorderTreatmentPlanItems() below, never here. */
export async function updateTreatmentPlanItem(
  itemId: string,
  formData: FormData,
): Promise<TreatmentPlanItemActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = treatmentPlanItemFormSchema.safeParse(treatmentPlanItemFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const existing = await findItemWithPlan(supabase, itemId);
  if (!existing) {
    console.error("updateTreatmentPlanItem: item lookup failed");
    return { error: "Couldn't find this item." };
  }

  const patientId = existing.patient_id;

  if (parsed.data.appointment_id) {
    const belongs = await appointmentBelongsToPatient(supabase, parsed.data.appointment_id, patientId);
    if (!belongs) {
      return {
        error: "That appointment doesn't belong to this patient.",
        fieldErrors: { appointment_id: "Invalid appointment" },
      };
    }
  }

  const { error } = await supabase
    .from("treatment_plan_items")
    .update({
      visit_type_id: parsed.data.visit_type_id,
      procedure_name: parsed.data.procedure_name,
      estimated_price: parsed.data.estimated_price,
      quantity: parsed.data.quantity,
      tooth_reference: parsed.data.tooth_reference ?? null,
      priority: parsed.data.priority,
      notes: parsed.data.notes ?? null,
      appointment_id: parsed.data.appointment_id ?? null,
    })
    .eq("id", itemId);

  if (error) {
    console.error("updateTreatmentPlanItem: update failed", error);
    return { error: "Couldn't update this item. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: existing.clinic_id,
    actorId: staff.id,
    action: "treatment_plan_item.updated",
    entityType: "treatment_plan_item",
    entityId: itemId,
  });

  revalidateTreatmentPlanPaths(patientId, existing.treatment_plan_id);
  return { success: true };
}

export async function changeTreatmentPlanItemStatus(
  itemId: string,
  status: string,
): Promise<TreatmentPlanItemActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsedStatus = treatmentPlanItemStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { error: "That's not a valid item status." };
  }

  const supabase = await createClient();

  const existing = await findItemWithPlan(supabase, itemId);
  if (!existing) {
    console.error("changeTreatmentPlanItemStatus: item lookup failed");
    return { error: "Couldn't find this item." };
  }

  const decidedStatuses = new Set(["accepted", "postponed", "rejected"]);
  const update: { status: string; decided_at?: string } = { status: parsedStatus.data };
  if (decidedStatuses.has(parsedStatus.data)) {
    update.decided_at = new Date().toISOString();
  }

  const { error } = await supabase.from("treatment_plan_items").update(update).eq("id", itemId);

  if (error) {
    console.error("changeTreatmentPlanItemStatus: update failed", error);
    return { error: "Couldn't update this item's status. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: existing.clinic_id,
    actorId: staff.id,
    action: "treatment_plan_item.status_changed",
    entityType: "treatment_plan_item",
    entityId: itemId,
    changes: { status: parsedStatus.data },
  });

  revalidateTreatmentPlanPaths(existing.patient_id, existing.treatment_plan_id);
  return { success: true };
}

/** Batch-writes `sequence = index` for every id in `orderedItemIds`. Every id must already belong to `planId` — ids from any other plan are silently ignored rather than trusted. */
export async function reorderTreatmentPlanItems(
  planId: string,
  orderedItemIds: string[],
): Promise<TreatmentPlanItemActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();

  const { data: plan, error: planError } = await supabase
    .from("treatment_plans")
    .select("id, clinic_id, patient_id")
    .eq("id", planId)
    .maybeSingle();

  if (planError || !plan) {
    console.error("reorderTreatmentPlanItems: plan lookup failed", planError);
    return { error: "Couldn't find this treatment plan." };
  }

  const { data: existingItems, error: itemsError } = await supabase
    .from("treatment_plan_items")
    .select("id")
    .eq("treatment_plan_id", planId);

  if (itemsError) {
    console.error("reorderTreatmentPlanItems: item lookup failed", itemsError);
    return { error: "Couldn't reorder these items. Please try again." };
  }

  const validIds = new Set((existingItems ?? []).map((item) => item.id));
  const updates = orderedItemIds
    .filter((id) => validIds.has(id))
    .map((id, index) => supabase.from("treatment_plan_items").update({ sequence: index }).eq("id", id));

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    console.error("reorderTreatmentPlanItems: update failed", failed.error);
    return { error: "Couldn't reorder these items. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: plan.clinic_id,
    actorId: staff.id,
    action: "treatment_plan_item.reordered",
    entityType: "treatment_plan",
    entityId: planId,
  });

  revalidateTreatmentPlanPaths(plan.patient_id, planId);
  return { success: true };
}

/** Hard delete — only ever offered by the UI while the parent plan is still `draft`, and re-checked here server-side so a stale client can't bypass it. Items in an active/completed/abandoned plan are historical facts (what was proposed), so status changes (e.g. `rejected`), not deletion, is the right tool past draft. */
export async function deleteTreatmentPlanItem(itemId: string): Promise<TreatmentPlanItemActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();

  const existing = await findItemWithPlan(supabase, itemId);
  if (!existing) {
    console.error("deleteTreatmentPlanItem: item lookup failed");
    return { error: "Couldn't find this item." };
  }

  if (existing.planStatus !== "draft") {
    return { error: "Items can only be removed while the plan is still a draft." };
  }

  const { error } = await supabase.from("treatment_plan_items").delete().eq("id", itemId);

  if (error) {
    console.error("deleteTreatmentPlanItem: delete failed", error);
    return { error: "Couldn't remove this item. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: existing.clinic_id,
    actorId: staff.id,
    action: "treatment_plan_item.deleted",
    entityType: "treatment_plan_item",
    entityId: itemId,
  });

  revalidateTreatmentPlanPaths(existing.patient_id, existing.treatment_plan_id);
  return { success: true };
}
