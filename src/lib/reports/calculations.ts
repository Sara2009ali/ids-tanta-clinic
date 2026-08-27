/**
 * Pure reports math — no I/O, deliberately kept out of queries.ts (which
 * has `import "server-only"` for its real Supabase calls, and that guard
 * throws if the module is ever imported into a test file). Mirrors this
 * exact billing/calculations.ts <-> billing/actions.ts and
 * compensation/calculations.ts <-> compensation/queries.ts split already
 * established in this codebase, for the same reason.
 */

import { netPaymentAmount, type NetPaymentAmountInput } from "@/lib/billing/calculations";

export interface ProcedureAmount {
  visitTypeId: string | null;
  revenue: number;
  /** Count of billed line items for this procedure in range (how many times it was actually charged), not invoices it appeared on — the meaningful volume figure now that one invoice can carry more than one procedure. */
  appointmentCount: number;
}

export interface InvoiceItemProcedureRow {
  visitTypeId: string | null;
  lineTotal: number;
}

/**
 * Groups billed line items by procedure — every custom (non-catalog) item
 * (visitTypeId null) collapses into one combined group, the same
 * NULL-collation grouping sync_doctor_compensation() uses (see
 * compensation/calculations.ts's groupInvoiceLinesByVisitType(), which this
 * mirrors exactly). Multiple items for the same procedure sum together
 * rather than producing duplicate rows.
 */
export function aggregateProcedureRevenue(rows: readonly InvoiceItemProcedureRow[]): ProcedureAmount[] {
  const totals = new Map<string | null, { revenue: number; appointmentCount: number }>();
  for (const row of rows) {
    const existing = totals.get(row.visitTypeId) ?? { revenue: 0, appointmentCount: 0 };
    existing.revenue += row.lineTotal;
    existing.appointmentCount += 1;
    totals.set(row.visitTypeId, existing);
  }
  return Array.from(totals.entries()).map(([visitTypeId, v]) => ({ visitTypeId, ...v }));
}

// ---------------------------------------------------------------------------
// Advanced Clinical Reports — pure aggregation/grouping helpers only. Every
// function below is deliberately generic across the report families that
// need it (see each doc comment for which reports reuse it), rather than
// one bespoke function per report section, so the same grouping/date-math
// logic exists in exactly one tested place. None of these read from
// treatment-plans/calculations.ts or recalls/calculations.ts — this file
// only holds logic genuinely new to Reports; computeItemProgress(),
// computeEstimatedTotal(), groupPerformedTreatmentRecordsByItem(), and
// isRecallOverdue() are called directly from clinical-queries.ts instead of
// being wrapped or duplicated here.
// ---------------------------------------------------------------------------

export interface ProcedureActivityRow {
  visitTypeId: string | null;
}

export interface ProcedureActivityCount {
  visitTypeId: string | null;
  count: number;
}

/**
 * Groups treatment_records by procedure — Procedure Activity's count-based
 * counterpart to aggregateProcedureRevenue() above (same NULL-collation
 * shape: every custom/non-catalog record collapses into one combined
 * "Custom procedure" group), except this counts clinically performed
 * procedures, not billed revenue, and the caller never joins through
 * appointments to get here.
 */
export function aggregateProcedureActivity(rows: readonly ProcedureActivityRow[]): ProcedureActivityCount[] {
  const totals = new Map<string | null, number>();
  for (const row of rows) {
    totals.set(row.visitTypeId, (totals.get(row.visitTypeId) ?? 0) + 1);
  }
  return Array.from(totals.entries()).map(([visitTypeId, count]) => ({ visitTypeId, count }));
}

export interface DoctorCountRow {
  doctorId: string | null;
}

export interface DoctorCount {
  doctorId: string | null;
  count: number;
}

