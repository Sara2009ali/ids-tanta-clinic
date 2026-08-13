import { describe, it, expect } from "vitest";
import { treatmentRecordFormSchema, treatmentRecordFormValuesFromFormData } from "@/lib/treatments/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("treatmentRecordFormSchema", () => {
  it("parses a valid procedure with notes successfully", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: VALID_UUID, notes: "Filling placed." });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        visit_type_id: VALID_UUID,
        notes: "Filling placed.",
        treatment_plan_item_id: undefined,
      });
    }
  });

  it("allows an optional treatment_plan_item_id", () => {
    const result = treatmentRecordFormSchema.safeParse({
      visit_type_id: VALID_UUID,
      treatment_plan_item_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.treatment_plan_item_id).toBe(VALID_UUID);
    }
  });

  it("stays valid with no treatment_plan_item_id at all — a treatment record with no plan item remains valid", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.treatment_plan_item_id).toBeUndefined();
    }
  });

  it("allows omitted notes", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("trims surrounding whitespace on notes", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: VALID_UUID, notes: "  done  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("done");
    }
  });

  it("fails on a missing procedure", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: "" });
    expect(result.success).toBe(false);
  });

  it("fails on a non-uuid procedure id", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("fails when notes exceed 2000 characters", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: VALID_UUID, notes: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("passes at exactly the 2000-character notes limit", () => {
    const result = treatmentRecordFormSchema.safeParse({ visit_type_id: VALID_UUID, notes: "x".repeat(2000) });
    expect(result.success).toBe(true);
  });
});

describe("treatmentRecordFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("visit_type_id", VALID_UUID);
    formData.set("notes", "Some notes");
    formData.set("treatment_plan_item_id", VALID_UUID);
    expect(treatmentRecordFormValuesFromFormData(formData)).toEqual({
      visit_type_id: VALID_UUID,
      notes: "Some notes",
      treatment_plan_item_id: VALID_UUID,
    });
  });

  it("defaults visit_type_id to an empty string and notes/treatment_plan_item_id to undefined when missing", () => {
    const formData = new FormData();
    expect(treatmentRecordFormValuesFromFormData(formData)).toEqual({
      visit_type_id: "",
      notes: undefined,
      treatment_plan_item_id: undefined,
    });
  });
});
