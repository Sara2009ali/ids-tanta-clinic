import "server-only";

import { createClient } from "@/lib/supabase/server";
import { rangeToTimestampBounds, type ReportDateRange } from "@/lib/reports/date-range";
import {
  aggregateCountByDoctor,
  aggregateProcedureActivity,
  averageDaysBetween,
  computeCompletionRate,
  countByStatus,
  partitionFulfillment,
  type DoctorCount,
  type ProcedureActivityCount,
} from "@/lib/reports/calculations";
import { computeEstimatedTotal, groupPerformedTreatmentRecordsByItem } from "@/lib/treatment-plans/calculations";
import { isRecallOverdue } from "@/lib/recalls/calculations";

/**
 * Advanced Clinical Reports data layer — Treatment Plan Conversion,
 * Planned vs Performed, Procedure Activity, Clinical Workload, and Recall
 * Performance. Follows the exact convention reports/queries.ts already
 * established: "fetch rows in range, reduce in JS," no RPC, no new RLS
 * pattern (clinic scoping comes from RLS the same way every other reports
 * query already relies on it — clinic_id is never filtered manually here).
 *
 * Status is never treated as historical: every status-breakdown metric
 * below describes the *current* status of rows created or decided within
 * the selected range, never "status as of the end of the range" — none of
 * treatment_plans/treatment_plan_items/recalls keep status history. See
 * each exported function's own comment for its exact anchor rule.
 */

// ---------------------------------------------------------------------------
// Treatment Plan Conversion.
// ---------------------------------------------------------------------------

export interface PlanConversionSummary {
  plansCreated: number;
  /** Current status of plans created in range — draft/active/completed/abandoned. */
  plansByStatus: Record<string, number>;
  /** Current status of items, anchored per-status: accepted/postponed/rejected use decided_at (a decision was made); planned/in_progress/completed use created_at (no decision timestamp exists for those — decided_at is only ever set by the accept/postpone/reject transition). */
  itemsByStatus: Record<string, number>;
  /** Average decided_at - created_at, in days, across items decided in range. Null when nothing was decided. There is no reliable completion timestamp, so this never attempts a decision -> completion figure. */
  averageDaysToDecision: number | null;
}

const ITEM_DECISION_STATUSES = ["accepted", "postponed", "rejected"];
const ITEM_CREATION_ANCHORED_STATUSES = ["planned", "in_progress", "completed"];

export async function getPlanConversionSummary(range: ReportDateRange): Promise<PlanConversionSummary> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const [plansRes, decidedItemsRes, createdItemsRes] = await Promise.all([
    supabase
      .from("treatment_plans")
      .select("status")
      .is("deleted_at", null)
      .gte("created_at", startIso)
      .lt("created_at", endIsoExclusive),
    supabase
      .from("treatment_plan_items")
      .select("status, created_at, decided_at")
      .in("status", ITEM_DECISION_STATUSES)
      .not("decided_at", "is", null)
      .gte("decided_at", startIso)
      .lt("decided_at", endIsoExclusive),
    supabase
      .from("treatment_plan_items")
      .select("status")
      .in("status", ITEM_CREATION_ANCHORED_STATUSES)
      .gte("created_at", startIso)
      .lt("created_at", endIsoExclusive),
  ]);

  if (plansRes.error) console.error("getPlanConversionSummary: plans lookup failed", plansRes.error);
  if (decidedItemsRes.error) console.error("getPlanConversionSummary: decided items lookup failed", decidedItemsRes.error);
  if (createdItemsRes.error) console.error("getPlanConversionSummary: created items lookup failed", createdItemsRes.error);

  const plans = plansRes.data ?? [];
  const decidedItems = decidedItemsRes.data ?? [];
  const createdItems = createdItemsRes.data ?? [];

  return {
    plansCreated: plans.length,
    plansByStatus: countByStatus(plans),
    itemsByStatus: countByStatus([...decidedItems, ...createdItems]),
    averageDaysToDecision: averageDaysBetween(
      decidedItems.map((item) => ({ from: item.created_at, to: item.decided_at as string })),
    ),
  };
}

// ---------------------------------------------------------------------------
// Planned vs Performed.
// ---------------------------------------------------------------------------

