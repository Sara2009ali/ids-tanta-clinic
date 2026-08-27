/**
 * The explicit, closed set of jobs the scheduler endpoint will ever run.
 * There is no dynamic import, no job name accepted from a request, no
 * eval — this array literal IS the entire universe of what a trusted cron
 * trigger can cause to execute. A job is added here by editing this file
 * and deploying, never by client/request input.
 *
 * Batch 7 shipped "heartbeat" — a genuine no-op proving the trigger →
 * auth → registry → execution → logging → persistence path works
 * end-to-end. Batch 8 adds the two real time-based jobs the data model can
 * honestly support:
 *
 * - "appointment_reminders" — see lib/appointments/reminders.ts +
 *   lib/scheduler/jobs/appointment-reminders.ts.
 * - "low_stock_notifications" — see lib/inventory/low-stock.ts +
 *   lib/scheduler/jobs/low-stock.ts.
 *
 * "overdue_invoice_notifications" is deliberately NOT registered.
 * `invoices` has no due_date column and no stored 'overdue' status
 * anywhere in the schema (confirmed by inspection of every billing
 * migration) — status is strictly draft/unpaid/partially_paid/paid/
 * cancelled, auto-derived from paid vs. total by
 * recalculate_invoice_totals(). Batch 8's own brief explicitly forbids
 * inferring "overdue" from creation date, arbitrary age, or outstanding
 * balance alone unless the existing business model already defines that
 * rule — it doesn't, so this job is a documented blocker, not an
 * implementation: adding it honestly requires a product decision (does
 * Dentra want a due_date column, and if so what sets it — a fixed term
 * per invoice? per clinic? per insurer?) before any code can be written
 * without guessing. See the Batch 8 report's Known Limitations.
 */

export interface SchedulerJobContext {
  /** The current scheduler_runs.id — available to a future job for correlating its own work/logs back to this run, never used as an authorization token. */
  runId: string;
}

export interface SchedulerJobResult {
  ok: boolean;
  /** Safe-to-log/safe-to-return summary — never patient data, never a raw exception. */
  message?: string;
}

export interface SchedulerJob {
  /** Stable, human-readable identifier — appears in logs and in scheduler_runs.results, never derived from request input. */
  name: string;
  run: (context: SchedulerJobContext) => Promise<SchedulerJobResult>;
}

export const SCHEDULER_JOBS: readonly SchedulerJob[] = [
  {
    name: "heartbeat",
    run: async () => ({ ok: true, message: "Scheduler foundation is operational." }),
  },
  {
    name: "appointment_reminders",
    // Lazy, hardcoded-literal-path import — never a path built from a
    // variable or request input (that is exactly what this file's own
    // header comment forbids). This is required, not stylistic: the job
    // implementation transitively imports lib/supabase/admin.ts, which
    // carries Next.js's `server-only` guard, and that guard throws the
    // instant the module is *imported* (not merely called) from any
    // context Next.js doesn't recognize as a server render — including a
    // plain Vitest run. A static top-level import here would make
    // registry.test.ts (and anything else that imports this file to test
    // the allowlist) fail before a single assertion runs. Deferring the
    // import to inside `run()` — invoked only once the scheduler route
    // actually executes this job — keeps this module importable from
    // tests while the real job stays fully server-only.
    run: async () => (await import("@/lib/scheduler/jobs/appointment-reminders")).runAppointmentRemindersJob(),
  },
  {
    name: "low_stock_notifications",
    run: async () => (await import("@/lib/scheduler/jobs/low-stock")).runLowStockNotificationsJob(),
  },
];

const JOBS_BY_NAME = new Map(SCHEDULER_JOBS.map((job) => [job.name, job]));

/** True only for a name that is actually a key in the registry above — the sole allowlist for an optional, explicit job selector (see route.ts). Never derives truth from request input in any other way (no pattern matching, no case-insensitive fuzzing). */
export function isKnownJobName(name: string): boolean {
  return JOBS_BY_NAME.has(name);
}

/** Looks up one job by its exact registry name — used only after isKnownJobName() (or an equivalent check) has already confirmed the name is allowlisted; returns undefined for anything else, never a fallback/default job. */
export function getJobByName(name: string): SchedulerJob | undefined {
  return JOBS_BY_NAME.get(name);
}
