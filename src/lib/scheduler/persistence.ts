import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SchedulerRunSummary } from "@/lib/scheduler/runner";

/**
 * Uses the existing service-role admin client (lib/supabase/admin.ts,
 * already established by onboarding/doctors/staff provisioning) rather
 * than a new privileged helper — this is the one place in the scheduler
 * that genuinely needs it: a cron-triggered request has no staff session
 * and therefore no clinic_id to be RLS-scoped by, and scheduler_runs itself
 * has no `authenticated`-facing RLS policy at all (see
 * 0039_scheduler_foundation.sql) — only the two security-definer functions
 * below are ever called, and only from here.
 */

/** Comfortably above any plausible duration for the current job set, and below the route handler's own maxDuration, so a still-legitimately-running request is never reclaimed out from under itself (see route.ts). Revisit if real jobs with longer runtimes are added later. */
const STALE_AFTER_SECONDS = 120;

/**
 * Attempts to claim a new scheduler run. Returns the new run's id, or null
 * if another run is already in progress (or the claim call itself failed —
 * treated the same as "don't run," never as "run anyway"), which the
 * caller must treat as "skip this invocation," not an error.
 */
export async function claimSchedulerRun(): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_scheduler_run", {
    p_stale_after_seconds: STALE_AFTER_SECONDS,
  });

  if (error) {
    console.error("claimSchedulerRun failed", error.message);
    return null;
  }

  return data;
}

export type SchedulerRunOutcome = "completed" | "failed";

/** Records the final state of a run this same request already claimed — never called with a client-supplied id. */
export async function finishSchedulerRun(runId: string, outcome: SchedulerRunOutcome, summary: SchedulerRunSummary | null): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("finish_scheduler_run", {
    p_run_id: runId,
    p_status: outcome,
    p_results: summary as never,
  });

  if (error) {
    console.error("finishSchedulerRun failed", { runId, error: error.message });
  }
}
