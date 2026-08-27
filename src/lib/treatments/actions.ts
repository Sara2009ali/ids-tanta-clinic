"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { treatmentRecordFormSchema, treatmentRecordFormValuesFromFormData } from "@/lib/treatments/schema";
import { buildAutoRecallInsert, type AutoRecallCandidate } from "@/lib/recalls/calculations";
import { createNotification, getStaffIdsWithPermission } from "@/lib/notifications/service";
import { buildRecallCreatedNotification, shouldNotifyForAutoRecall } from "@/lib/notifications/events";

export interface TreatmentRecordActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
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

function revalidateTreatmentPaths(patientId: string) {
  revalidatePath("/reception");
  revalidatePath("/appointments");
  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/recalls");
}

/**
 * Automatic recall generation (Batch 6) — hooked directly into the one
 * server action that records a completed treatment, never into page
 * rendering or a scheduler (none exists in this repo). Best-effort: any
 * failure here is logged and swallowed, exactly like writeAuditLog()'s own
 * philosophy, since a recall/notification hiccup must never roll back or
 * block the treatment record the staff member is actually trying to save.
 *
 * Idempotency lives entirely in the database: the insert always sets
 * `treatment_record_id`, and `recalls_treatment_record_id_unique`
 * (0037_recall_automation.sql) makes a second insert for the same
 * treatment record a safe no-op via `on conflict ... do nothing` — this
 * function never needs to "check first," which a race between two retries
 * could defeat anyway. The notification only fires when the upsert actually
 * inserted a new row (a real Postgres INSERT happened), so a retried call
 * can never produce a duplicate notification either.
 */
async function generateAutoRecallForTreatment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    treatmentRecordId: string;
    clinicId: string;
    patientId: string;
    doctorId: string | null;
    visitTypeId: string;
    appointmentId: string | null;
    createdBy: string;
  },
): Promise<void> {
  const { data: visitType, error: visitTypeError } = await supabase
    .from("visit_types")
    .select("name, recall_interval_months")
    .eq("id", params.visitTypeId)
    .maybeSingle();

  if (visitTypeError || !visitType) {
    console.error("generateAutoRecallForTreatment: visit type lookup failed", visitTypeError);
    return;
  }

  const candidate: AutoRecallCandidate = {
    treatmentRecordId: params.treatmentRecordId,
    clinicId: params.clinicId,
    patientId: params.patientId,
    doctorId: params.doctorId,
    visitTypeId: params.visitTypeId,
    appointmentId: params.appointmentId,
    procedureName: visitType.name,
    recallIntervalMonths: visitType.recall_interval_months,
    treatmentDate: new Date(),
    createdBy: params.createdBy,
  };

  const insertPayload = buildAutoRecallInsert(candidate);
  if (!insertPayload) return; // No configured interval for this procedure — do nothing, per the approved design.

  const { data: recall, error: recallError } = await supabase
    .from("recalls")
    .upsert(insertPayload, { onConflict: "treatment_record_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (recallError) {
    console.error("generateAutoRecallForTreatment: recall insert failed", recallError);
    return;
  }
  // Conflict — a recall for this treatment record already exists; nothing new to notify about.
  if (!recall || !shouldNotifyForAutoRecall(recall.id)) return;

  const recipientStaffIds = await getStaffIdsWithPermission(supabase, params.clinicId, PERMISSIONS.CLINICAL_EDIT);
  await createNotification(
    supabase,
    buildRecallCreatedNotification({
      clinicId: params.clinicId,
      recallId: recall.id,
      procedureName: visitType.name,
      dueDate: insertPayload.due_date,
      createdBy: params.createdBy,
      recipientStaffIds,
    }),
  );
}

/** Defense-in-depth, same shape as appointmentBelongsToPatient() in treatment-plans/actions.ts: a treatment_plan_item_id the client sends must actually belong to a plan for this same patient. */
async function treatmentPlanItemBelongsToPatient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  treatmentPlanItemId: string,
  patientId: string,
): Promise<boolean> {
  const { data: item } = await supabase
    .from("treatment_plan_items")
    .select("treatment_plan_id")
    .eq("id", treatmentPlanItemId)
    .maybeSingle();
  if (!item) return false;

  const { data: plan } = await supabase
    .from("treatment_plans")
    .select("patient_id")
    .eq("id", item.treatment_plan_id)
    .maybeSingle();
  return plan?.patient_id === patientId;
}

/**
 * patient_id/doctor_id/clinic_id are derived here from the appointment row
 * itself, server-side — never trusted from the client — even though the
 * caller (the appointment Sheet) already has this data on screen. Same
 * defense-in-depth reasoning create_notification() (0016) applies: don't
 * trust anything the client could tamper with for a value the server can
 * authoritatively re-derive from the id alone.
 */