/**
 * Generic "how many of these rows belong to each doctor" grouping — reused
 * for three different sources: Procedure Activity's doctor breakdown
 * (treatment_records), Clinical Workload's "treatment records performed per
 * doctor" (the exact same treatment_records rows, so clinical-queries.ts
 * computes this once and reuses the result for both sections rather than
 * querying twice), and Clinical Workload's "completed appointments per
 * doctor" (appointments rows instead). doctorId null means the row has no
 * doctor attribution — kept as its own group, never dropped.
 */
export function aggregateCountByDoctor(rows: readonly DoctorCountRow[]): DoctorCount[] {
  const totals = new Map<string | null, number>();
  for (const row of rows) {
    totals.set(row.doctorId, (totals.get(row.doctorId) ?? 0) + 1);
  }
  return Array.from(totals.entries()).map(([doctorId, count]) => ({ doctorId, count }));
}

export interface StatusCountable {
  status: string;
}

/**
 * Generic status tally — reused for three different breakdowns: Treatment
 * Plan Conversion's "plans by current status" (treatment_plans.status),
 * its "item disposition breakdown" (treatment_plan_items.status), and
 * Recall Performance's due/scheduled/completed/dismissed counts
 * (recalls.status). Every count here describes *current* status of rows
 * created/decided in the selected range — never a historical snapshot, since
 * none of these tables keep status history (see each report page's own
 * explanatory copy).
 */
