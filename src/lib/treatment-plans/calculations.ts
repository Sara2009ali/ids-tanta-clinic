/**
 * Pure treatment-plan logic — no I/O, deliberately kept out of queries.ts/
 * actions.ts (which have `import "server-only"` for their real Supabase
 * calls, and that guard throws if the module is ever imported into a test
 * file). Mirrors the exact billing/calculations.ts, compensation/
 * calculations.ts, reports/calculations.ts split already established in
 * this codebase, for the same reason: the decision logic is testable
 * against hand-built fixtures even though this repo has no local Postgres
 * test harness to exercise the real queries/RLS against.
 */

export type TreatmentPlanStatus = "draft" | "active" | "completed" | "abandoned";

export type TreatmentPlanTransitionAction = "activate" | "complete" | "abandon";

/**
 * The only three plan-level transitions the product exposes, each gated on
 * an exact starting status — draft -> active (propose to patient), active ->
 * completed (dentist marks it done), active -> abandoned (patient/clinic
 * drops it). Every other combination (e.g. completing a draft, abandoning an
 * already-completed plan) is refused. Used by activateTreatmentPlan/
 * completeTreatmentPlan/abandonTreatmentPlan in actions.ts so the "don't
 * allow nonsensical actions based on current status" rule lives in one place
 * instead of three duplicated if-checks.
 */
export function canTransitionPlanStatus(
  current: TreatmentPlanStatus,
  action: TreatmentPlanTransitionAction,
): boolean {
  if (action === "activate") return current === "draft";
  if (action === "complete") return current === "active";
  if (action === "abandon") return current === "active";
  return false;
}

export interface ItemProgressInput {
  status: string;
}

export interface ItemProgress {
  totalCount: number;
  /** Items the patient has said yes to, at any stage — accepted, in_progress, or completed. */
  acceptedPercent: number;
  completedPercent: number;
}

/** Powers the Patient Profile Treatment Plans tab's compact "accepted % / completed %" indicators — a plan with zero items reports 0/0 rather than NaN. */
export function computeItemProgress(items: readonly ItemProgressInput[]): ItemProgress {
  const totalCount = items.length;
  if (totalCount === 0) {
    return { totalCount: 0, acceptedPercent: 0, completedPercent: 0 };
  }

  const acceptedCount = items.filter((item) =>
    item.status === "accepted" || item.status === "in_progress" || item.status === "completed",
  ).length;
  const completedCount = items.filter((item) => item.status === "completed").length;

  return {
    totalCount,
    acceptedPercent: Math.round((acceptedCount / totalCount) * 100),
    completedPercent: Math.round((completedCount / totalCount) * 100),
  };
}

export interface SequencedItem {
  sequence: number;
}

/** Ascending by `sequence` — the dentist-controlled treatment order. Stable for equal sequence values (rare, only from a lost reorder race — see the Discovery report's edge cases). */
export function orderItemsBySequence<T extends SequencedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sequence - b.sequence);
}

export interface SoftDeletable {
  deleted_at: string | null;
}

/** The same `is("deleted_at", null)` filter every query in this codebase applies, pulled out as a pure function so the exclusion logic is testable without a live database. */
export function excludeSoftDeleted<T extends SoftDeletable>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.deleted_at === null);
}

export interface PerformedTreatmentRecordRow {
  id: string;
  treatment_plan_item_id: string | null;
  created_at: string;
}

export interface PerformedTreatmentInfo {
  treatmentRecordId: string;
  performedAt: string;
}

/**
 * Groups active (non-soft-deleted) treatment_records by the plan item they
 * fulfill — "performed" is determined purely by this lookup, never a stored
 * flag, so it can never drift from the real treatment_records table
 * (0018_treatment_records.sql already filters `deleted_at is null` the same
 * way; this function assumes the caller already applied that filter, same
 * division of labor as excludeSoftDeleted above). Rows with a null
 * treatment_plan_item_id (ad-hoc treatment with no plan behind it) are
 * simply not included in the map — a treatment record with no plan item
 * remains valid and untouched by this grouping.
 */
export function groupPerformedTreatmentRecordsByItem(
  records: readonly PerformedTreatmentRecordRow[],
): Map<string, PerformedTreatmentInfo[]> {
  const grouped = new Map<string, PerformedTreatmentInfo[]>();
  for (const record of records) {
    if (!record.treatment_plan_item_id) continue;
    const existing = grouped.get(record.treatment_plan_item_id) ?? [];
    existing.push({ treatmentRecordId: record.id, performedAt: record.created_at });
    grouped.set(record.treatment_plan_item_id, existing);
  }
  return grouped;
}

export interface AppointmentPatientRow {
  patient_id: string;
}

/**
 * Pure comparison half of the "appointment belongs to this patient" guard —
 * the same defense-in-depth check createClinicalNote()/updateClinicalNote()
 * apply to patient_clinical_notes.appointment_id, split so the decision
 * logic is unit-testable independent of the Supabase lookup that fetches
 * `appointment`. A null `appointment` (id doesn't exist / RLS hid it) is
 * always treated as not belonging.
 */
export function isAppointmentForPatient(appointment: AppointmentPatientRow | null, patientId: string): boolean {
  return appointment?.patient_id === patientId;
}
