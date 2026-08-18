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
