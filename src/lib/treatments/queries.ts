import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TreatmentRecord } from "@/types/domain";

/** A single appointment's treatment records, most recent first — for the appointment Sheet's Treatment tab. */
export async function getTreatmentRecordsForAppointment(appointmentId: string): Promise<TreatmentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_records")
    .select("*")
    .eq("appointment_id", appointmentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTreatmentRecordsForAppointment failed", error);
    return [];
  }
  return data ?? [];
}

/**
 * Every appointment in `appointmentIds`, in one round trip — for the
 * Reception Workspace, which renders many rows and would otherwise need one
 * query per row. Grouped by appointment_id so callers can slice per-row,
 * same shape doctor-attribution maps already use in Reports (getDoctor
 * Collections' invoiceId -> doctorId map).
 */
export async function getTreatmentRecordsForAppointments(
  appointmentIds: string[],
): Promise<Map<string, TreatmentRecord[]>> {
  const grouped = new Map<string, TreatmentRecord[]>();
  if (appointmentIds.length === 0) return grouped;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_records")
    .select("*")
    .in("appointment_id", appointmentIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTreatmentRecordsForAppointments failed", error);
    return grouped;
  }

  for (const record of data ?? []) {
    const existing = grouped.get(record.appointment_id) ?? [];
    existing.push(record);
    grouped.set(record.appointment_id, existing);
  }
  return grouped;
}

/** A patient's full treatment history across every appointment, most recent first — for Patient Profile's Clinical Notes tab. */
export async function getTreatmentRecordsForPatient(patientId: string): Promise<TreatmentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_records")
    .select("*")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getTreatmentRecordsForPatient failed", error);
    return [];
  }
  return data ?? [];
}
