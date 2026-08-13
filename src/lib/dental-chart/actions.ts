"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  fdiNumberSchema,
  toothStateFormSchema,
  toothStateFormValuesFromFormData,
  toothObservationFormSchema,
  toothObservationFormValuesFromFormData,
} from "@/lib/dental-chart/schema";
import { isAppointmentForPatient } from "@/lib/dental-chart/calculations";
import { getToothDetail, type ToothDetail } from "@/lib/dental-chart/queries";
import type { Database } from "@/types/database.generated";
import type { StaffProfile } from "@/types/domain";

export interface ToothActionState {
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

/** No dedicated Dental Chart route in v1 (per the approved UX) — the odontogram lives directly in the Patient Profile tab, so a single path covers every write. */
function revalidateDentalChartPaths(patientId: string) {
  revalidatePath(`/patients/${patientId}`);
}

/** Same defense-in-depth shape as appointmentBelongsToPatient() in treatment-plans/actions.ts. */
async function appointmentBelongsToPatient(
  supabase: SupabaseClient<Database>,
  appointmentId: string,
  patientId: string,
): Promise<boolean> {
  const { data } = await supabase.from("appointments").select("patient_id").eq("id", appointmentId).maybeSingle();
  return isAppointmentForPatient(data, patientId);
}

/** clinic_id is derived from the patient row, never trusted from the client or from staff.clinic_id (nullable for super_admin) — same reasoning every other clinical action in this codebase applies. Returns null (with the caller responsible for the error response) rather than throwing. */
async function loadPatientForClinicalWrite(
  supabase: SupabaseClient<Database>,
  patientId: string,
): Promise<{ id: string; clinic_id: string } | null> {
  const { data, error } = await supabase.from("patients").select("id, clinic_id").eq("id", patientId).maybeSingle();
  if (error || !data) {
    console.error("dental-chart action: patient lookup failed", error);
    return null;
  }
  return data;
}

interface ToothStateChange {
  status: string;
  condition: string | null;
  notes: string | null;
}

/**
 * Shared upsert-and-diff core for every write to patient_tooth_state — the
 * one-row-per-parent upsert pattern patient_clinical_info already uses
 * (onConflict on the table's unique constraint), plus the append-only event
 * this table's history model requires: a patient_tooth_events row is only
 * written when status or condition actually changed (a notes-only edit
 * doesn't add a second copy of the same fact to the event log). Every event
 * here is staff-initiated — nothing calls this from a treatment-record write
 * (see 0029_dental_chart.sql's header comment on why automated
 * classification is out of scope for v1).
 */
async function applyToothStateChange(
  supabase: SupabaseClient<Database>,
  staff: StaffProfile,
  patient: { id: string; clinic_id: string },
  fdiNumber: number,
  next: ToothStateChange,
): Promise<{ error: string } | { error?: undefined }> {
  const { data: existing, error: existingError } = await supabase
    .from("patient_tooth_state")
    .select("status, condition")
    .eq("patient_id", patient.id)
    .eq("fdi_number", fdiNumber)
    .maybeSingle();

  if (existingError) {
    console.error("applyToothStateChange: existing-state lookup failed", existingError);
    return { error: "Couldn't load this tooth's current state." };
  }

  const previousStatus = existing?.status ?? "present";
  const previousCondition = existing?.condition ?? null;
  const changed = previousStatus !== next.status || previousCondition !== next.condition;

  const { data: row, error } = await supabase
    .from("patient_tooth_state")
    .upsert(
      {
        patient_id: patient.id,
        clinic_id: patient.clinic_id,
        fdi_number: fdiNumber,
        status: next.status,
        condition: next.condition,
        notes: next.notes,
        updated_by: staff.id,
      },
      { onConflict: "patient_id,fdi_number" },
    )
    .select("id")
    .single();

  if (error || !row) {
    console.error("applyToothStateChange: upsert failed", error);
    return { error: "Couldn't update this tooth. Please try again." };
  }

  if (changed) {
    const { error: eventError } = await supabase.from("patient_tooth_events").insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      fdi_number: fdiNumber,
      event_type: "state_changed",
      previous_status: previousStatus,
      previous_condition: previousCondition,
      status: next.status,
      condition: next.condition,
      notes: next.notes,
      recorded_by: staff.id,
    });
    if (eventError) {
      console.error("applyToothStateChange: event insert failed", eventError);
    }
  }

  await writeAuditLog(supabase, {
    clinicId: patient.clinic_id,
    actorId: staff.id,
    action: "tooth_state.updated",
    entityType: "patient_tooth_state",
    entityId: row.id,
    changes: {
      fdi_number: fdiNumber,
      from: { status: previousStatus, condition: previousCondition },
      to: { status: next.status, condition: next.condition },
    },
  });

  return {};
}

