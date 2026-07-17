import { describe, it, expect } from "vitest";
import { chairFormSchema, chairFormValuesFromFormData } from "@/lib/appointments/chair-schema";

describe("chairFormSchema", () => {
  it("parses a valid label successfully", () => {
    const result = chairFormSchema.safeParse({ label: "Chair 3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).toBe("Chair 3");
    }
  });

  it("trims surrounding whitespace", () => {
    const result = chairFormSchema.safeParse({ label: "  Chair 3  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.label).toBe("Chair 3");
    }
  });

  it("fails on an empty label", () => {
    const result = chairFormSchema.safeParse({ label: "" });
    expect(result.success).toBe(false);
  });

  it("fails on a whitespace-only label", () => {
    const result = chairFormSchema.safeParse({ label: "   " });
    expect(result.success).toBe(false);
  });

  it("fails when the label exceeds 50 characters", () => {
    const result = chairFormSchema.safeParse({ label: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("passes at exactly the 50-character limit", () => {
    const result = chairFormSchema.safeParse({ label: "x".repeat(50) });
    expect(result.success).toBe(true);
  });
});

describe("chairFormValuesFromFormData", () => {
  it("extracts the label from a populated form", () => {
    const formData = new FormData();
    formData.set("label", "Chair 5");
    expect(chairFormValuesFromFormData(formData)).toEqual({ label: "Chair 5" });
  });

  it("defaults to an empty string when the field is missing", () => {
    const formData = new FormData();
    expect(chairFormValuesFromFormData(formData)).toEqual({ label: "" });
  });
});
