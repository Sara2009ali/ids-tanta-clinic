/**
 * Pure treatment-plan logic — no I/O, deliberately kept out of queries.ts/
 * actions.ts (which have `import "server-only"` for their real Supabase
 * calls, and that guard throws if the module is ever imported into a test
 * file). Mirrors the exact billing/calculations.ts, compensation/
 * calculations.ts, reports/calculations.ts split already established in
 * this codebase, for the same reason: the decision logic is testable
 * against hand-built fixtures even though this repo has no local Postgres
 * test harness to exercise the real queries/RLS against.
 *
 * `InvoiceItemInputValues` below is the one type-only import from
 * lib/billing — it's erased at compile time, so it doesn't pull any billing
 * I/O into this module or make Treatment Plans depend on Billing at
 * runtime. It exists purely so the Treatment-Plan-to-invoice-line mapping
 * this file produces is guaranteed to match what InvoiceFormSheet actually
 * accepts, instead of a hand-duplicated shape that could silently drift.
 */

import type { InvoiceItemInputValues } from "@/lib/billing/schema";

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
  acceptedCount: number;
  completedCount: number;
  acceptedPercent: number;
  completedPercent: number;
}

/** Powers both the Patient Profile Treatment Plans tab's compact summary ("3 procedures · 2 accepted · 1 completed") and the plan detail header's progress bar — a plan with zero items reports all-zero rather than NaN. */
export function computeItemProgress(items: readonly ItemProgressInput[]): ItemProgress {
  const totalCount = items.length;
  if (totalCount === 0) {
    return { totalCount: 0, acceptedCount: 0, completedCount: 0, acceptedPercent: 0, completedPercent: 0 };
  }

  const acceptedCount = items.filter((item) =>
    item.status === "accepted" || item.status === "in_progress" || item.status === "completed",
  ).length;
  const completedCount = items.filter((item) => item.status === "completed").length;

  return {
    totalCount,
    acceptedCount,
    completedCount,
    acceptedPercent: Math.round((acceptedCount / totalCount) * 100),
    completedPercent: Math.round((completedCount / totalCount) * 100),
  };
}

export interface EstimatedTotalInput {
  estimated_price: number | string;
  quantity: number | string;
}

