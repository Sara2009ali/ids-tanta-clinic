import "server-only";

import { createClient } from "@/lib/supabase/server";
import { archForFdiNumber, dentitionForFdiNumber, fdiToPalmer, fdiToUniversal, isValidFdiNumber } from "@/lib/dental-chart/calculations";
import type { PatientToothEvent, ToothArch, ToothCondition, ToothDentition, ToothStatus } from "@/types/domain";

export interface DentalChartToothSummary {
  fdiNumber: number;
  status: ToothStatus;
  condition: ToothCondition | null;
  /** True when an accepted/in_progress Treatment Plan item targets this tooth — see isPlannedOnChart in calculations.ts. Read-only signal; nothing about a plan writes patient_tooth_state (see actions.ts). */
  hasPlanned: boolean;
}

/**
 * Every tooth this patient's chart actually has data for — teeth with no
 * row and no planned item simply aren't in the returned array; the
 * odontogram (which knows the full 52-tooth FDI set from calculations.ts)
 * renders everything else at its default "present, no condition" state.
 * Two queries total, run in parallel — no N+1.
 */
export async function getDentalChartForPatient(patientId: string): Promise<DentalChartToothSummary[]> {
  const supabase = await createClient();

  const [stateRes, planRes] = await Promise.all([
    supabase.from("patient_tooth_state").select("fdi_number, status, condition").eq("patient_id", patientId),
    supabase.from("treatment_plans").select("id").eq("patient_id", patientId).is("deleted_at", null),
  ]);

  if (stateRes.error) {
    console.error("getDentalChartForPatient: state lookup failed", stateRes.error);
  }
  if (planRes.error) {
    console.error("getDentalChartForPatient: plan lookup failed", planRes.error);
  }

  const planIds = (planRes.data ?? []).map((plan) => plan.id);

  let plannedToothIds = new Set<number>();
  if (planIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("treatment_plan_items")
      .select("tooth_id, status")
      .in("treatment_plan_id", planIds)
      .not("tooth_id", "is", null);

    if (itemsError) {
      console.error("getDentalChartForPatient: plan item lookup failed", itemsError);
    } else {
      plannedToothIds = new Set(
        (items ?? [])
          .filter((item) => item.status === "accepted" || item.status === "in_progress")
          .map((item) => item.tooth_id as number),
      );
    }
  }

  const summaries = new Map<number, DentalChartToothSummary>();
  for (const row of stateRes.data ?? []) {
    summaries.set(row.fdi_number, {
      fdiNumber: row.fdi_number,
      status: row.status as ToothStatus,
      condition: row.condition as ToothCondition | null,
      hasPlanned: plannedToothIds.has(row.fdi_number),
    });
  }
  for (const fdiNumber of plannedToothIds) {
    if (!summaries.has(fdiNumber)) {
      summaries.set(fdiNumber, { fdiNumber, status: "present", condition: null, hasPlanned: true });
    }
  }

  return Array.from(summaries.values());
}

/** Every tooth event for a patient, most recent first — for PatientTimeline's whole-patient feed (the Tooth Sheet uses getToothDetail's tooth-scoped events instead). */
export async function getToothEventsForPatient(patientId: string): Promise<PatientToothEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_tooth_events")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getToothEventsForPatient failed", error);
    return [];
  }
  return data ?? [];
}

export interface ToothPlannedItem {
  id: string;
  planId: string;
  planTitle: string | null;
  procedureName: string;
  status: string;
  priority: string;
  toothReference: string | null;
  appointmentScheduledStart: string | null;
}

export interface ToothPerformedRecord {
  id: string;
  procedureName: string;
  performedAt: string;
  doctorName: string | null;
  appointmentId: string;
}

export interface ToothDetail {
  fdiNumber: number;
  dentition: ToothDentition;
  arch: ToothArch;
  universalLabel: string | null;
  palmerLabel: string | null;
  state: { status: ToothStatus; condition: ToothCondition | null; notes: string | null; updatedAt: string } | null;
  events: PatientToothEvent[];
  plannedItems: ToothPlannedItem[];
  performedRecords: ToothPerformedRecord[];
}

interface TreatmentPlanItemQueryRow {
  id: string;
  treatment_plan_id: string;
  procedure_name: string;
  status: string;
  priority: string;
  tooth_reference: string | null;
  appointments: { scheduled_start: string } | null;
}

