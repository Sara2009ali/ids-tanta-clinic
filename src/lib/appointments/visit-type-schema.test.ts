import { describe, it, expect } from "vitest";
import { visitTypeFormSchema, visitTypeFormValuesFromFormData } from "@/lib/appointments/visit-type-schema";

describe("visitTypeFormSchema", () => {
  it("parses valid values successfully", () => {
    const result = visitTypeFormSchema.safeParse({
      name: "Root Canal",
      default_duration_minutes: "60",
      color: "#6366f1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Root Canal", default_duration_minutes: 60, color: "#6366f1" });
    }
  });

  it("trims surrounding whitespace on the name", () => {
    const result = visitTypeFormSchema.safeParse({
      name: "  Cleaning  ",
      default_duration_minutes: "30",
      color: "#6366f1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Cleaning");
    }
  });

  it("fails on an empty name", () => {
    const result = visitTypeFormSchema.safeParse({ name: "", default_duration_minutes: "30", color: "#6366f1" });
    expect(result.success).toBe(false);
  });

  it("fails when the name exceeds 50 characters", () => {
    const result = visitTypeFormSchema.safeParse({
      name: "x".repeat(51),
      default_duration_minutes: "30",
      color: "#6366f1",
    });
    expect(result.success).toBe(false);
  });

  it("fails when duration is below 5 minutes", () => {
    const result = visitTypeFormSchema.safeParse({ name: "Checkup", default_duration_minutes: "4", color: "#6366f1" });
    expect(result.success).toBe(false);
  });

  it("fails when duration exceeds 480 minutes", () => {
    const result = visitTypeFormSchema.safeParse({
      name: "Checkup",
      default_duration_minutes: "481",
      color: "#6366f1",
    });
    expect(result.success).toBe(false);
  });

  it("fails when duration is not a whole number", () => {
    const result = visitTypeFormSchema.safeParse({
      name: "Checkup",
      default_duration_minutes: "30.5",
      color: "#6366f1",
    });
    expect(result.success).toBe(false);
  });

  it("fails on a malformed hex color", () => {
    const result = visitTypeFormSchema.safeParse({ name: "Checkup", default_duration_minutes: "30", color: "blue" });
    expect(result.success).toBe(false);
  });

  it("fails on a short hex color", () => {
    const result = visitTypeFormSchema.safeParse({ name: "Checkup", default_duration_minutes: "30", color: "#fff" });
    expect(result.success).toBe(false);
  });
});

describe("visitTypeFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("name", "Extraction");
    formData.set("default_duration_minutes", "45");
    formData.set("color", "#22c55e");
    expect(visitTypeFormValuesFromFormData(formData)).toEqual({
      name: "Extraction",
      default_duration_minutes: "45",
      color: "#22c55e",
    });
  });

  it("defaults name and duration to empty strings and color to the fallback swatch when missing", () => {
    const formData = new FormData();
    expect(visitTypeFormValuesFromFormData(formData)).toEqual({
      name: "",
      default_duration_minutes: "",
      color: "#6366f1",
    });
  });
});