/** The "add/edit condition" Dialog's submit handler — full form (status + condition + notes). */
export async function updateToothState(
  patientId: string,
  fdiNumber: number,
  formData: FormData,
): Promise<ToothActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsedFdi = fdiNumberSchema.safeParse(fdiNumber);
  if (!parsedFdi.success) {
    return { error: "That's not a valid tooth." };
  }

  const parsed = toothStateFormSchema.safeParse(toothStateFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const patient = await loadPatientForClinicalWrite(supabase, patientId);
  if (!patient) return { error: "Couldn't find this patient." };

  const result = await applyToothStateChange(supabase, staff, patient, parsedFdi.data, {
    status: parsed.data.status,
    condition: parsed.data.condition,
    notes: parsed.data.notes ?? null,
  });
  if (result.error) return { error: result.error };

  revalidateDentalChartPaths(patient.id);
  return { success: true };
}

/**
 * The odontogram's inline "mark missing" quick action — a single-field
 * status change with no Dialog, same plain-argument shape as
 * changeTreatmentPlanItemStatus() in treatment-plans/actions.ts. Condition
 * and notes are left exactly as they already were; this only ever touches
 * status.
 */
export async function setToothStatus(
  patientId: string,
  fdiNumber: number,
  status: string,
): Promise<ToothActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsedFdi = fdiNumberSchema.safeParse(fdiNumber);
  if (!parsedFdi.success) {
    return { error: "That's not a valid tooth." };
  }

  const supabase = await createClient();
  const patient = await loadPatientForClinicalWrite(supabase, patientId);
  if (!patient) return { error: "Couldn't find this patient." };

  const { data: existing, error: existingError } = await supabase
    .from("patient_tooth_state")
    .select("status, condition, notes")
    .eq("patient_id", patient.id)
    .eq("fdi_number", parsedFdi.data)
    .maybeSingle();

  if (existingError) {
    console.error("setToothStatus: existing-state lookup failed", existingError);
    return { error: "Couldn't load this tooth's current state." };
  }

  const result = await applyToothStateChange(supabase, staff, patient, parsedFdi.data, {
    status,
    condition: existing?.condition ?? null,
    notes: existing?.notes ?? null,
  });
  if (result.error) return { error: result.error };

  revalidateDentalChartPaths(patient.id);
  return { success: true };
}

/**
 * Read-only server action wrapping getToothDetail() (queries.ts) — the
 * Tooth Sheet is a Client Component (it owns open/selection state), and
 * queries.ts is `server-only`, so it can't be imported there directly. This
 * is the one on-demand fetch point per selected tooth, gated on
 * clinical.view exactly like every other clinical read in this app; it does
 * not duplicate getToothDetail's logic, only exposes it across the
 * client/server boundary.
 */
export async function loadToothDetail(patientId: string, fdiNumber: number): Promise<ToothDetail | null> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_VIEW);
  if (!authz.ok) return null;
  return getToothDetail(patientId, fdiNumber);
}

/** A plain clinical observation on a tooth — never itself changes patient_tooth_state (event_type: "observation"), per the approved event model. */
export async function createToothObservation(
  patientId: string,
  fdiNumber: number,
  formData: FormData,
): Promise<ToothActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;

  const parsedFdi = fdiNumberSchema.safeParse(fdiNumber);
  if (!parsedFdi.success) {
    return { error: "That's not a valid tooth." };
  }

  const parsed = toothObservationFormSchema.safeParse(toothObservationFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const patient = await loadPatientForClinicalWrite(supabase, patientId);
  if (!patient) return { error: "Couldn't find this patient." };

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
    .from("patient_tooth_events")
    .insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      fdi_number: parsedFdi.data,
      event_type: "observation",
      notes: parsed.data.notes,
      appointment_id: parsed.data.appointment_id ?? null,
      recorded_by: staff.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createToothObservation: insert failed", error);
    return { error: "Couldn't add this observation. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: patient.clinic_id,
    actorId: staff.id,
    action: "tooth_event.created",
    entityType: "patient_tooth_event",
    entityId: data.id,
    changes: { fdi_number: parsedFdi.data },
  });

  revalidateDentalChartPaths(patient.id);
  return { success: true };
}
