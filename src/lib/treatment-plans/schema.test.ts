import { describe, it, expect } from "vitest";
import {
  treatmentPlanFormSchema,
  treatmentPlanFormValuesFromFormData,
  treatmentPlanItemFormSchema,
  treatmentPlanItemFormValuesFromFormData,
  treatmentPlanItemPrioritySchema,
  treatmentPlanItemStatusSchema,
} from "@/lib/treatment-plans/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("treatmentPlanFormSchema", () => {
  it("allows an omitted title", () => {
    const result = treatmentPlanFormSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBeUndefined();
    }
  });

  it("trims a provided title", () => {
    const result = treatmentPlanFormSchema.safeParse({ title: "  Q3 Restorative Plan  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("Q3 Restorative Plan");
    }
  });
});

describe("treatmentPlanItemFormSchema — procedure snapshot behavior", () => {
  it("accepts a catalog-linked item and keeps procedure_name/estimated_price as submitted, regardless of visit_type_id", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Root Canal",
      estimated_price: 1500,
      visit_type_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // visit_type_id is provenance only — it never rewrites the submitted name/price.
      expect(result.data.procedure_name).toBe("Root Canal");
      expect(result.data.estimated_price).toBe(1500);
      expect(result.data.visit_type_id).toBe(VALID_UUID);
    }
  });

  it("accepts a custom item with no visit_type_id at all", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Referred specialist consult",
      estimated_price: 300,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visit_type_id).toBeNull();
    }
  });

  it("treats an empty-string visit_type_id the same as omitted (null)", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Custom item",
      estimated_price: 100,
      visit_type_id: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visit_type_id).toBeNull();
    }
  });
});

describe("treatmentPlanItemFormSchema — quantity", () => {
  it("defaults quantity to 1 when omitted", () => {
    const result = treatmentPlanItemFormSchema.safeParse({ procedure_name: "Filling", estimated_price: 200 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(1);
    }
  });

  it("accepts a quantity greater than 1", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Filling",
      estimated_price: 200,
      quantity: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(2);
    }
  });

  it("rejects a quantity of zero", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Filling",
      estimated_price: 200,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative quantity", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Filling",
      estimated_price: 200,
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("treatmentPlanItemFormSchema — other fields", () => {
  it("rejects a negative estimated_price", () => {
    const result = treatmentPlanItemFormSchema.safeParse({ procedure_name: "Filling", estimated_price: -5 });
    expect(result.success).toBe(false);
  });

  it("accepts an estimated_price of exactly zero", () => {
    const result = treatmentPlanItemFormSchema.safeParse({ procedure_name: "Consult", estimated_price: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects an empty procedure_name", () => {
    const result = treatmentPlanItemFormSchema.safeParse({ procedure_name: "", estimated_price: 100 });
    expect(result.success).toBe(false);
  });

  it("defaults priority to normal when omitted", () => {
    const result = treatmentPlanItemFormSchema.safeParse({ procedure_name: "Filling", estimated_price: 200 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("normal");
    }
  });

  it("accepts tooth_reference and notes as optional free text", () => {
    const result = treatmentPlanItemFormSchema.safeParse({
      procedure_name: "Root Canal",
      estimated_price: 1500,
      tooth_reference: "36",
      notes: "Deep caries, near pulp.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tooth_reference).toBe("36");
      expect(result.data.notes).toBe("Deep caries, near pulp.");
    }
  });
});

describe("treatmentPlanItemPrioritySchema", () => {
  it("accepts every valid priority", () => {
    for (const value of ["normal", "high", "urgent"]) {
      expect(treatmentPlanItemPrioritySchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an invalid priority", () => {
    expect(treatmentPlanItemPrioritySchema.safeParse("critical").success).toBe(false);
  });
});

describe("treatmentPlanItemStatusSchema", () => {
  it("accepts every valid status", () => {
    for (const value of ["planned", "accepted", "postponed", "rejected", "in_progress", "completed"]) {
      expect(treatmentPlanItemStatusSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an invalid status", () => {
    expect(treatmentPlanItemStatusSchema.safeParse("archived").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(treatmentPlanItemStatusSchema.safeParse("").success).toBe(false);
  });
});

describe("treatmentPlanFormValuesFromFormData", () => {
  it("extracts a provided title", () => {
    const formData = new FormData();
    formData.set("title", "Q3 Plan");
    expect(treatmentPlanFormValuesFromFormData(formData)).toEqual({ title: "Q3 Plan" });
  });

  it("defaults to undefined when missing", () => {
    const formData = new FormData();
    expect(treatmentPlanFormValuesFromFormData(formData)).toEqual({ title: undefined });
  });
});

describe("treatmentPlanItemFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("procedure_name", "Root Canal");
    formData.set("estimated_price", "1500");
    formData.set("quantity", "2");
    formData.set("tooth_reference", "36");
    formData.set("priority", "urgent");
    formData.set("notes", "Deep caries");
    formData.set("visit_type_id", VALID_UUID);
    formData.set("appointment_id", VALID_UUID);

    expect(treatmentPlanItemFormValuesFromFormData(formData)).toEqual({
      procedure_name: "Root Canal",
      estimated_price: "1500",
      quantity: "2",
      tooth_reference: "36",
      priority: "urgent",
      notes: "Deep caries",
      visit_type_id: VALID_UUID,
      appointment_id: VALID_UUID,
    });
  });

  it("defaults sensibly when the form is empty", () => {
    const formData = new FormData();
    expect(treatmentPlanItemFormValuesFromFormData(formData)).toEqual({
      procedure_name: "",
      estimated_price: "0",
      quantity: "1",
      tooth_reference: undefined,
      priority: "normal",
      notes: undefined,
      visit_type_id: null,
      appointment_id: undefined,
    });
  });
});
