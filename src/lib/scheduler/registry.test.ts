import { describe, it, expect } from "vitest";
import { SCHEDULER_JOBS, getJobByName, isKnownJobName } from "@/lib/scheduler/registry";

describe("SCHEDULER_JOBS — the closed job registry", () => {
  it("contains at least the foundation heartbeat job", () => {
    expect(SCHEDULER_JOBS.some((job) => job.name === "heartbeat")).toBe(true);
  });

  it("every registered job has a unique name", () => {
    const names = SCHEDULER_JOBS.map((job) => job.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("isKnownJobName — the explicit allowlist", () => {
  it("accepts every name actually present in the registry", () => {
    for (const job of SCHEDULER_JOBS) {
      expect(isKnownJobName(job.name)).toBe(true);
    }
  });

  it("rejects a name that isn't in the registry", () => {
    expect(isKnownJobName("send-appointment-reminders")).toBe(false);
    expect(isKnownJobName("../../etc/passwd")).toBe(false);
    expect(isKnownJobName("__proto__")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isKnownJobName("")).toBe(false);
  });

  it("is case-sensitive — 'Heartbeat' is not 'heartbeat'", () => {
    expect(isKnownJobName("Heartbeat")).toBe(false);
  });
});

describe("getJobByName", () => {
  it("returns the matching job for a known name", () => {
    const job = getJobByName("heartbeat");
    expect(job?.name).toBe("heartbeat");
  });

  it("returns undefined for an unknown name, never a fallback job", () => {
    expect(getJobByName("does-not-exist")).toBeUndefined();
  });
});
