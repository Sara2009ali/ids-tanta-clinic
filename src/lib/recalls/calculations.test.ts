import { describe, it, expect } from "vitest";
import { canDeleteRecall, isRecallActionable, isRecallOverdue } from "@/lib/recalls/calculations";

const TODAY = new Date("2026-08-18T12:00:00.000Z");

describe("isRecallOverdue — derived overdue state", () => {
  it("is not overdue when the due date is in the future", () => {
    expect(isRecallOverdue({ status: "due", due_date: "2026-09-01" }, TODAY)).toBe(false);
  });

  it("is not overdue when the due date is today", () => {
    expect(isRecallOverdue({ status: "due", due_date: "2026-08-18" }, TODAY)).toBe(false);
  });

  it("is overdue when a 'due' recall's due date has passed", () => {
    expect(isRecallOverdue({ status: "due", due_date: "2026-08-01" }, TODAY)).toBe(true);
  });

  it("a 'scheduled' recall is never overdue, regardless of due date", () => {
    expect(isRecallOverdue({ status: "scheduled", due_date: "2026-08-01" }, TODAY)).toBe(false);
  });

  it("a 'completed' recall is never overdue, regardless of due date", () => {
    expect(isRecallOverdue({ status: "completed", due_date: "2026-08-01" }, TODAY)).toBe(false);
  });

  it("a 'dismissed' recall is never overdue, regardless of due date", () => {
    expect(isRecallOverdue({ status: "dismissed", due_date: "2026-08-01" }, TODAY)).toBe(false);
  });
});

describe("isRecallActionable — whether status can still transition", () => {
  it("a 'due' recall is actionable", () => {
    expect(isRecallActionable("due")).toBe(true);
  });

  it("a 'scheduled' recall is actionable", () => {
    expect(isRecallActionable("scheduled")).toBe(true);
  });

  it("a 'completed' recall is not actionable", () => {
    expect(isRecallActionable("completed")).toBe(false);
  });

  it("a 'dismissed' recall is not actionable", () => {
    expect(isRecallActionable("dismissed")).toBe(false);
  });
});

describe("canDeleteRecall — delete-only-while-due rule", () => {
  it("allows deleting a 'due' recall", () => {
    expect(canDeleteRecall("due")).toBe(true);
  });

  it("refuses deleting a 'scheduled' recall", () => {
    expect(canDeleteRecall("scheduled")).toBe(false);
  });

  it("refuses deleting a 'completed' recall", () => {
    expect(canDeleteRecall("completed")).toBe(false);
  });

  it("refuses deleting a 'dismissed' recall", () => {
    expect(canDeleteRecall("dismissed")).toBe(false);
  });
});
