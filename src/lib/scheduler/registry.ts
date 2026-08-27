/**
 * The explicit, closed set of jobs the scheduler endpoint will ever run.
 * There is no dynamic import, no job name accepted from a request, no
 * eval — this array literal IS the entire universe of what a trusted cron
 * trigger can cause to execute. A job is added here by editing this file
 * and deploying, never by client/request input.
 *
 * Batch 7 ships exactly one job — "heartbeat" — a genuine no-op that proves
 * the trigger → auth → registry → execution → logging → persistence path
 * works end-to-end, without sending a real notification, creating a real
 * recall, or touching any clinic's data. Appointment reminders, overdue
 * invoice checks, low-stock checks, and future recall-related jobs are
 * intentionally NOT implemented here (see the Batch 7 report's Explicitly
 * Deferred Features) — this registry is where each one will be added, one
 * entry at a time, once built, without changing the trigger endpoint or
 * the execution harness at all.
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
