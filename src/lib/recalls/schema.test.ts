import { describe, it, expect } from "vitest";
import { recallFormSchema, recallFormValuesFromFormData } from "@/lib/recalls/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function validInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    patient_id: VALID_UUID,
    reason: "6-month hygiene recall",
    due_date: "2027-02-01",
    ...overrides,
  };
}

describe("recallFormSchema — required fields", () => {
  it("requires a patient", () => {
    const result = recallFormSchema.safeParse(validInput({ patient_id: "" }));
    expect(result.success).toBe(false);
  });

  it("requires a reason", () => {
    const result = recallFormSchema.safeParse(validInput({ reason: "" }));
    expect(result.success).toBe(false);
  });

  it("requires a due date", () => {
    const result = recallFormSchema.safeParse(validInput({ due_date: "" }));
    expect(result.success).toBe(false);
  });

  it("accepts a valid due date", () => {
    const result = recallFormSchema.safeParse(validInput({ due_date: "2027-02-01" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.due_date).toBe("2027-02-01");
    }
  });

  it("rejects an invalid due date", () => {
    const result = recallFormSchema.safeParse(validInput({ due_date: "not-a-date" }));
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid submission", () => {
    const result = recallFormSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });
});

describe("recallFormSchema — optional fields", () => {
  it("allows an omitted doctor", () => {
    const result = recallFormSchema.safeParse(validInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.doctor_id).toBeNull();
    }
  });

  it("allows an omitted procedure (visit_type_id)", () => {
    const result = recallFormSchema.safeParse(validInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visit_type_id).toBeNull();
    }
  });

  it("allows omitted notes", () => {
    const result = recallFormSchema.safeParse(validInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("normalizes an empty-string doctor_id to null", () => {
    const result = recallFormSchema.safeParse(validInput({ doctor_id: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.doctor_id).toBeNull();
    }
  });

  it("normalizes an empty-string visit_type_id to null", () => {
    const result = recallFormSchema.safeParse(validInput({ visit_type_id: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visit_type_id).toBeNull();
    }
  });

  it("normalizes empty-string notes to undefined", () => {
    const result = recallFormSchema.safeParse(validInput({ notes: "" }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("trims provided notes", () => {
    const result = recallFormSchema.safeParse(validInput({ notes: "  patient requested morning slot  " }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("patient requested morning slot");
    }
  });

  it("keeps a provided doctor_id", () => {
    const result = recallFormSchema.safeParse(validInput({ doctor_id: VALID_UUID }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.doctor_id).toBe(VALID_UUID);
    }
  });
});

describe("recallFormValuesFromFormData — FormData parsing", () => {
  it("parses a fully populated form", () => {
    const formData = new FormData();
    formData.set("patient_id", VALID_UUID);
    formData.set("reason", "Post-op review");
    formData.set("due_date", "2027-01-15");
    formData.set("doctor_id", VALID_UUID);
    formData.set("visit_type_id", VALID_UUID);
    formData.set("notes", "Check healing");

    expect(recallFormValuesFromFormData(formData)).toEqual({
      patient_id: VALID_UUID,
      reason: "Post-op review",
      due_date: "2027-01-15",
      doctor_id: VALID_UUID,
      visit_type_id: VALID_UUID,
      notes: "Check healing",
    });
  });

  it("normalizes missing optional fields to null/undefined rather than throwing", () => {
    const formData = new FormData();
    formData.set("patient_id", VALID_UUID);
    formData.set("reason", "6-month hygiene recall");
    formData.set("due_date", "2027-02-01");

    expect(recallFormValuesFromFormData(formData)).toEqual({
      patient_id: VALID_UUID,
      reason: "6-month hygiene recall",
      due_date: "2027-02-01",
      doctor_id: null,
      visit_type_id: null,
      notes: undefined,
    });
  });
});
