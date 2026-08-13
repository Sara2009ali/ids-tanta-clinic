"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { treatmentRecordFormSchema, treatmentRecordFormValuesFromFormData } from "@/lib/treatments/schema";

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
