import { describe, it, expect } from "vitest";
import {
  closeCompensationRuleFormSchema,
  closeCompensationRuleFormValuesFromFormData,
  compensationRuleFormSchema,
  compensationRuleFormValuesFromFormData,
} from "@/lib/compensation/schema";

describe("compensationRuleFormSchema", () => {
  it("accepts a valid percentage rule", () => {
    const result = compensationRuleFormSchema.safeParse({ type: "percentage", rate: 30 });
    expect(result.success).toBe(true);
  });

  it("rejects a percentage rule with no rate", () => {
    const result = compensationRuleFormSchema.safeParse({ type: "percentage" });
    expect(result.success).toBe(false);
  });

  it("rejects a rate outside 0-100", () => {
    expect(compensationRuleFormSchema.safeParse({ type: "percentage", rate: -1 }).success).toBe(false);
    expect(compensationRuleFormSchema.safeParse({ type: "percentage", rate: 101 }).success).toBe(false);
  });

  it("accepts a valid fixed rule", () => {
    const result = compensationRuleFormSchema.safeParse({ type: "fixed", amount: 150 });
    expect(result.success).toBe(true);
  });

  it("rejects a fixed rule with no amount", () => {
    const result = compensationRuleFormSchema.safeParse({ type: "fixed" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative fixed amount", () => {
    expect(compensationRuleFormSchema.safeParse({ type: "fixed", amount: -10 }).success).toBe(false);
  });

  it("accepts a hybrid rule with only a base_amount, or only a rate, or both", () => {
    expect(compensationRuleFormSchema.safeParse({ type: "hybrid", base_amount: 50 }).success).toBe(true);
    expect(compensationRuleFormSchema.safeParse({ type: "hybrid", rate: 10 }).success).toBe(true);
    expect(compensationRuleFormSchema.safeParse({ type: "hybrid", base_amount: 50, rate: 10 }).success).toBe(true);
  });

  it("rejects a hybrid rule with neither base_amount nor rate", () => {
    expect(compensationRuleFormSchema.safeParse({ type: "hybrid" }).success).toBe(false);
  });

  it("rejects an invalid type", () => {
    expect(compensationRuleFormSchema.safeParse({ type: "commission", rate: 10 }).success).toBe(false);
  });

  it("passes when doctor_id and visit_type_id are omitted (clinic-wide default)", () => {
    const result = compensationRuleFormSchema.safeParse({ type: "percentage", rate: 30 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.doctor_id).toBeUndefined();
      expect(result.data.visit_type_id).toBeUndefined();
    }
  });

  it("coerces numeric strings, as FormData would provide", () => {
    const result = compensationRuleFormSchema.safeParse({ type: "percentage", rate: "30" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rate).toBe(30);
  });
});

describe("compensationRuleFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("doctor_id", "doctor-1");
    formData.set("visit_type_id", "visit-type-1");
    formData.set("type", "hybrid");
    formData.set("rate", "10");
    formData.set("base_amount", "50");
    formData.set("effective_from", "2026-01-01");

    const values = compensationRuleFormValuesFromFormData(formData);
    expect(values).toEqual({
      doctor_id: "doctor-1",
      visit_type_id: "visit-type-1",
      type: "hybrid",
      rate: "10",
      amount: undefined,
      base_amount: "50",
      effective_from: "2026-01-01",
    });
  });

  it("defaults type to percentage and leaves everything else undefined when missing", () => {
    const formData = new FormData();
    const values = compensationRuleFormValuesFromFormData(formData);
    expect(values.type).toBe("percentage");
    expect(values.doctor_id).toBeUndefined();
    expect(values.rate).toBeUndefined();
  });
});

describe("closeCompensationRuleFormSchema", () => {
  it("passes with an effective_to date", () => {
    expect(closeCompensationRuleFormSchema.safeParse({ effective_to: "2026-02-01" }).success).toBe(true);
  });

  it("passes when effective_to is omitted (defaults to today at the action layer)", () => {
    expect(closeCompensationRuleFormSchema.safeParse({}).success).toBe(true);
  });
});

describe("closeCompensationRuleFormValuesFromFormData", () => {
  it("extracts effective_to", () => {
    const formData = new FormData();
    formData.set("effective_to", "2026-02-01");
    expect(closeCompensationRuleFormValuesFromFormData(formData)).toEqual({ effective_to: "2026-02-01" });
  });
});
