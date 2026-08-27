/**
 * Pure recall logic — no I/O, kept out of queries.ts/actions.ts (which have
 * `import "server-only"` for their real Supabase calls, and that guard
 * throws if this module is ever imported into a test file). Mirrors the
 * exact treatment-plans/calculations.ts, billing/calculations.ts split
 * already established in this codebase: date/status decisions are testable
 * against hand-built fixtures, independent of any live query.
 */

export type RecallStatusValue = "due" | "scheduled" | "completed" | "dismissed";

export interface OverdueCheckInput {
  status: string;
  /** YYYY-MM-DD, same shape as the `due_date` column. */
  due_date: string;
}

function todayDateString(today: Date): string {
  return today.toISOString().slice(0, 10);
}

/**
 * "Overdue" is deliberately not a stored status (see 0030_recalls.sql) —
 * it's derived here, at read time, from status = 'due' and a due_date in
 * the past. A recall that's already `scheduled`/`completed`/`dismissed` is
 * never overdue, regardless of its due_date: overdue only describes an
 * obligation nobody has acted on yet. `today` defaults to the real current
 * date for call sites, but is an explicit parameter so this stays testable
 * against a fixed date.
 */
export function isRecallOverdue(recall: OverdueCheckInput, today: Date = new Date()): boolean {
  if (recall.status !== "due") return false;
  return recall.due_date < todayDateString(today);
}

/**
 * Whether a recall can still transition status — true for the two
 * non-terminal states (due, scheduled), false once it's reached a terminal
 * one (completed, dismissed). Powers whether the Recall Status Actions
 * control renders as an editable Select or a plain badge, the same
 * "canChangeStatus" gate TreatmentPlanItemRow already applies to its own
 * status Select.
 */
export function isRecallActionable(status: string): boolean {
  return status === "due" || status === "scheduled";
}

/**
 * Hard delete is only ever offered for a recall nobody has acted on yet —
 * once it's scheduled/completed/dismissed it's a real record of what
 * happened (or was decided), not a mistake to erase. Same "delete only
 * while draft" shape treatment_plan_items already applies to itself,
 * enforced here in application code rather than in RLS (see 0030_recalls.sql).
 */
export function canDeleteRecall(status: string): boolean {
  return status === "due";
}

// ---------------------------------------------------------------------------
// Automatic recall generation (Batch 6) — hooked into createTreatmentRecord()
// (treatments/actions.ts), never into page rendering or a scheduler that
// doesn't exist. The interval comes from visit_types.recall_interval_months
// (0037_recall_automation.sql), configured per clinic per procedure; a
// service with no interval configured simply produces no recall.
// ---------------------------------------------------------------------------

/** Adds whole months to a date, returned as a YYYY-MM-DD string matching recalls.due_date's column type. Uses UTC date parts throughout so this is independent of the server's local timezone. */
export function computeRecallDueDate(treatmentDate: Date, intervalMonths: number): string {
  const due = new Date(Date.UTC(treatmentDate.getUTCFullYear(), treatmentDate.getUTCMonth(), treatmentDate.getUTCDate()));
  due.setUTCMonth(due.getUTCMonth() + intervalMonths);
  return due.toISOString().slice(0, 10);
}

export interface AutoRecallCandidate {
  treatmentRecordId: string;
  clinicId: string;
  patientId: string;
  doctorId: string | null;
  visitTypeId: string | null;
  appointmentId: string | null;
  /** The procedure's name at the moment of treatment — baked into `reason` at generation time so an old recall keeps describing what was actually done, even if the procedure is later renamed or its interval changed. */
  procedureName: string;
  /** visit_types.recall_interval_months as read at the moment the treatment was recorded — null means this procedure has no configured follow-up. */
  recallIntervalMonths: number | null;
  treatmentDate: Date;
  createdBy: string;
}

export interface AutoRecallInsert {
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_type_id: string | null;
  appointment_id: string | null;
  treatment_record_id: string;
  reason: string;
  due_date: string;
  created_by: string;
}

/**
 * The single decision point for "does this completed treatment produce a
 * recall" — returns null (do nothing) whenever the performed procedure has
 * no configured recall_interval_months, and otherwise returns exactly the
 * row to insert, with due_date computed once from the interval in effect at
 * treatment time. `treatment_record_id` is always set, which is what makes
 * the insert idempotent (see recalls_treatment_record_id_unique in
 * 0037_recall_automation.sql) — the caller inserts with "on conflict do
 * nothing" and never needs to duplicate this decision.
 */
export function buildAutoRecallInsert(candidate: AutoRecallCandidate): AutoRecallInsert | null {
  if (candidate.recallIntervalMonths == null) return null;

  return {
    clinic_id: candidate.clinicId,
    patient_id: candidate.patientId,
    doctor_id: candidate.doctorId,
    visit_type_id: candidate.visitTypeId,
    appointment_id: candidate.appointmentId,
    treatment_record_id: candidate.treatmentRecordId,
    reason: `Follow-up: ${candidate.procedureName}`,
    due_date: computeRecallDueDate(candidate.treatmentDate, candidate.recallIntervalMonths),
    created_by: candidate.createdBy,
  };
}
