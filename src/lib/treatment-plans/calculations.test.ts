import { describe, it, expect } from "vitest";
import {
  canTransitionPlanStatus,
  computeEstimatedTotal,
  computeItemProgress,
  excludeSoftDeleted,
  groupPerformedTreatmentRecordsByItem,
  initialRecordTreatmentVisitTypeId,
  isAppointmentForPatient,
  isAppointmentTreatmentEligible,
  orderItemsBySequence,
} from "@/lib/treatment-plans/calculations";

describe("canTransitionPlanStatus — plan status validation", () => {
  it("allows draft -> active via activate", () => {
    expect(canTransitionPlanStatus("draft", "activate")).toBe(true);
  });

  it("allows active -> completed via complete", () => {
    expect(canTransitionPlanStatus("active", "complete")).toBe(true);
  });

  it("allows active -> abandoned via abandon", () => {
    expect(canTransitionPlanStatus("active", "abandon")).toBe(true);
  });

  it("refuses completing a draft plan", () => {
    expect(canTransitionPlanStatus("draft", "complete")).toBe(false);
  });

  it("refuses abandoning a draft plan", () => {
    expect(canTransitionPlanStatus("draft", "abandon")).toBe(false);
  });

  it("refuses activating an already-active plan", () => {
    expect(canTransitionPlanStatus("active", "activate")).toBe(false);
  });

  it("refuses any transition out of a completed plan", () => {
    expect(canTransitionPlanStatus("completed", "activate")).toBe(false);
    expect(canTransitionPlanStatus("completed", "complete")).toBe(false);
    expect(canTransitionPlanStatus("completed", "abandon")).toBe(false);
  });

  it("refuses any transition out of an abandoned plan", () => {
    expect(canTransitionPlanStatus("abandoned", "activate")).toBe(false);
    expect(canTransitionPlanStatus("abandoned", "complete")).toBe(false);
    expect(canTransitionPlanStatus("abandoned", "abandon")).toBe(false);
  });
});

describe("computeItemProgress — multiple items in one plan", () => {
  it("reports all-zero for a plan with zero items", () => {
    expect(computeItemProgress([])).toEqual({
      totalCount: 0,
      acceptedCount: 0,
      completedCount: 0,
      acceptedPercent: 0,
      completedPercent: 0,
    });
  });

  it("computes accepted/completed counts and percentages across a mixed set of items", () => {
    const items = [
      { status: "planned" },
      { status: "accepted" },
      { status: "in_progress" },
      { status: "completed" },
      { status: "rejected" },
    ];
    // accepted-or-further: accepted, in_progress, completed = 3/5 = 60%
    // completed: 1/5 = 20%
    expect(computeItemProgress(items)).toEqual({
      totalCount: 5,
      acceptedCount: 3,
      completedCount: 1,
      acceptedPercent: 60,
      completedPercent: 20,
    });
  });

  it("treats postponed and rejected as not accepted", () => {
    const items = [{ status: "postponed" }, { status: "rejected" }];
    expect(computeItemProgress(items)).toEqual({
      totalCount: 2,
      acceptedCount: 0,
      completedCount: 0,
      acceptedPercent: 0,
      completedPercent: 0,
    });
  });

  it("reports 100/100 when every item is completed", () => {
    const items = [{ status: "completed" }, { status: "completed" }];
    expect(computeItemProgress(items)).toEqual({
      totalCount: 2,
      acceptedCount: 2,
      completedCount: 2,
      acceptedPercent: 100,
      completedPercent: 100,
    });
  });
});

describe("computeEstimatedTotal — plan estimated value", () => {
  it("sums price × quantity across items", () => {
    const items = [
      { estimated_price: 500, quantity: 1 },
      { estimated_price: 300, quantity: 2 },
    ];
    expect(computeEstimatedTotal(items)).toBe(1100);
  });

  it("returns 0 for an empty plan", () => {
    expect(computeEstimatedTotal([])).toBe(0);
  });

  it("coerces string numeric values, matching how Postgres numeric columns arrive over the wire", () => {
    const items = [{ estimated_price: "1500.00", quantity: "1" }];
    expect(computeEstimatedTotal(items)).toBe(1500);
  });

  it("accounts for quantity greater than one", () => {
    expect(computeEstimatedTotal([{ estimated_price: 100, quantity: 3 }])).toBe(300);
  });
});

