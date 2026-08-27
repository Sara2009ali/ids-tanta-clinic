import "server-only";

import { NextResponse } from "next/server";
import { extractBearerToken, isValidSchedulerSecret } from "@/lib/scheduler/auth";
import { SCHEDULER_JOBS, getJobByName, isKnownJobName } from "@/lib/scheduler/registry";
import { runScheduledJobs, logSchedulerRun } from "@/lib/scheduler/runner";
import { claimSchedulerRun, finishSchedulerRun } from "@/lib/scheduler/persistence";

/**
 * External cron provider → this endpoint → scheduler execution guard →
 * registered jobs → existing notification service (once jobs are added).
 * Only POST is exported — Next.js route handlers automatically respond
 * 405 Method Not Allowed to any method without a matching export, so GET/
 * PUT/DELETE/etc. are rejected without any code here.
 *
 * Bounded, explicit execution time: the current job set completes in
 * milliseconds, but this caps the route regardless of what's added to the
 * registry later, so a future slow/stuck job fails loudly (function
 * timeout) instead of running indefinitely inside a single request. Keep
 * this comfortably below persistence.ts's STALE_AFTER_SECONDS so a still-
 * legitimately-running request is never reclaimed out from under itself.
 */
export const maxDuration = 30;

function unauthorized(): Response {
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

export async function POST(request: Request): Promise<Response> {
  const expectedSecret = process.env.DENTRA_SCHEDULER_SECRET;
  if (!expectedSecret) {
    // Fails closed: an unconfigured secret must never be treated as "no
    // auth required." Logged without any request detail — there is
    // nothing safe to attribute this to, since we haven't authenticated
    // the caller yet.
    console.error("scheduler endpoint invoked but DENTRA_SCHEDULER_SECRET is not configured");
    return NextResponse.json({ error: "Scheduler is not configured." }, { status: 503 });
  }

  const provided = extractBearerToken(request.headers.get("authorization"));
  if (!isValidSchedulerSecret(provided, expectedSecret)) {
    return unauthorized();
  }

  // An optional, explicitly allowlisted job selector — useful for manually
  // triggering/verifying one job without running the whole registry.
  // Absent body / absent `job` field runs every registered job (the normal
  // cron-triggered path). Any unrecognized name is rejected outright: there
  // is no fallback job, no fuzzy match, and this is the ONLY way a job ever
  // gets selected — never a dynamic import, never eval, never anything
  // derived from the name besides this exact Map lookup.
  let requestedJob: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && "job" in body) {
      requestedJob = String((body as Record<string, unknown>).job);
    }
  } catch {
    // No body, or not JSON — fine, run the full registry.
  }

  let jobsToRun = SCHEDULER_JOBS;
  if (requestedJob !== undefined) {
    if (!isKnownJobName(requestedJob)) {
      return NextResponse.json({ error: "Unknown job." }, { status: 400 });
    }
    const job = getJobByName(requestedJob);
    if (!job) {
      return NextResponse.json({ error: "Unknown job." }, { status: 400 });
    }
    jobsToRun = [job];
  }

  let runId: string | null;
  try {
    runId = await claimSchedulerRun();
  } catch (error) {
    console.error("scheduler run could not be claimed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Scheduler is not available." }, { status: 503 });
  }

  if (!runId) {
    // Another run is already in progress (or the claim itself failed —
    // treated identically, see claimSchedulerRun's own doc comment): a
    // retried/overlapping cron trigger is expected, not an error.
    return NextResponse.json({ ok: true, skipped: true, reason: "A scheduler run is already in progress." }, { status: 200 });
  }

  try {
    const summary = await runScheduledJobs(runId, jobsToRun);
    logSchedulerRun(summary);
    await finishSchedulerRun(runId, summary.allSucceeded ? "completed" : "failed", summary);

    return NextResponse.json(
      {
        ok: summary.allSucceeded,
        runId,
        jobs: summary.jobs.map((job) => ({ name: job.name, status: job.status, durationMs: job.durationMs })),
      },
      { status: 200 },
    );
  } catch (error) {
    // Only ever a caught .message, never the raw error/stack — this is an
    // HTTP response, not a server log.
    console.error("scheduler run crashed", { runId, error: error instanceof Error ? error.message : "unknown error" });
    await finishSchedulerRun(runId, "failed", null);
    return NextResponse.json({ error: "Scheduler run failed." }, { status: 500 });
  }
}
