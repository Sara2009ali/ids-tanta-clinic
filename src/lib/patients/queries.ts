import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PatientSearchRow, PatientStatus } from "@/types/domain";

export interface PatientSearchParams {
  query?: string;
  gender?: string;
  status?: PatientStatus;
  doctorId?: string;
  sortBy?: "name" | "last_visit_at" | "status" | "created_at";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PatientSearchResult {
  rows: PatientSearchRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Backs the patient list: search + filters + sort + pagination in one round trip. */
export async function searchPatients(params: PatientSearchParams = {}): Promise<PatientSearchResult> {
  const supabase = await createClient();
  const page = Math.max(params.page ?? 1, 1);
  const pageSize = params.pageSize ?? 20;

  const { data, error } = await supabase.rpc("search_patients", {
    p_query: params.query || undefined,
    p_gender: params.gender || undefined,
    p_status: params.status || undefined,
    p_doctor_id: params.doctorId || undefined,
    p_sort_by: params.sortBy ?? "created_at",
    p_sort_dir: params.sortDir ?? "desc",
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    console.error("searchPatients failed", error);
    return { rows: [], totalCount: 0, page, pageSize };
  }

  const rows = (data ?? []) as PatientSearchRow[];
  const totalCount = rows[0]?.total_count ?? 0;
  return { rows, totalCount, page, pageSize };
}

export async function getPatientById(id: string) {
  const supabase = await createClient();

  const [patientRes, clinicalInfoRes, alertsRes, filesRes, auditRes] = await Promise.all([
    supabase.from("patients").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("patient_clinical_info").select("*").eq("patient_id", id).maybeSingle(),
    supabase
      .from("patient_medical_alerts")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("patient_files").select("*").eq("patient_id", id).order("uploaded_at", { ascending: false }),
    supabase
      .from("audit_log")
      .select("*")
      .eq("entity_type", "patient")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!patientRes.data) return null;

  return {
    patient: patientRes.data,
    clinicalInfo: clinicalInfoRes.data,
    alerts: alertsRes.data ?? [],
    files: filesRes.data ?? [],
    auditEntries: auditRes.data ?? [],
  };
}

export interface DoctorOption {
  id: string;
  full_name: string;
}

/** Doctors selectable as a patient's preferred dentist. */
export async function listDoctors(): Promise<DoctorOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff_profiles")
    .select("id, full_name")
    .eq("role", "doctor")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");

  return data ?? [];
}

/** Checks whether an active (non-deleted) patient already has this phone number in the clinic. */
export async function findPatientByPhone(clinicId: string, phone: string, excludePatientId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", clinicId)
    .eq("phone", phone)
    .is("deleted_at", null);

  if (excludePatientId) {
    query = query.neq("id", excludePatientId);
  }

  const { data } = await query.maybeSingle();
  return data;
}