export interface PlannedVsPerformedSummary {
  /** Distinct plan items with >=1 linked treatment record — never a record count. */
  fulfilledCount: number;
  /** Distinct plan items with zero linked treatment records, excluding rejected — a declined item is not remaining work. */
  unfulfilledCount: number;
  /** estimated_price x quantity summed over the unfulfilled set only. A clinical estimate, never billed — see the report page's own "Not billed" labeling. */
  unfulfilledEstimatedValue: number;
  /** treatment_records with no treatment_plan_item_id, anchored on the record's own created_at — reported separately, never merged into planned totals. */
  adHocPerformedCount: number;
}

/** Items are scoped to those *created* in range (per the approved created_at anchor for item-creation metrics) — fulfillment is then checked with no date restriction on the treatment_records side, since the question is "of what was proposed in this window, has it since been done," not "was it done in this exact window." */
export async function getPlannedVsPerformedSummary(range: ReportDateRange): Promise<PlannedVsPerformedSummary> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const { data: itemRows, error: itemsError } = await supabase
    .from("treatment_plan_items")
    .select("id, status, estimated_price, quantity")
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive);

  if (itemsError) {
    console.error("getPlannedVsPerformedSummary: item lookup failed", itemsError);
    return { fulfilledCount: 0, unfulfilledCount: 0, unfulfilledEstimatedValue: 0, adHocPerformedCount: 0 };
  }

  const items = itemRows ?? [];
  const itemIds = items.map((item) => item.id);

  let performedByItem = new Map<string, { treatmentRecordId: string; performedAt: string }[]>();
  if (itemIds.length > 0) {
    const { data: performedRows, error: performedError } = await supabase
      .from("treatment_records")
      .select("id, treatment_plan_item_id, created_at")
      .in("treatment_plan_item_id", itemIds)
      .is("deleted_at", null);

    if (performedError) {
      console.error("getPlannedVsPerformedSummary: performed-treatment lookup failed", performedError);
    } else {
      performedByItem = groupPerformedTreatmentRecordsByItem(performedRows ?? []);
    }
  }

  const { fulfilled, unfulfilled } = partitionFulfillment(items, performedByItem);

  const { count: adHocCount, error: adHocError } = await supabase
    .from("treatment_records")
    .select("*", { count: "exact", head: true })
    .is("treatment_plan_item_id", null)
    .is("deleted_at", null)
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive);

  if (adHocError) console.error("getPlannedVsPerformedSummary: ad-hoc lookup failed", adHocError);

  return {
    fulfilledCount: fulfilled.length,
    unfulfilledCount: unfulfilled.length,
    unfulfilledEstimatedValue: computeEstimatedTotal(unfulfilled),
    adHocPerformedCount: adHocCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Procedure Activity — treatment_records counted directly, never joined
// through appointments (an appointment can carry zero, one, or many
// records; joining through it would either drop or multiply rows).
// ---------------------------------------------------------------------------

export interface ProcedureActivitySummary {
  totalCount: number;
  byProcedure: ProcedureActivityCount[];
  /** Reused as-is by Clinical Workload's "treatment records performed per doctor" — same rows, same range, same optional doctor filter, so the page composes both sections from this one fetch instead of querying twice. */
  byDoctor: DoctorCount[];
}

export async function getProcedureActivitySummary(range: ReportDateRange, doctorId?: string): Promise<ProcedureActivitySummary> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  let query = supabase
    .from("treatment_records")
    .select("visit_type_id, doctor_id")
    .is("deleted_at", null)
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive);

  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query;

  if (error) {
    console.error("getProcedureActivitySummary failed", error);
    return { totalCount: 0, byProcedure: [], byDoctor: [] };
  }

  const rows = data ?? [];
  return {
    totalCount: rows.length,
    byProcedure: aggregateProcedureActivity(rows.map((row) => ({ visitTypeId: row.visit_type_id }))),
    byDoctor: aggregateCountByDoctor(rows.map((row) => ({ doctorId: row.doctor_id }))),
  };
}

// ---------------------------------------------------------------------------
// Clinical Workload — counts only, no revenue/production/collections.
// ---------------------------------------------------------------------------