export function countByStatus(rows: readonly StatusCountable[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

export interface FulfillmentInput {
  id: string;
  status: string;
}

export interface FulfillmentPartition<T> {
  fulfilled: T[];
  unfulfilled: T[];
}

/**
 * Planned vs Performed's fulfillment split. An item is "fulfilled" the
 * moment it has at least one linked treatment_records row, regardless of
 * its own status — a plain fact, not a workflow judgment. "Unfulfilled"
 * additionally excludes rejected items: a declined item is not remaining
 * work, so it belongs in neither bucket. `performedByItem` is expected to
 * already come from groupPerformedTreatmentRecordsByItem() (treatment-
 * plans/calculations.ts) — this function only decides what to do with that
 * lookup, it doesn't build it, so the "what counts as performed" rule stays
 * defined in exactly one place.
 */
export function partitionFulfillment<T extends FulfillmentInput>(
  items: readonly T[],
  performedByItem: ReadonlyMap<string, unknown[]>,
): FulfillmentPartition<T> {
  const fulfilled: T[] = [];
  const unfulfilled: T[] = [];
  for (const item of items) {
    const hasRecord = (performedByItem.get(item.id)?.length ?? 0) > 0;
    if (hasRecord) {
      fulfilled.push(item);
    } else if (item.status !== "rejected") {
      unfulfilled.push(item);
    }
  }
  return { fulfilled, unfulfilled };
}

export interface DateSpan {
  from: string;
  to: string;
}

/**
 * Average whole-and-fractional days between `from` and `to` across every
 * span — the shared date-math primitive behind two unrelated-looking
 * metrics that are actually the same arithmetic: "average time to decision"
 * (created_at -> decided_at, Treatment Plan Conversion) and "average days
 * overdue" (due_date -> today, Recall Performance). Returns null for an
 * empty input rather than NaN/0, so a callsite can render "—" instead of a
 * misleading number when there's nothing to average.
 */
export function averageDaysBetween(spans: readonly DateSpan[]): number | null {
  if (spans.length === 0) return null;
  const totalDays = spans.reduce(
    (sum, span) => sum + (new Date(span.to).getTime() - new Date(span.from).getTime()) / 86_400_000,
    0,
  );
  return totalDays / spans.length;
}

/**
 * Recall Performance's completion rate — completed / (completed + dismissed)
 * among recalls *decided* in the selected range. Deliberately excludes
 * still-open (due/scheduled) recalls from the denominator per the approved
 * design: an undecided recall hasn't succeeded or failed yet, so counting it
 * against either bucket would understate the rate for no reason. Returns
 * null when nothing was decided, so the UI can render "—" instead of a
 * division-by-zero artifact.
 */
export function computeCompletionRate(completedCount: number, dismissedCount: number): number | null {
  const denominator = completedCount + dismissedCount;
  if (denominator === 0) return null;
  return completedCount / denominator;
}

// ---------------------------------------------------------------------------
// Cash Reconciliation (Batch 6) — "how much money was actually recorded
// today, by method, net of refunds." Reuses netPaymentAmount() (Batch 4)
// for the per-row signed contribution instead of re-deriving `gross -
// refunds` by hand, so there remains exactly one definition of "net
// payment" in the app — this report can never silently disagree with
// Billing's own figures for the same rows. Recorded transactions only:
// there is no opening-cash/expected-cash concept anywhere in this schema
// (payments has no such column), so this deliberately never fabricates one.
// ---------------------------------------------------------------------------

export interface CashReconciliationRow extends NetPaymentAmountInput {
  method: string;
}

export interface CashReconciliationMethodTotal {
  method: string;
  count: number;
  gross: number;
  refunds: number;
  net: number;
}

export interface CashReconciliationSummary {
  methods: CashReconciliationMethodTotal[];
  paymentCount: number;
  totalGross: number;
  totalRefunds: number;
  totalNet: number;
}

/** Zero-activity input produces zero-activity output (empty `methods`, all totals 0) rather than a division/NaN artifact — the UI renders this as "No payment activity recorded" instead of a broken table. */
export function summarizeCashReconciliation(rows: readonly CashReconciliationRow[]): CashReconciliationSummary {
  const byMethod = new Map<string, CashReconciliationMethodTotal>();

  for (const row of rows) {
    const existing = byMethod.get(row.method) ?? { method: row.method, count: 0, gross: 0, refunds: 0, net: 0 };
    const amount = Number(row.amount);

    if (row.type === "refund") {
      existing.refunds += amount;
    } else {
      existing.gross += amount;
    }
    existing.net += netPaymentAmount(row);
    existing.count += 1;
    byMethod.set(row.method, existing);
  }

  const methods = Array.from(byMethod.values()).sort((a, b) => a.method.localeCompare(b.method));

  return {
    methods,
    paymentCount: rows.length,
    totalGross: methods.reduce((sum, m) => sum + m.gross, 0),
    totalRefunds: methods.reduce((sum, m) => sum + m.refunds, 0),
    totalNet: methods.reduce((sum, m) => sum + m.net, 0),
  };
}

// ---------------------------------------------------------------------------
// Referral / Acquisition Source (Batch 6) — patients.referral_source is
// freeform text with no existing normalization convention anywhere in this
// codebase, so this deliberately does NOT merge case variants ("Instagram"
// vs "instagram" stay distinct) — only whitespace is trimmed, and an
// empty/null value collapses to one explicit "unspecified" bucket (`source:
// null`) rather than several silently-different blanks. The UI maps `null`
// to its own translated "Unknown / Not specified" label; this module stays
// free of any hardcoded display string.
// ---------------------------------------------------------------------------

export interface ReferralSourcePatientRow {
  referralSource: string | null | undefined;
}

export interface ReferralSourceCount {
  /** null = no referral source recorded (blank or whitespace-only) — the UI renders this as its own "Unknown / Not specified" bucket, never silently dropped or merged into a real source. */
  source: string | null;
  count: number;
  /** 0-100, one decimal place. */
  percent: number;
}

/** Trims whitespace only — never lowercases/merges values, since no such normalization convention exists elsewhere for this column. Blank/whitespace-only collapses to null. */
export function normalizeReferralSource(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Population = every row passed in (the caller decides the date range/window, e.g. patients created within a period) — an empty list returns an empty array, never a divide-by-zero percentage. */
export function aggregateReferralSources(rows: readonly ReferralSourcePatientRow[]): ReferralSourceCount[] {
  const total = rows.length;
  const counts = new Map<string | null, number>();

  for (const row of rows) {
    const key = normalizeReferralSource(row.referralSource);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([source, count]) => ({
      source,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}
