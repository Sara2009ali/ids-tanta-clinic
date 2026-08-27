import { describe, it, expect } from "vitest";
import {
  buildAutoRecallInsert,
  canDeleteRecall,
  computeRecallDueDate,
  isRecallActionable,
  isRecallOverdue,
  type AutoRecallCandidate,
} from "@/lib/recalls/calculations";

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

describe("computeRecallDueDate", () => {
  it("adds whole months to the treatment date", () => {
    expect(computeRecallDueDate(new Date("2026-01-15T09:00:00.000Z"), 6)).toBe("2026-07-15");
  });

  it("rolls over a year boundary", () => {
    expect(computeRecallDueDate(new Date("2026-11-01T00:00:00.000Z"), 3)).toBe("2027-02-01");
  });

  it("is independent of the time-of-day component", () => {
    const morning = computeRecallDueDate(new Date("2026-03-10T00:05:00.000Z"), 1);
    const evening = computeRecallDueDate(new Date("2026-03-10T23:55:00.000Z"), 1);
    expect(morning).toBe(evening);
  });
});

describe("buildAutoRecallInsert — automatic recall generation", () => {
  const baseCandidate: AutoRecallCandidate = {
    treatmentRecordId: "tr-1",
    clinicId: "clinic-1",
    patientId: "patient-1",
    doctorId: "doctor-1",
    visitTypeId: "visit-type-1",
    appointmentId: "appt-1",
    procedureName: "Dental Cleaning",
    recallIntervalMonths: 6,
    treatmentDate: new Date("2026-01-01T00:00:00.000Z"),
    createdBy: "staff-1",
  };

  it("creates no recall when the procedure has no configured interval", () => {
    expect(buildAutoRecallInsert({ ...baseCandidate, recallIntervalMonths: null })).toBeNull();
  });

  it("creates a recall with the correct due date when an interval is configured", () => {
    const result = buildAutoRecallInsert(baseCandidate);
    expect(result).not.toBeNull();
    expect(result?.due_date).toBe("2026-07-01");
    expect(result?.treatment_record_id).toBe("tr-1");
    expect(result?.reason).toContain("Dental Cleaning");
  });

  it("links the recall to clinic/patient/doctor/visit type/appointment from the candidate, never invented", () => {
    const result = buildAutoRecallInsert(baseCandidate);
    expect(result).toEqual({
      clinic_id: "clinic-1",
      patient_id: "patient-1",
      doctor_id: "doctor-1",
      visit_type_id: "visit-type-1",
      appointment_id: "appt-1",
      treatment_record_id: "tr-1",
      reason: "Follow-up: Dental Cleaning",
      due_date: "2026-07-01",
      created_by: "staff-1",
    });
  });

  it("produces independent recalls (different treatment_record_id) for two separate treatment records of the same patient/procedure", () => {
    const first = buildAutoRecallInsert(baseCandidate);
    const second = buildAutoRecallInsert({ ...baseCandidate, treatmentRecordId: "tr-2", treatmentDate: new Date("2026-02-01T00:00:00.000Z") });
    expect(first?.treatment_record_id).not.toBe(second?.treatment_record_id);
    expect(first?.due_date).not.toBe(second?.due_date);
  });

  it("computing the same candidate twice (a retry) produces an identical payload, so 'on conflict do nothing' on treatment_record_id safely no-ops the second insert", () => {
    const first = buildAutoRecallInsert(baseCandidate);
    const second = buildAutoRecallInsert(baseCandidate);
    expect(first).toEqual(second);
  });
});