export async function createTreatmentRecord(
  appointmentId: string,
  formData: FormData,
): Promise<TreatmentRecordActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = treatmentRecordFormSchema.safeParse(treatmentRecordFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select("id, clinic_id, patient_id, doctor_id")
    .eq("id", appointmentId)
    .maybeSingle();

  if (appointmentError || !appointment) {
    console.error("createTreatmentRecord: appointment lookup failed", appointmentError);
    return { error: "Couldn't find this appointment." };
  }

  if (parsed.data.treatment_plan_item_id) {
    const belongs = await treatmentPlanItemBelongsToPatient(
      supabase,
      parsed.data.treatment_plan_item_id,
      appointment.patient_id,
    );
    if (!belongs) {
      return {
        error: "That treatment plan item doesn't belong to this patient.",
        fieldErrors: { treatment_plan_item_id: "Invalid treatment plan item" },
      };
    }
  }

  const { data, error } = await supabase
    .from("treatment_records")
    .insert({
      clinic_id: appointment.clinic_id,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      doctor_id: appointment.doctor_id,
      visit_type_id: parsed.data.visit_type_id,
      notes: parsed.data.notes ?? null,
      created_by: staff.id,
      treatment_plan_item_id: parsed.data.treatment_plan_item_id ?? null,
      tooth_id: parsed.data.tooth_id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createTreatmentRecord: insert failed", error);
    return { error: "Couldn't record this treatment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: appointment.clinic_id,
    actorId: staff.id,
    action: "treatment_record.created",
    entityType: "treatment_record",
    entityId: data.id,
    changes: { appointment_id: appointment.id, visit_type_id: parsed.data.visit_type_id },
  });

  await generateAutoRecallForTreatment(supabase, {
    treatmentRecordId: data.id,
    clinicId: appointment.clinic_id,
    patientId: appointment.patient_id,
    doctorId: appointment.doctor_id,
    visitTypeId: parsed.data.visit_type_id,
    appointmentId: appointment.id,
    createdBy: staff.id,
  });

  revalidateTreatmentPaths(appointment.patient_id);
  return { success: true };
}

export async function updateTreatmentRecord(
  recordId: string,
  formData: FormData,
): Promise<TreatmentRecordActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = treatmentRecordFormSchema.safeParse(treatmentRecordFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("treatment_records")
    .select("id, patient_id")
    .eq("id", recordId)
    .maybeSingle();

  if (existingError || !existing) {
    console.error("updateTreatmentRecord: record lookup failed", existingError);
    return { error: "Couldn't find this treatment record." };
  }

  if (parsed.data.treatment_plan_item_id) {
    const belongs = await treatmentPlanItemBelongsToPatient(
      supabase,
      parsed.data.treatment_plan_item_id,
      existing.patient_id,
    );
    if (!belongs) {
      return {
        error: "That treatment plan item doesn't belong to this patient.",
        fieldErrors: { treatment_plan_item_id: "Invalid treatment plan item" },
      };
    }
  }

  const { data, error } = await supabase
    .from("treatment_records")
    .update({
      visit_type_id: parsed.data.visit_type_id,
      notes: parsed.data.notes ?? null,
      treatment_plan_item_id: parsed.data.treatment_plan_item_id ?? null,
      tooth_id: parsed.data.tooth_id,
    })
    .eq("id", recordId)
    .select("id, clinic_id, patient_id")
    .maybeSingle();

  if (error || !data) {
    console.error("updateTreatmentRecord: update failed", error);
    return { error: "Couldn't update this treatment record. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: data.clinic_id,
    actorId: staff.id,
    action: "treatment_record.updated",
    entityType: "treatment_record",
    entityId: recordId,
    changes: { visit_type_id: parsed.data.visit_type_id },
  });

  revalidateTreatmentPaths(data.patient_id);
  return { success: true };
}

/** Soft delete only — matches appointments/patients' own convention. No hard-delete policy exists for authenticated on this table. */
export async function deleteTreatmentRecord(recordId: string): Promise<TreatmentRecordActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recordId)
    .select("id, clinic_id, patient_id")
    .maybeSingle();

  if (error || !data) {
    console.error("deleteTreatmentRecord: update failed", error);
    return { error: "Couldn't remove this treatment record. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: data.clinic_id,
    actorId: staff.id,
    action: "treatment_record.deleted",
    entityType: "treatment_record",
    entityId: recordId,
  });

  revalidateTreatmentPaths(data.patient_id);
  return { success: true };
}
