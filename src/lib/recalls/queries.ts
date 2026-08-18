import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppointmentStatus, RecallStatus } from "@/types/domain";

/** Shared select — every join a worklist row or a patient-scoped row needs, in one place so the two query functions below can't drift. */
const RECALL_SELECT =
  "id, patient_id, doctor_id, visit_type_id, appointment_id, reason, due_date, status, decided_at, notes, dismissed_reason, created_at, " +
  "patients ( full_name, patient_number ), " +
  "staff_profiles ( full_name ), " +
  "visit_types ( name ), " +
  "appointments ( scheduled_start, status )";

export interface RecallListRow {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_number: string;
  doctor_id: string | null;
  doctor_name: string | null;
  visit_type_id: string | null;
  procedure_name: string | null;
  appointment_id: string | null;
  appointment_scheduled_start: string | null;
  /** The linked appointment's *current* status, shown as context only — never used to change the recall's own status. See changeRecallStatus() / the "no auto-sync" rule. */
  appointment_status: AppointmentStatus | null;
  reason: string;
  due_date: string;
  status: RecallStatus;
  decided_at: string | null;
  notes: string | null;
  dismissed_reason: string | null;
  created_at: string;
}

interface RecallQueryRow {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_type_id: string | null;
  appointment_id: string | null;
  reason: string;
  due_date: string;
  status: RecallStatus;
  decided_at: string | null;
  notes: string | null;
  dismissed_reason: string | null;
  created_at: string;
  patients: { full_name: string; patient_number: string } | null;
  staff_profiles: { full_name: string } | null;
  visit_types: { name: string } | null;
  appointments: { scheduled_start: string; status: AppointmentStatus } | null;
}

function toRecallListRow(row: RecallQueryRow): RecallListRow {
  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.patients?.full_name ?? "—",
    patient_number: row.patients?.patient_number ?? "",
    doctor_id: row.doctor_id,
    doctor_name: row.staff_profiles?.full_name ?? null,
    visit_type_id: row.visit_type_id,
    procedure_name: row.visit_types?.name ?? null,
    appointment_id: row.appointment_id,
    appointment_scheduled_start: row.appointments?.scheduled_start ?? null,
    appointment_status: row.appointments?.status ?? null,
    reason: row.reason,
    due_date: row.due_date,
    status: row.status,
    decided_at: row.decided_at,
    notes: row.notes,
    dismissed_reason: row.dismissed_reason,
    created_at: row.created_at,
  };
}

export interface RecallSearchParams {
  status?: RecallStatus;
  doctorId?: string;
  /** Matched against `reason` — recalls' own text field, same convention searchInvoices() uses against invoice_number rather than a joined column. */
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface RecallSearchResult {
  rows: RecallListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Paginated, filterable cross-patient worklist for the /recalls page — due items sorted soonest-first, matching the recalls_status_due_date_idx composite index. */
export async function searchRecalls(params: RecallSearchParams = {}): Promise<RecallSearchResult> {
  const supabase = await createClient();
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("recalls")
    .select(RECALL_SELECT, { count: "exact" })
    .order("due_date", { ascending: true });

  if (params.status) query = query.eq("status", params.status);
  if (params.doctorId) query = query.eq("doctor_id", params.doctorId);
  if (params.query) query = query.ilike("reason", `%${params.query}%`);

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error("searchRecalls failed", error);
    return { rows: [], totalCount: 0, page, pageSize };
  }

  const rows = ((data ?? []) as unknown as RecallQueryRow[]).map(toRecallListRow);

  return { rows, totalCount: count ?? 0, page, pageSize };
}

/** Every recall for one patient, soonest due date first — for the Patient Profile Recalls tab, the summary rail, and the Patient Timeline. Unpaginated, same convention as getTreatmentPlansForPatient()/getAppointmentsForPatient(). */
export async function getRecallsForPatient(patientId: string): Promise<RecallListRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recalls")
    .select(RECALL_SELECT)
    .eq("patient_id", patientId)
    .order("due_date", { ascending: true });

  if (error) {
    console.error("getRecallsForPatient failed", error);
    return [];
  }

  return ((data ?? []) as unknown as RecallQueryRow[]).map(toRecallListRow);
}