/** appointments.doctor_id is NOT NULL (0008_appointments.sql), so every row attributes cleanly — no null-doctor group possible here, unlike treatment_records/recalls. */
export async function getCompletedAppointmentsByDoctor(range: ReportDateRange, doctorId?: string): Promise<DoctorCount[]> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  let query = supabase
    .from("appointments")
    .select("doctor_id")
    .is("deleted_at", null)
    .eq("status", "completed")
    .gte("scheduled_start", startIso)
    .lt("scheduled_start", endIsoExclusive);

  if (doctorId) query = query.eq("doctor_id", doctorId);

  const { data, error } = await query;

  if (error) {
    console.error("getCompletedAppointmentsByDoctor failed", error);
    return [];
  }

  return aggregateCountByDoctor((data ?? []).map((row) => ({ doctorId: row.doctor_id })));
}

// ---------------------------------------------------------------------------
// Recall Performance. Status is always read from recalls.status directly —
// never derived from a linked appointment's status (recall/appointment
// status are independent by design, see 0030_recalls.sql).
// ---------------------------------------------------------------------------

export interface RecallPerformanceSummary {
  /** Current status of recalls created/decided in range — due uses created_at (recalls.decided_at is only ever set once status leaves 'due'); scheduled/completed/dismissed use decided_at. */
  statusCounts: Record<string, number>;
  completedCount: number;
  dismissedCount: number;
  /** completed / (completed + dismissed) among recalls decided in range — open (due/scheduled) recalls are excluded from the denominator entirely. Null when nothing was decided. */
  completionRate: number | null;
  /** status = 'due' and due_date < today, evaluated against today regardless of the selected report range — the same "as of now, not as of range-end" rule Recall overdue always follows. Optionally scoped by doctorId. */
  overdueCount: number;
  /** Average (today - due_date) in days across the overdue set above. Null when nothing is overdue. */
  averageDaysOverdue: number | null;
}

const RECALL_DECIDED_STATUSES = ["scheduled", "completed", "dismissed"];

export async function getRecallPerformanceSummary(range: ReportDateRange, doctorId?: string): Promise<RecallPerformanceSummary> {
  const supabase = await createClient();
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  let dueCreatedQuery = supabase
    .from("recalls")
    .select("status")
    .eq("status", "due")
    .gte("created_at", startIso)
    .lt("created_at", endIsoExclusive);
  let decidedQuery = supabase
    .from("recalls")
    .select("status")
    .in("status", RECALL_DECIDED_STATUSES)
    .not("decided_at", "is", null)
    .gte("decided_at", startIso)
    .lt("decided_at", endIsoExclusive);
  let overdueQuery = supabase.from("recalls").select("due_date").eq("status", "due");

  if (doctorId) {
    dueCreatedQuery = dueCreatedQuery.eq("doctor_id", doctorId);
    decidedQuery = decidedQuery.eq("doctor_id", doctorId);
    overdueQuery = overdueQuery.eq("doctor_id", doctorId);
  }

  const [dueCreatedRes, decidedRes, overdueRes] = await Promise.all([dueCreatedQuery, decidedQuery, overdueQuery]);

  if (dueCreatedRes.error) console.error("getRecallPerformanceSummary: due lookup failed", dueCreatedRes.error);
  if (decidedRes.error) console.error("getRecallPerformanceSummary: decided lookup failed", decidedRes.error);
  if (overdueRes.error) console.error("getRecallPerformanceSummary: overdue lookup failed", overdueRes.error);

  const statusCounts = countByStatus([...(dueCreatedRes.data ?? []), ...(decidedRes.data ?? [])]);
  const completedCount = statusCounts.completed ?? 0;
  const dismissedCount = statusCounts.dismissed ?? 0;

  const today = new Date();
  const overdueRows = (overdueRes.data ?? []).filter((row) => isRecallOverdue({ status: "due", due_date: row.due_date }, today));

  return {
    statusCounts,
    completedCount,
    dismissedCount,
    completionRate: computeCompletionRate(completedCount, dismissedCount),
    overdueCount: overdueRows.length,
    averageDaysOverdue: averageDaysBetween(overdueRows.map((row) => ({ from: row.due_date, to: today.toISOString() }))),
  };
}