/** Sum of estimated_price × quantity across a plan's items — "what is the estimated value of the plan," derived from existing item fields, never a stored column. Postgres numeric columns arrive as strings over the wire, so both inputs are coerced with Number(). */
export function computeEstimatedTotal(items: readonly EstimatedTotalInput[]): number {
  return items.reduce((sum, item) => sum + Number(item.estimated_price) * Number(item.quantity), 0);
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

/**
 * Same appointment statuses AppointmentEditSheet's TREATMENT_ELIGIBLE set
 * already uses to gate TreatmentRecordForm ("recording treatment only makes
 * sense once the patient has actually been seen") — duplicated here as a
 * pure function rather than imported, since appointment-edit-sheet.tsx
 * doesn't export its local constant and this module can't depend on a
 * client component file. This is the same rule, not a second one: the exact
 * same four statuses, gating the exact same real-world action, just reached
 * from a second entry point (a Treatment Plan item instead of the
 * appointment Sheet).
 */
export function isAppointmentTreatmentEligible(status: string | null): boolean {
  return status === "checked_in" || status === "waiting" || status === "in_treatment" || status === "completed";
}

export interface RecordTreatmentSourceItem {
  visit_type_id: string | null;
}

/**
 * The Record Treatment dialog's starting procedure selection — prefilled
 * from the plan item's own catalog link when it has one (still freely
 * editable after, same "prefill once, never lock" convention as
 * ProcedurePicker/TreatmentRecordForm), or left blank for a custom plan
 * item, which has no catalog value to offer and forces the dentist to pick
 * one — a treatment_records row can never be "custom" (visit_type_id is a
 * required, on-delete-restrict column).
 */
export function initialRecordTreatmentVisitTypeId(item: RecordTreatmentSourceItem): string {
  return item.visit_type_id ?? "";
}

/**
 * A plan item is "custom" when the dentist typed the procedure name
 * freehand instead of picking a catalog entry (ProcedurePicker's "Custom
 * procedure" option — see treatment-plan-item-dialog.tsx). The Record
 * Treatment dialog must never let the catalog procedure the dentist
 * eventually selects silently stand in for this free-typed name — the two
 * remain distinct facts (what was planned vs. what was actually performed),
 * exactly as they already are in the data model (procedure_name lives on
 * treatment_plan_items, visit_type_id lives on treatment_records, and
 * neither is required to match the other).
 */
export function isCustomPlanItem(item: RecordTreatmentSourceItem): boolean {
  return item.visit_type_id === null;
}

/**
 * v1 billable statuses for the Treatment Plan -> Billing prefill workflow —
 * `accepted` and `completed` only. Deliberately excludes `planned`
 * (patient hasn't agreed to it yet), `postponed`/`rejected` (not happening,
 * at least not now), and `in_progress` (not yet a finished, chargeable
 * fact). `completed` stays eligible on purpose: clinical completion and
 * billing are two separate facts, and an already-billed `completed` item
 * has no flag anywhere to say so (see the duplicate-billing note on
 * treatmentPlanItemsToInvoiceItems below) — that's a known v1 limitation,
 * not something this function tries to guess around.
 */
export function isBillableTreatmentPlanItemStatus(status: string): boolean {
  return status === "accepted" || status === "completed";
}

export interface CatalogPriceLookup {
  id: string;
  price: number | string;
}

/**
 * The unit price an invoice line seeded from a plan item should start at.
 * Mirrors the same rule the existing appointment -> invoice flow already
 * applies (the appointment's *current* visit-type catalog price, not a
 * stored estimate) — kept consistent on purpose rather than introducing a
 * second pricing rule, per the approved design. `estimated_price` on the
 * plan item can go stale (the catalog price may have changed since the
 * item was proposed), so a catalog-linked item always prefers the live
 * catalog price when it can find one. A custom item (`visit_type_id`
 * null) has no catalog price to consult, so its own `estimated_price` is
 * the only available source — exactly as it already is for a manually
 * added custom invoice line in InvoiceFormSheet today.
 */
export function resolveTreatmentPlanItemUnitPrice(
  item: Pick<RecordTreatmentSourceItem, "visit_type_id"> & { estimated_price: number | string },
  catalog: readonly CatalogPriceLookup[],
): number {
  if (item.visit_type_id) {
    const match = catalog.find((entry) => entry.id === item.visit_type_id);
    if (match) return Number(match.price);
  }
  return Number(item.estimated_price);
}

export interface BillableTreatmentPlanItem {
  procedure_name: string;
  estimated_price: number | string;
  quantity: number | string;
  visit_type_id: string | null;
}

/**
 * One invoice line per selected plan item, in the exact shape
 * InvoiceFormSheet's `initialItems` expects. `discount_amount` always
 * starts at 0 — a plan item carries no discount concept of its own, and
 * the line stays fully editable in the sheet either way. This is a
 * one-time prefill: nothing here persists a link back to the plan item, by
 * design (see the Treatment Plan -> Billing boundary notes).
 */
export function treatmentPlanItemsToInvoiceItems(
  items: readonly BillableTreatmentPlanItem[],
  catalog: readonly CatalogPriceLookup[],
): InvoiceItemInputValues[] {
  return items.map((item) => ({
    description: item.procedure_name,
    quantity: Number(item.quantity),
    unit_price: resolveTreatmentPlanItemUnitPrice(item, catalog),
    discount_amount: 0,
    visit_type_id: item.visit_type_id,
  }));
}

export interface AppointmentLinkedItem {
  appointment_id: string | null;
}

/**
 * The invoice-level appointment_id to seed when creating an invoice from
 * multiple plan items at once — a Treatment Plan isn't necessarily tied to
 * one appointment, so this only narrows down an *existing* shared value,
 * it never invents one. Same appointment_id on every selected item -> that
 * id. Different appointment_ids, or no appointment on any of them -> null.
 * A single-item selection is just the size-1 case of the same rule.
 */
export function resolveInvoiceAppointmentId(items: readonly AppointmentLinkedItem[]): string | null {
  const distinctIds = new Set(items.map((item) => item.appointment_id));
  if (distinctIds.size !== 1) return null;
  const [only] = distinctIds;
  return only ?? null;
}
