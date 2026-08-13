import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PatientClinicalNote } from "@/types/domain";

/** A clinical note with its author's name and its linked appointment's scheduled time already resolved — the shape the Patient Profile's Clinical Notes tab actually renders, so the query does the join once instead of the UI threading a separate staff/appointment list down as props. */
export interface ClinicalNoteWithContext extends PatientClinicalNote {
  authorName: string | null;
  appointmentScheduledStart: string | null;
}

interface ClinicalNoteQueryRow extends PatientClinicalNote {
  staff_profiles: { full_name: string } | null;
  appointments: { scheduled_start: string } | null;
}

/** A patient's clinical notes, most recent first — for Patient Profile's Clinical Notes tab. */
export async function getClinicalNotesForPatient(patientId: string): Promise<ClinicalNoteWithContext[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_clinical_notes")
    .select("*, staff_profiles ( full_name ), appointments ( scheduled_start )")
    .eq("patient_id", patientId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getClinicalNotesForPatient failed", error);
    return [];
  }

  return ((data ?? []) as unknown as ClinicalNoteQueryRow[]).map((row) => {
    const { staff_profiles, appointments, ...note } = row;
    return {
      ...note,
      authorName: staff_profiles?.full_name ?? null,
      appointmentScheduledStart: appointments?.scheduled_start ?? null,
    };
  });
}
