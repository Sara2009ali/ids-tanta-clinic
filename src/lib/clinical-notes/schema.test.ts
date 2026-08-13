import { describe, it, expect } from "vitest";
import { clinicalNoteFormSchema, clinicalNoteFormValuesFromFormData } from "@/lib/clinical-notes/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("clinicalNoteFormSchema", () => {
  it("parses a valid note with no appointment successfully", () => {
    const result = clinicalNoteFormSchema.safeParse({
      note: "Reviewed panoramic X-ray. No obvious carious lesions. Monitor lower third molar.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointment_id).toBeUndefined();
    }
  });

  it("parses a valid note with a linked appointment", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "Patient tolerated procedure well.", appointment_id: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointment_id).toBe(VALID_UUID);
    }
  });

  it("rejects an empty note", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only note", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "   \n\t  " });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace on a valid note", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "  Follow up in two weeks.  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.note).toBe("Follow up in two weeks.");
    }
  });

  it("treats an empty appointment_id as no appointment selected", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "No linked appointment.", appointment_id: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointment_id).toBeUndefined();
    }
  });

  it("fails when the note exceeds 4000 characters", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "x".repeat(4001) });
    expect(result.success).toBe(false);
  });

  it("passes at exactly the 4000-character note limit", () => {
    const result = clinicalNoteFormSchema.safeParse({ note: "x".repeat(4000) });
    expect(result.success).toBe(true);
  });
});

describe("clinicalNoteFormValuesFromFormData", () => {
  it("extracts both fields from a populated form", () => {
    const formData = new FormData();
    formData.set("note", "Some note");
    formData.set("appointment_id", VALID_UUID);
    expect(clinicalNoteFormValuesFromFormData(formData)).toEqual({
      note: "Some note",
      appointment_id: VALID_UUID,
    });
  });

  it("defaults note to an empty string and appointment_id to undefined when missing", () => {
    const formData = new FormData();
    expect(clinicalNoteFormValuesFromFormData(formData)).toEqual({ note: "", appointment_id: undefined });
  });
});
