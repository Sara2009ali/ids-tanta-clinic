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
  isBillableTreatmentPlanItemStatus,
  isCustomPlanItem,
  isTreatmentPlanItemDefinitionEditable,
  orderItemsBySequence,
  resolveInvoiceAppointmentId,
  resolveTreatmentPlanItemUnitPrice,
  treatmentPlanItemsToInvoiceItems,
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

describe("isTreatmentPlanItemDefinitionEditable — item definition lock", () => {
  it("allows editing a draft plan's items", () => {
    expect(isTreatmentPlanItemDefinitionEditable("draft")).toBe(true);
  });

  it("locks an active plan's items", () => {
    expect(isTreatmentPlanItemDefinitionEditable("active")).toBe(false);
  });

  it("locks a completed plan's items", () => {
    expect(isTreatmentPlanItemDefinitionEditable("completed")).toBe(false);
  });

  it("locks an abandoned plan's items", () => {
    expect(isTreatmentPlanItemDefinitionEditable("abandoned")).toBe(false);
  });

  it("locks an unrecognized status closed by default", () => {
    expect(isTreatmentPlanItemDefinitionEditable("something-unexpected")).toBe(false);
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

describe("isCustomPlanItem — Record Treatment custom-procedure detection", () => {
  it("treats a plan item with no catalog link as custom", () => {
    expect(isCustomPlanItem({ visit_type_id: null })).toBe(true);
  });

  it("treats a catalog-linked plan item as not custom", () => {
    expect(isCustomPlanItem({ visit_type_id: "visit-type-1" })).toBe(false);
  });
});

describe("isBillableTreatmentPlanItemStatus — Create Invoice eligibility", () => {
  it("accepts an 'accepted' item", () => {
    expect(isBillableTreatmentPlanItemStatus("accepted")).toBe(true);
  });

  it("accepts a 'completed' item", () => {
    expect(isBillableTreatmentPlanItemStatus("completed")).toBe(true);
  });

  it("excludes a 'planned' item", () => {
    expect(isBillableTreatmentPlanItemStatus("planned")).toBe(false);
  });

  it("excludes a 'postponed' item", () => {
    expect(isBillableTreatmentPlanItemStatus("postponed")).toBe(false);
  });

  it("excludes a 'rejected' item", () => {
    expect(isBillableTreatmentPlanItemStatus("rejected")).toBe(false);
  });

  it("excludes an 'in_progress' item", () => {
    expect(isBillableTreatmentPlanItemStatus("in_progress")).toBe(false);
  });
});

describe("resolveTreatmentPlanItemUnitPrice — invoice line price rule", () => {
  it("prefers the current catalog price for a catalog-linked item", () => {
    const price = resolveTreatmentPlanItemUnitPrice(
      { visit_type_id: "visit-type-1", estimated_price: 100 },
      [{ id: "visit-type-1", price: 150 }],
    );
    expect(price).toBe(150);
  });

  it("falls back to estimated_price when the catalog entry can't be found (e.g. deleted procedure)", () => {
    const price = resolveTreatmentPlanItemUnitPrice(
      { visit_type_id: "visit-type-missing", estimated_price: 100 },
      [{ id: "visit-type-1", price: 150 }],
    );
    expect(price).toBe(100);
  });

  it("uses estimated_price directly for a custom item — there is no catalog price to consult", () => {
    const price = resolveTreatmentPlanItemUnitPrice({ visit_type_id: null, estimated_price: 75 }, [
      { id: "visit-type-1", price: 150 },
    ]);
    expect(price).toBe(75);
  });
});

describe("treatmentPlanItemsToInvoiceItems — plan item -> invoice line mapping", () => {
  it("seeds a single invoice line from a single selected item", () => {
    const lines = treatmentPlanItemsToInvoiceItems(
      [{ procedure_name: "Root Canal", estimated_price: 100, quantity: 1, visit_type_id: "visit-type-1" }],
      [{ id: "visit-type-1", price: 120 }],
    );
    expect(lines).toEqual([
      { description: "Root Canal", quantity: 1, unit_price: 120, discount_amount: 0, visit_type_id: "visit-type-1" },
    ]);
  });

  it("seeds one invoice line per selected item for a multi-item selection", () => {
    const lines = treatmentPlanItemsToInvoiceItems(
      [
        { procedure_name: "Root Canal", estimated_price: 100, quantity: 1, visit_type_id: "visit-type-1" },
        { procedure_name: "Filling", estimated_price: 50, quantity: 2, visit_type_id: "visit-type-2" },
      ],
      [
        { id: "visit-type-1", price: 100 },
        { id: "visit-type-2", price: 50 },
      ],
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ description: "Root Canal", quantity: 1, unit_price: 100 });
    expect(lines[1]).toMatchObject({ description: "Filling", quantity: 2, unit_price: 50 });
  });

  it("keeps a custom plan item custom — no catalog procedure is invented for it", () => {
    const lines = treatmentPlanItemsToInvoiceItems(
      [{ procedure_name: "Freehand custom procedure", estimated_price: 200, quantity: 1, visit_type_id: null }],
      [{ id: "visit-type-1", price: 999 }],
    );
    expect(lines).toEqual([
      {
        description: "Freehand custom procedure",
        quantity: 1,
        unit_price: 200,
        discount_amount: 0,
        visit_type_id: null,
      },
    ]);
  });
});

describe("resolveInvoiceAppointmentId — invoice-level appointment_id when seeding from multiple items", () => {
  it("preserves the appointment_id when every selected item shares it", () => {
    expect(
      resolveInvoiceAppointmentId([{ appointment_id: "appt-1" }, { appointment_id: "appt-1" }]),
    ).toBe("appt-1");
  });

  it("returns null when selected items have different appointment_ids", () => {
    expect(
      resolveInvoiceAppointmentId([{ appointment_id: "appt-1" }, { appointment_id: "appt-2" }]),
    ).toBeNull();
  });

  it("returns null when no selected item has an appointment", () => {
    expect(
      resolveInvoiceAppointmentId([{ appointment_id: null }, { appointment_id: null }]),
    ).toBeNull();
  });

  it("returns null when selected items mix an appointment and no appointment — never invents one", () => {
    expect(
      resolveInvoiceAppointmentId([{ appointment_id: "appt-1" }, { appointment_id: null }]),
    ).toBeNull();
  });

  it("handles a single-item selection as the size-1 case of the same rule", () => {
    expect(resolveInvoiceAppointmentId([{ appointment_id: "appt-1" }])).toBe("appt-1");
    expect(resolveInvoiceAppointmentId([{ appointment_id: null }])).toBeNull();
  });
});
