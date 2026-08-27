import { describe, it, expect, vi } from "vitest";
import { runScheduledJobs } from "@/lib/scheduler/runner";
import type { SchedulerJob } from "@/lib/scheduler/registry";

function job(name: string, run: SchedulerJob["run"]): SchedulerJob {
  return { name, run };
}

describe("runScheduledJobs — execution and aggregation", () => {
  it("reports allSucceeded true when the only job succeeds", async () => {
    const summary = await runScheduledJobs("run-1", [job("a", async () => ({ ok: true }))]);
    expect(summary.allSucceeded).toBe(true);
    expect(summary.jobs).toEqual([{ name: "a", status: "success", durationMs: expect.any(Number), message: undefined }]);
  });

  it("reports allSucceeded false when a job returns ok: false", async () => {
    const summary = await runScheduledJobs("run-1", [job("a", async () => ({ ok: false, message: "nothing to do" }))]);
    expect(summary.allSucceeded).toBe(false);
    expect(summary.jobs[0]).toMatchObject({ name: "a", status: "failure", message: "nothing to do" });
  });

  it("catches a thrown error and records it as that job's failure, without crashing the run", async () => {
    const summary = await runScheduledJobs("run-1", [
      job("a", async () => {
        throw new Error("boom");
      }),
    ]);
    expect(summary.allSucceeded).toBe(false);
    expect(summary.jobs[0]).toMatchObject({ name: "a", status: "failure", error: "boom" });
  });

  it("isolates one job's failure from another — a failing job never stops the rest from running", async () => {
    const thirdJobRan = vi.fn();
    const summary = await runScheduledJobs("run-1", [
      job("first", async () => ({ ok: true })),
      job("second", async () => {
        throw new Error("second job exploded");
      }),
      job("third", async () => {
        thirdJobRan();
        return { ok: true };
      }),
    ]);

    expect(thirdJobRan).toHaveBeenCalledOnce();
    expect(summary.jobs.map((j) => j.name)).toEqual(["first", "second", "third"]);
    expect(summary.jobs[0].status).toBe("success");
    expect(summary.jobs[1].status).toBe("failure");
    expect(summary.jobs[2].status).toBe("success");
  });

  it("never reports allSucceeded true just because one job in a mixed set failed", async () => {
    const summary = await runScheduledJobs("run-1", [
      job("ok-job", async () => ({ ok: true })),
      job("bad-job", async () => ({ ok: false })),
    ]);
    expect(summary.allSucceeded).toBe(false);
  });

  it("reports allSucceeded false (never a vacuous true) for an empty job list", async () => {
    const summary = await runScheduledJobs("run-1", []);
    expect(summary.jobs).toEqual([]);
    expect(summary.allSucceeded).toBe(false);
  });

  it("passes the run id through to every job's context", async () => {
    const receivedRunIds: string[] = [];
    await runScheduledJobs("run-42", [
      job("a", async (ctx) => {
        receivedRunIds.push(ctx.runId);
        return { ok: true };
      }),
    ]);
    expect(receivedRunIds).toEqual(["run-42"]);
  });

  it("records a non-negative duration for each job and for the overall run", async () => {
    const summary = await runScheduledJobs("run-1", [job("a", async () => ({ ok: true }))]);
    expect(summary.jobs[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("wraps a non-Error throw into a safe generic message rather than leaking the raw thrown value", async () => {
    const summary = await runScheduledJobs("run-1", [
      job("a", async () => {
        throw "a raw string, not an Error";
      }),
    ]);
    expect(summary.jobs[0].error).toBe("Unknown error");
  });
});
