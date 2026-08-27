/**
 * Sequential job execution + result aggregation. Pure aside from calling
 * each job's own (possibly I/O-performing) `run()` — no Supabase/env access
 * of its own — so the execution/aggregation/failure-isolation behavior is
 * unit-testable with hand-built fake jobs, independent of the real
 * registry or any database.
 */

import type { SchedulerJob, SchedulerJobContext } from "@/lib/scheduler/registry";

export type JobStatus = "success" | "failure";

export interface JobExecutionRecord {
  name: string;
  status: JobStatus;
  durationMs: number;
  /** Only ever a job's own SchedulerJobResult.message — never present alongside `error`. */
  message?: string;
  /** A caught exception's message only (never `.stack`, never the raw error object) — see logSchedulerRun's own doc comment for what must never end up here. */
  error?: string;
}

export interface SchedulerRunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** True only if every registered job reported ok:true and none threw — a single failing job must never be silently absorbed into an overall "success". */
  allSucceeded: boolean;
  jobs: JobExecutionRecord[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

/**
 * Runs every job in `jobs` one after another, not concurrently. Jobs in
 * this registry may come to share database/connection budget as more are
 * added, and sequential execution keeps failure isolation trivial to
 * reason about: one job's unhandled rejection can never race with, or
 * obscure, another's result. The registry is small and fixed (see
 * registry.ts), so sequential latency is negligible; if the job count
 * grows enough for this to matter, that is a deliberate future decision,
 * not a default to reach for now (see "Do not over-engineer a queue
 * system in this batch").
 *
 * A job that throws is caught here and recorded as that job's own failure
 * — it never aborts the remaining jobs, and it is never merged into
 * `allSucceeded: true`.
 */
export async function runScheduledJobs(
  runId: string,
  jobs: readonly SchedulerJob[],
): Promise<SchedulerRunSummary> {
  const context: SchedulerJobContext = { runId };
  const startedAt = new Date();
  const jobRecords: JobExecutionRecord[] = [];

  for (const job of jobs) {
    const jobStartedAt = Date.now();
    try {
      const result = await job.run(context);
      jobRecords.push({
        name: job.name,
        status: result.ok ? "success" : "failure",
        durationMs: Date.now() - jobStartedAt,
        message: result.message,
      });
    } catch (error) {
      jobRecords.push({
        name: job.name,
        status: "failure",
        durationMs: Date.now() - jobStartedAt,
        error: errorMessage(error),
      });
    }
  }

  const finishedAt = new Date();

  return {
    runId,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    allSucceeded: jobRecords.length > 0 && jobRecords.every((record) => record.status === "success"),
    jobs: jobRecords,
  };
}

/**
 * Structured, single-line JSON log for the whole run, plus one console.error
 * per failed job. Deliberately allow-list shaped: only run id, job names,
 * statuses, durations, and (for a failed job) its caught error *message*
 * are ever logged. Never log: the scheduler secret, the Authorization
 * header, patient names/phones/files, passwords, invitation/reset/access
 * tokens, or raw exception objects/stack traces — job messages/errors are
 * always plain strings this module itself produced or caught, never a
 * request body or a Supabase row.
 */
export function logSchedulerRun(summary: SchedulerRunSummary): void {
  console.log(
    JSON.stringify({
      event: "scheduler.run",
      runId: summary.runId,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      durationMs: summary.durationMs,
      allSucceeded: summary.allSucceeded,
      jobs: summary.jobs.map((job) => ({ name: job.name, status: job.status, durationMs: job.durationMs })),
    }),
  );

  for (const job of summary.jobs) {
    if (job.status === "failure") {
      console.error("scheduler job failed", { runId: summary.runId, job: job.name, error: job.error });
    }
  }
}