describe("orderItemsBySequence — sequence ordering", () => {
  it("sorts items ascending by sequence regardless of input order", () => {
    const items = [
      { id: "c", sequence: 2 },
      { id: "a", sequence: 0 },
      { id: "b", sequence: 1 },
    ];
    expect(orderItemsBySequence(items).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input array", () => {
    const items = [{ sequence: 1 }, { sequence: 0 }];
    const original = [...items];
    orderItemsBySequence(items);
    expect(items).toEqual(original);
  });

  it("returns an empty array for an empty plan", () => {
    expect(orderItemsBySequence([])).toEqual([]);
  });
});

describe("excludeSoftDeleted — soft-deleted plan excluded from normal queries", () => {
  it("filters out rows with a non-null deleted_at", () => {
    const rows = [
      { id: "1", deleted_at: null },
      { id: "2", deleted_at: "2026-08-01T00:00:00Z" },
      { id: "3", deleted_at: null },
    ];
    expect(excludeSoftDeleted(rows).map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("returns everything when nothing is soft-deleted", () => {
    const rows = [{ deleted_at: null }, { deleted_at: null }];
    expect(excludeSoftDeleted(rows)).toHaveLength(2);
  });

  it("returns nothing when everything is soft-deleted", () => {
    const rows = [{ deleted_at: "2026-08-01T00:00:00Z" }];
    expect(excludeSoftDeleted(rows)).toEqual([]);
  });
});

describe("groupPerformedTreatmentRecordsByItem — performed treatment lookup through treatment_plan_item_id", () => {
  it("groups records by their treatment_plan_item_id", () => {
    const records = [
      { id: "tr-1", treatment_plan_item_id: "item-1", created_at: "2026-08-01T10:00:00Z" },
      { id: "tr-2", treatment_plan_item_id: "item-2", created_at: "2026-08-02T10:00:00Z" },
    ];
    const grouped = groupPerformedTreatmentRecordsByItem(records);
    expect(grouped.get("item-1")).toEqual([{ treatmentRecordId: "tr-1", performedAt: "2026-08-01T10:00:00Z" }]);
    expect(grouped.get("item-2")).toEqual([{ treatmentRecordId: "tr-2", performedAt: "2026-08-02T10:00:00Z" }]);
  });

  it("collects multiple treatment records fulfilling the same item", () => {
    const records = [
      { id: "tr-1", treatment_plan_item_id: "item-1", created_at: "2026-08-01T10:00:00Z" },
      { id: "tr-2", treatment_plan_item_id: "item-1", created_at: "2026-08-05T10:00:00Z" },
    ];
    expect(groupPerformedTreatmentRecordsByItem(records).get("item-1")).toHaveLength(2);
  });

  it("ignores treatment records with no linked plan item — a treatment record with no plan item remains valid", () => {
    const records = [{ id: "tr-1", treatment_plan_item_id: null, created_at: "2026-08-01T10:00:00Z" }];
    const grouped = groupPerformedTreatmentRecordsByItem(records);
    expect(grouped.size).toBe(0);
  });

  it("returns an empty map for no records", () => {
    expect(groupPerformedTreatmentRecordsByItem([]).size).toBe(0);
  });
});

describe("isAppointmentForPatient — appointment belongs to patient validation", () => {
  it("returns true when the appointment's patient_id matches", () => {
    expect(isAppointmentForPatient({ patient_id: "patient-1" }, "patient-1")).toBe(true);
  });

  it("returns false when the appointment belongs to a different patient", () => {
    expect(isAppointmentForPatient({ patient_id: "patient-2" }, "patient-1")).toBe(false);
  });

  it("returns false when the appointment doesn't exist", () => {
    expect(isAppointmentForPatient(null, "patient-1")).toBe(false);
  });
});

describe("isAppointmentTreatmentEligible — Record Treatment appointment gate", () => {
  it("allows a treatment-eligible appointment status to record treatment", () => {
    expect(isAppointmentTreatmentEligible("checked_in")).toBe(true);
    expect(isAppointmentTreatmentEligible("waiting")).toBe(true);
    expect(isAppointmentTreatmentEligible("in_treatment")).toBe(true);
    expect(isAppointmentTreatmentEligible("completed")).toBe(true);
  });

  it("refuses a non-eligible appointment status", () => {
    expect(isAppointmentTreatmentEligible("scheduled")).toBe(false);
    expect(isAppointmentTreatmentEligible("confirmed")).toBe(false);
    expect(isAppointmentTreatmentEligible("cancelled")).toBe(false);
    expect(isAppointmentTreatmentEligible("no_show")).toBe(false);
  });

  it("refuses when there is no appointment at all — a plan item with no appointment_id can never record treatment", () => {
    expect(isAppointmentTreatmentEligible(null)).toBe(false);
  });
});

describe("initialRecordTreatmentVisitTypeId — Record Treatment dialog prefill", () => {
  it("prefills from a catalog-linked item's visit_type_id", () => {
    expect(initialRecordTreatmentVisitTypeId({ visit_type_id: "visit-type-1" })).toBe("visit-type-1");
  });

  it("leaves a custom item's selection blank, forcing the dentist to pick a catalog procedure", () => {
    expect(initialRecordTreatmentVisitTypeId({ visit_type_id: null })).toBe("");
  });
});