interface TreatmentRecordQueryRow {
  id: string;
  created_at: string;
  appointment_id: string;
  visit_types: { name: string } | null;
  staff_profiles: { full_name: string } | null;
}

/**
 * Everything the Tooth Sheet needs, for one tooth: current state, its
 * append-only history, every planned item that targets it (scoped through
 * this patient's own plans — treatment_plan_items has no patient_id column
 * of its own), and every performed record that targets it. Four queries,
 * one of which (plan items) depends on the patient's plan ids resolved just
 * before it — not a per-row N+1, the same shape getTreatmentPlanDetail
 * already uses for its own performed-treatment lookup.
 */
export async function getToothDetail(patientId: string, fdiNumber: number): Promise<ToothDetail | null> {
  if (!isValidFdiNumber(fdiNumber)) return null;

  const supabase = await createClient();

  const [stateRes, eventsRes, plansRes, recordsRes] = await Promise.all([
    supabase
      .from("patient_tooth_state")
      .select("status, condition, notes, updated_at")
      .eq("patient_id", patientId)
      .eq("fdi_number", fdiNumber)
      .maybeSingle(),
    supabase
      .from("patient_tooth_events")
      .select("*")
      .eq("patient_id", patientId)
      .eq("fdi_number", fdiNumber)
      .order("created_at", { ascending: false }),
    supabase.from("treatment_plans").select("id, title").eq("patient_id", patientId).is("deleted_at", null),
    supabase
      .from("treatment_records")
      .select("id, created_at, appointment_id, visit_types ( name ), staff_profiles ( full_name )")
      .eq("patient_id", patientId)
      .eq("tooth_id", fdiNumber)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (stateRes.error) console.error("getToothDetail: state lookup failed", stateRes.error);
  if (eventsRes.error) console.error("getToothDetail: events lookup failed", eventsRes.error);
  if (plansRes.error) console.error("getToothDetail: plans lookup failed", plansRes.error);
  if (recordsRes.error) console.error("getToothDetail: records lookup failed", recordsRes.error);

  const plansById = new Map((plansRes.data ?? []).map((plan) => [plan.id, plan.title]));
  const planIds = Array.from(plansById.keys());

  let plannedItems: ToothPlannedItem[] = [];
  if (planIds.length > 0) {
    const { data: itemRows, error: itemsError } = await supabase
      .from("treatment_plan_items")
      .select("id, treatment_plan_id, procedure_name, status, priority, tooth_reference, appointments ( scheduled_start )")
      .eq("tooth_id", fdiNumber)
      .in("treatment_plan_id", planIds)
      .order("sequence", { ascending: true });

    if (itemsError) {
      console.error("getToothDetail: plan item lookup failed", itemsError);
    } else {
      plannedItems = ((itemRows ?? []) as unknown as TreatmentPlanItemQueryRow[]).map((row) => ({
        id: row.id,
        planId: row.treatment_plan_id,
        planTitle: plansById.get(row.treatment_plan_id) ?? null,
        procedureName: row.procedure_name,
        status: row.status,
        priority: row.priority,
        toothReference: row.tooth_reference,
        appointmentScheduledStart: row.appointments?.scheduled_start ?? null,
      }));
    }
  }

  const performedRecords: ToothPerformedRecord[] = ((recordsRes.data ?? []) as unknown as TreatmentRecordQueryRow[]).map(
    (row) => ({
      id: row.id,
      procedureName: row.visit_types?.name ?? "Procedure",
      performedAt: row.created_at,
      doctorName: row.staff_profiles?.full_name ?? null,
      appointmentId: row.appointment_id,
    }),
  );

  return {
    fdiNumber,
    dentition: dentitionForFdiNumber(fdiNumber),
    arch: archForFdiNumber(fdiNumber),
    universalLabel: fdiToUniversal(fdiNumber),
    palmerLabel: fdiToPalmer(fdiNumber),
    state: stateRes.data
      ? {
          status: stateRes.data.status as ToothStatus,
          condition: stateRes.data.condition as ToothCondition | null,
          notes: stateRes.data.notes,
          updatedAt: stateRes.data.updated_at,
        }
      : null,
    events: eventsRes.data ?? [],
    plannedItems,
    performedRecords,
  };
}
