import { describe, it, expect } from "vitest";
import { visitTypeFormSchema, visitTypeFormValuesFromFormData } from "@/lib/procedures/visit-type-schema";

const VALID = {
  name: "Root Canal",
  category: "Endodontic",
  default_duration_minutes: "60",
  price: "1500",
  billing_code: "D3310",
  color: "#6366f1",
};

describe("visitTypeFormSchema", () => {
  it("parses valid values successfully", () => {
    const result = visitTypeFormSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: "Root Canal",
        category: "Endodontic",
        default_duration_minutes: 60,
        price: 1500,
        billing_code: "D3310",
        color: "#6366f1",
      });
    }
  });

  it("trims surrounding whitespace on the name", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, name: "  Cleaning  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Cleaning");
    }
  });

  it("fails on an empty name", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, name: "" });
    expect(result.success).toBe(false);
  });

  it("fails when the name exceeds 50 characters", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, name: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("fails when duration is below 5 minutes", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, default_duration_minutes: "4" });
    expect(result.success).toBe(false);
  });

  it("fails when duration exceeds 480 minutes", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, default_duration_minutes: "481" });
    expect(result.success).toBe(false);
  });

  it("fails when duration is not a whole number", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, default_duration_minutes: "30.5" });
    expect(result.success).toBe(false);
  });

  it("fails on a malformed hex color", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, color: "blue" });
    expect(result.success).toBe(false);
  });

  it("fails on a short hex color", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, color: "#fff" });
    expect(result.success).toBe(false);
  });

  it("allows a blank category, normalizing it to null", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, category: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBeNull();
    }
  });

  it("trims the category and treats whitespace-only as blank", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, category: "   " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBeNull();
    }
  });

  it("fails when category exceeds 50 characters", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, category: "x".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("allows a blank billing code, normalizing it to null", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, billing_code: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billing_code).toBeNull();
    }
  });

  it("fails when billing code exceeds 32 characters", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, billing_code: "x".repeat(33) });
    expect(result.success).toBe(false);
  });

  it("defaults price to a valid number and rejects negative prices", () => {
    expect(visitTypeFormSchema.safeParse({ ...VALID, price: "0" }).success).toBe(true);
    expect(visitTypeFormSchema.safeParse({ ...VALID, price: "-1" }).success).toBe(false);
  });

  it("allows an empty recall interval, normalizing it to undefined (no automatic recall)", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, recall_interval_months: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recall_interval_months).toBeUndefined();
    }
  });

  it("parses a configured recall interval as a whole number", () => {
    const result = visitTypeFormSchema.safeParse({ ...VALID, recall_interval_months: "6" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recall_interval_months).toBe(6);
    }
  });

  it("rejects a zero or negative recall interval", () => {
    expect(visitTypeFormSchema.safeParse({ ...VALID, recall_interval_months: "0" }).success).toBe(false);
    expect(visitTypeFormSchema.safeParse({ ...VALID, recall_interval_months: "-3" }).success).toBe(false);
  });

  it("rejects a fractional recall interval", () => {
    expect(visitTypeFormSchema.safeParse({ ...VALID, recall_interval_months: "1.5" }).success).toBe(false);
  });
});

describe("visitTypeFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("name", "Extraction");
    formData.set("category", "Surgical");
    formData.set("default_duration_minutes", "45");
    formData.set("price", "800");
    formData.set("billing_code", "D7140");
    formData.set("color", "#22c55e");
    formData.set("recall_interval_months", "6");
    expect(visitTypeFormValuesFromFormData(formData)).toEqual({
      name: "Extraction",
      category: "Surgical",
      default_duration_minutes: "45",
      price: "800",
      billing_code: "D7140",
      color: "#22c55e",
      recall_interval_months: "6",
    });
  });

  it("defaults missing fields to their empty/zero fallback", () => {
    const formData = new FormData();
    expect(visitTypeFormValuesFromFormData(formData)).toEqual({
      name: "",
      category: "",
      default_duration_minutes: "",
      price: "0",
      billing_code: "",
      color: "#6366f1",
      recall_interval_months: "",
    });
  });
});
