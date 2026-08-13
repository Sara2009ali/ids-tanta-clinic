"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { clinicalNoteFormSchema, clinicalNoteFormValuesFromFormData } from "@/lib/clinical-notes/schema";
import type { Database } from "@/types/database.generated";

export interface ClinicalNoteActionState {
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

function revalidateClinicalNotePaths(patientId: string) {
  revalidatePath(`/patients/${patientId}`);
}

/** Defense-in-depth: an appointment_id the client sends must actually belong to the patient the note is being written for, even though the UI only ever offers that patient's own appointments as options. */
async function appointmentBelongsToPatient(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  patientId: string,
): Promise<boolean> {
  const { data } = await supabase.from("appointments").select("patient_id").eq("id", appointmentId).maybeSingle();
  return data?.patient_id === patientId;
}

/**
 * clinic_id is derived here from the patient row itself, server-side — never
 * trusted from the client — and author_id is always the acting staff
 * member's own id, never client-supplied. Same defense-in-depth reasoning
 * createTreatmentRecord() applies (treatments/actions.ts): don't trust
 * anything the client could tamper with for a value the server can
 * authoritatively re-derive from the id alone. Deriving from the patient
 * (rather than the acting staff member's own clinic_id) also means this
 * still works correctly for a super_admin, whose own staff row has no
 * clinic_id.
 */
export async function createClinicalNote(patientId: string, formData: FormData): Promise<ClinicalNoteActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = clinicalNoteFormSchema.safeParse(clinicalNoteFormValuesFromFormData(formData));
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
    console.error("createClinicalNote: patient lookup failed", patientError);
    return { error: "Couldn't find this patient." };
  }

  if (parsed.data.appointment_id) {
    const belongs = await appointmentBelongsToPatient(supabase, parsed.data.appointment_id, patient.id);
    if (!belongs) {
      return {
        error: "That appointment doesn't belong to this patient.",
        fieldErrors: { appointment_id: "Invalid appointment" },
      };
    }
  }

  const { data, error } = await supabase
    .from("patient_clinical_notes")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      author_id: staff.id,
      note: parsed.data.note,
      appointment_id: parsed.data.appointment_id ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createClinicalNote: insert failed", error);
    return { error: "Couldn't save this note. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: patient.clinic_id,
    actorId: staff.id,
    action: "clinical_note.created",
    entityType: "patient_clinical_note",
    entityId: data.id,
    changes: { patient_id: patient.id, appointment_id: parsed.data.appointment_id ?? null },
  });

  revalidateClinicalNotePaths(patient.id);
  return { success: true };
}

export async function updateClinicalNote(noteId: string, formData: FormData): Promise<ClinicalNoteActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsed = clinicalNoteFormSchema.safeParse(clinicalNoteFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("patient_clinical_notes")
    .select("id, patient_id")
    .eq("id", noteId)
    .maybeSingle();

  if (existingError || !existing) {
    console.error("updateClinicalNote: note lookup failed", existingError);
    return { error: "Couldn't find this note." };
  }

  if (parsed.data.appointment_id) {
    const belongs = await appointmentBelongsToPatient(supabase, parsed.data.appointment_id, existing.patient_id);
    if (!belongs) {
      return {
        error: "That appointment doesn't belong to this patient.",
        fieldErrors: { appointment_id: "Invalid appointment" },
      };
    }
  }

  const { data, error } = await supabase
    .from("patient_clinical_notes")
    .update({ note: parsed.data.note, appointment_id: parsed.data.appointment_id ?? null })
    .eq("id", noteId)
    .select("id, clinic_id, patient_id")
    .maybeSingle();

  if (error || !data) {
    console.error("updateClinicalNote: update failed", error);
    return { error: "Couldn't update this note. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: data.clinic_id,
    actorId: staff.id,
    action: "clinical_note.updated",
    entityType: "patient_clinical_note",
    entityId: noteId,
    changes: { appointment_id: parsed.data.appointment_id ?? null },
  });

  revalidateClinicalNotePaths(data.patient_id);
  return { success: true };
}

/** Soft delete only — matches treatment_records' own convention. No hard-delete policy exists for authenticated on this table. */
export async function deleteClinicalNote(noteId: string): Promise<ClinicalNoteActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_clinical_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", noteId)
    .select("id, clinic_id, patient_id")
    .maybeSingle();

  if (error || !data) {
    console.error("deleteClinicalNote: update failed", error);
    return { error: "Couldn't remove this note. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: data.clinic_id,
    actorId: staff.id,
    action: "clinical_note.deleted",
    entityType: "patient_clinical_note",
    entityId: noteId,
  });

  revalidateClinicalNotePaths(data.patient_id);
  return { success: true };
}
