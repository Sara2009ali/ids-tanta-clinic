import { describe, it, expect } from "vitest";
import {
  fdiNumberSchema,
  nullableFdiNumberSchema,
  toothConditionSchema,
  toothEventTypeSchema,
  toothObservationFormSchema,
  toothObservationFormValuesFromFormData,
  toothStateFormSchema,
  toothStateFormValuesFromFormData,
  toothStatusSchema,
} from "@/lib/dental-chart/schema";

describe("fdiNumberSchema", () => {
  it("accepts and coerces a valid FDI code", () => {
    const result = fdiNumberSchema.safeParse("36");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(36);
  });

  it("accepts a valid primary-dentition code", () => {
    expect(fdiNumberSchema.safeParse("55").success).toBe(true);
  });

  it("rejects a syntactically plausible but nonexistent code", () => {
    expect(fdiNumberSchema.safeParse("19").success).toBe(false);
  });

  it("rejects a non-numeric value", () => {
    expect(fdiNumberSchema.safeParse("upper right").success).toBe(false);
  });
});

describe("nullableFdiNumberSchema", () => {
  it("treats an empty string as null", () => {
    const result = nullableFdiNumberSchema.safeParse("");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("treats an omitted value (undefined) as null, not a validation error", () => {
    const result = nullableFdiNumberSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("still rejects an invalid non-empty code", () => {
    expect(nullableFdiNumberSchema.safeParse("99").success).toBe(false);
  });
});

describe("toothStatusSchema / toothConditionSchema / toothEventTypeSchema", () => {
  it("accepts every valid status", () => {
    for (const value of ["present", "missing", "unerupted"]) {
      expect(toothStatusSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an invalid status", () => {
    expect(toothStatusSchema.safeParse("extracted").success).toBe(false);
  });

  it("accepts exactly the six approved condition values", () => {
    for (const value of ["caries", "filling", "crown", "root_canal", "watch", "other"]) {
      expect(toothConditionSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects a condition value outside the approved six — no invented taxonomy", () => {
    expect(toothConditionSchema.safeParse("periodontal_disease").success).toBe(false);
    expect(toothConditionSchema.safeParse("implant").success).toBe(false);
  });

  it("accepts exactly the two approved event types", () => {
    expect(toothEventTypeSchema.safeParse("observation").success).toBe(true);
    expect(toothEventTypeSchema.safeParse("state_changed").success).toBe(true);
  });

  it("rejects an event type outside the approved two", () => {
    expect(toothEventTypeSchema.safeParse("note").success).toBe(false);
    expect(toothEventTypeSchema.safeParse("diagnosis").success).toBe(false);
  });
});

describe("toothStateFormSchema", () => {
  it("defaults status to present and condition to null when both are omitted", () => {
    const result = toothStateFormSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("present");
      expect(result.data.condition).toBeNull();
    }
  });

  it("treats an empty-string condition (the form's 'no condition' option) as null, a healthy tooth", () => {
    const result = toothStateFormSchema.safeParse({ status: "present", condition: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.condition).toBeNull();
  });

  it("accepts marking a tooth missing with no condition", () => {
    const result = toothStateFormSchema.safeParse({ status: "missing" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("missing");
  });

  it("rejects an arbitrary condition string — never freeform", () => {
    const result = toothStateFormSchema.safeParse({ status: "present", condition: "bone loss" });
    expect(result.success).toBe(false);
  });

  it("trims notes and drops an empty notes field to undefined", () => {
    const result = toothStateFormSchema.safeParse({ notes: "  watching for progression  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.notes).toBe("watching for progression");
  });
});

describe("toothObservationFormSchema", () => {
  it("requires non-empty notes", () => {
    expect(toothObservationFormSchema.safeParse({ notes: "" }).success).toBe(false);
  });

  it("accepts a plain observation with no appointment", () => {
    const result = toothObservationFormSchema.safeParse({ notes: "Watching a small area of demineralization." });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.appointment_id).toBeUndefined();
  });

  it("accepts an optional appointment_id", () => {
    const result = toothObservationFormSchema.safeParse({ notes: "Noted during exam.", appointment_id: "abc-123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.appointment_id).toBe("abc-123");
  });
});

describe("toothStateFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("status", "missing");
    formData.set("condition", "caries");
    formData.set("notes", "Extracted last visit");
    expect(toothStateFormValuesFromFormData(formData)).toEqual({
      status: "missing",
      condition: "caries",
      notes: "Extracted last visit",
    });
  });

  it("defaults sensibly when the form is empty", () => {
    const formData = new FormData();
    expect(toothStateFormValuesFromFormData(formData)).toEqual({
      status: "present",
      condition: "",
      notes: undefined,
    });
  });
});

describe("toothObservationFormValuesFromFormData", () => {
  it("extracts notes and appointment_id", () => {
    const formData = new FormData();
    formData.set("notes", "Small lesion noted");
    formData.set("appointment_id", "appt-1");
    expect(toothObservationFormValuesFromFormData(formData)).toEqual({
      notes: "Small lesion noted",
      appointment_id: "appt-1",
    });
  });

  it("defaults to an empty notes string and undefined appointment_id when missing", () => {
    const formData = new FormData();
    expect(toothObservationFormValuesFromFormData(formData)).toEqual({
      notes: "",
      appointment_id: undefined,
    });
  });
});
