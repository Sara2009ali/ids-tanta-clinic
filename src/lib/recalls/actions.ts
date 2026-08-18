"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { recallFormSchema, recallFormValuesFromFormData, recallStatusSchema } from "@/lib/recalls/schema";
import { canDeleteRecall } from "@/lib/recalls/calculations";
import type { Database } from "@/types/database.generated";

export interface RecallActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  recallId?: string;
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

function revalidateRecallPaths(patientId: string) {
  revalidatePath("/recalls");
  revalidatePath(`/patients/${patientId}`);
}

/** Looked up via plain id — RLS (clinical.view/edit + clinic tenancy, see 0030_recalls.sql) already scopes this to rows the caller may see/touch, the same "let RLS do the ownership check" pattern findItemWithPlan() uses in treatment-plans/actions.ts. A row RLS hides looks identical to a row that doesn't exist. */
async function findRecall(
  supabase: SupabaseClient<Database>,
  recallId: string,
): Promise<{ id: string; clinic_id: string; patient_id: string; status: string } | null> {
  const { data, error } = await supabase
    .from("recalls")
    .select("id, clinic_id, patient_id, status")
    .eq("id", recallId)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/** clinic_id is derived from the patient row, never trusted from the client — same reasoning createTreatmentPlan() applies. */
export async function createRecall(formData: FormData): Promise<RecallActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = recallFormSchema.safeParse(recallFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select("id, clinic_id")
    .eq("id", parsed.data.patient_id)
    .maybeSingle();

  if (patientError || !patient) {
    console.error("createRecall: patient lookup failed", patientError);
    return { error: "Couldn't find this patient." };
  }

  const { data, error } = await supabase
    .from("recalls")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      doctor_id: parsed.data.doctor_id,
      visit_type_id: parsed.data.visit_type_id,
      reason: parsed.data.reason,
      due_date: parsed.data.due_date,
      notes: parsed.data.notes ?? null,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createRecall: insert failed", error);
    return { error: "Couldn't create this recall. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: patient.clinic_id,
    actorId: staff.id,
    action: "recall.created",
    entityType: "recall",
    entityId: data.id,
    changes: { patient_id: patient.id, reason: parsed.data.reason, due_date: parsed.data.due_date },
  });

  revalidateRecallPaths(patient.id);
  return { success: true, recallId: data.id };
}

/** Content fields only — reason/due_date/doctor/procedure/notes. Status and dismissed_reason are changed exclusively through changeRecallStatus() below, never here, same split updateTreatmentPlanItem()/changeTreatmentPlanItemStatus() already establish. patient_id is validated (the form always submits it) but never rewritten — a recall's patient is fixed at creation. */
export async function updateRecall(recallId: string, formData: FormData): Promise<RecallActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = recallFormSchema.safeParse(recallFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const existing = await findRecall(supabase, recallId);
  if (!existing) {
    console.error("updateRecall: recall lookup failed");
    return { error: "Couldn't find this recall." };
  }

  const { error } = await supabase
    .from("recalls")
    .update({
      reason: parsed.data.reason,
      due_date: parsed.data.due_date,
      doctor_id: parsed.data.doctor_id,
      visit_type_id: parsed.data.visit_type_id,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", recallId);

  if (error) {
    console.error("updateRecall: update failed", error);
    return { error: "Couldn't update this recall. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: existing.clinic_id,
    actorId: staff.id,
    action: "recall.updated",
    entityType: "recall",
    entityId: recallId,
  });

  revalidateRecallPaths(existing.patient_id);
  return { success: true, recallId };
}

/**
 * The only path that ever changes `status`. Never triggered by an
 * appointment's own status changing — always an explicit staff call (see
 * RecallStatusActions). `decided_at` is set once, the first time status
 * leaves 'due' — a later transition between two non-'due' statuses (e.g.
 * scheduled -> completed) leaves it alone, matching
 * treatment_plan_items.decided_at's "when was this decided" semantics
 * rather than "when did status last change." `dismissed_reason` is only
 * ever written when the new status is 'dismissed'; every other status
 * clears it, so a recall can never carry a stale reason from a previous
 * dismissal it was since reopened from.
 */
export async function changeRecallStatus(
  recallId: string,
  status: string,
  dismissedReason?: string,
): Promise<RecallActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsedStatus = recallStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { error: "That's not a valid recall status." };
  }

  const supabase = await createClient();

  const existing = await findRecall(supabase, recallId);
  if (!existing) {
    console.error("changeRecallStatus: recall lookup failed");
    return { error: "Couldn't find this recall." };
  }

  const update: { status: string; decided_at?: string; dismissed_reason: string | null } = {
    status: parsedStatus.data,
    dismissed_reason: parsedStatus.data === "dismissed" ? (dismissedReason?.trim() || null) : null,
  };
  if (existing.status === "due" && parsedStatus.data !== "due") {
    update.decided_at = new Date().toISOString();
  }

  const { error } = await supabase.from("recalls").update(update).eq("id", recallId);

  if (error) {
    console.error("changeRecallStatus: update failed", error);
    return { error: "Couldn't update this recall's status. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: existing.clinic_id,
    actorId: staff.id,
    action: "recall.status_changed",
    entityType: "recall",
    entityId: recallId,
    changes: { status: parsedStatus.data },
  });

  revalidateRecallPaths(existing.patient_id);
  return { success: true, recallId };
}

/** Hard delete — only ever offered by the UI while status is still 'due' (canDeleteRecall), re-checked here server-side so a stale client can't bypass it, same shape deleteTreatmentPlanItem() applies to its own draft-only rule. Once scheduled/completed/dismissed, a recall is a record of what was decided, not a mistake to erase — use a status change instead. */
export async function deleteRecall(recallId: string): Promise<RecallActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();

  const existing = await findRecall(supabase, recallId);
  if (!existing) {
    console.error("deleteRecall: recall lookup failed");
    return { error: "Couldn't find this recall." };
  }

  if (!canDeleteRecall(existing.status)) {
    return { error: "Only recalls that are still due can be deleted." };
  }

  const { error } = await supabase.from("recalls").delete().eq("id", recallId);

  if (error) {
    console.error("deleteRecall: delete failed", error);
    return { error: "Couldn't delete this recall. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: existing.clinic_id,
    actorId: staff.id,
    action: "recall.deleted",
    entityType: "recall",
    entityId: recallId,
    changes: { patient_id: existing.patient_id },
  });

  revalidateRecallPaths(existing.patient_id);
  return { success: true };
}
