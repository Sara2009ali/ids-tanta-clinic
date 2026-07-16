import { describe, it, expect } from "vitest";
import { appointmentFormSchema, appointmentFormValuesFromFormData } from "@/lib/appointments/schema";

const validInput = {
  patient_id: "patient-1",
  doctor_id: "doctor-1",
  chair_id: "chair-1",
  visit_type_id: "visit-type-1",
  scheduled_date: "2026-07-10",
  scheduled_time: "10:00",
  duration_minutes: 30,
  priority: "high",
  is_emergency: false,
  chief_complaint: "Tooth pain",
  notes: "Bring x-ray",
};

describe("appointmentFormSchema", () => {
  it("parses a valid full input successfully, including a computed scheduled_start", () => {
    const result = appointmentFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scheduled_start).toBe(new Date("2026-07-10T10:00").toISOString());
      expect(result.data.chair_id).toBe("chair-1");
      expect(result.data.priority).toBe("high");
    }
  });

  it("passes when chair_id is omitted (optional field)", () => {
    const { chair_id, ...rest } = validInput;
    void chair_id;
    const result = appointmentFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.chair_id).toBeUndefined();
    }
  });

  it.each(["patient_id", "doctor_id", "visit_type_id", "scheduled_date", "scheduled_time"] as const)(
    "fails when %s is an empty string",
    (field) => {
      const result = appointmentFormSchema.safeParse({ ...validInput, [field]: "" });
      expect(result.success).toBe(false);
    },
  );

  it("fails when duration_minutes is below 5", () => {
    const result = appointmentFormSchema.safeParse({ ...validInput, duration_minutes: 4 });
    expect(result.success).toBe(false);
  });

  it("fails when duration_minutes is above 480", () => {
    const result = appointmentFormSchema.safeParse({ ...validInput, duration_minutes: 481 });
    expect(result.success).toBe(false);
  });

  it("fails when duration_minutes is not an integer", () => {
    const result = appointmentFormSchema.safeParse({ ...validInput, duration_minutes: "10.5" });
    expect(result.success).toBe(false);
  });

  it("fails when duration_minutes is non-numeric", () => {
    const result = appointmentFormSchema.safeParse({ ...validInput, duration_minutes: "not-a-number" });
    expect(result.success).toBe(false);
  });

  it("coerces a valid numeric string duration_minutes (as FormData would provide)", () => {
    const result = appointmentFormSchema.safeParse({ ...validInput, duration_minutes: "30" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration_minutes).toBe(30);
    }
  });

  it("fails on an invalid priority value", () => {
    const result = appointmentFormSchema.safeParse({ ...validInput, priority: "critical" });
    expect(result.success).toBe(false);
  });

  it("defaults priority to normal when omitted", () => {
    const { priority, ...rest } = validInput;
    void priority;
    const result = appointmentFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe("normal");
    }
  });

  it("defaults is_emergency to false when omitted", () => {
    const { is_emergency, ...rest } = validInput;
    void is_emergency;
    const result = appointmentFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_emergency).toBe(false);
    }
  });

  it("fails when the date/time combination is unparseable", () => {
    const result = appointmentFormSchema.safeParse({
      ...validInput,
      scheduled_date: "not-a-date",
      scheduled_time: "10:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("scheduled_time");
    }
  });
});

describe("appointmentFormValuesFromFormData", () => {
  function buildFormData(entries: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entries)) {
      formData.append(key, value);
    }
    return formData;
  }

  it("extracts every field correctly from a fully populated form", () => {
    const formData = buildFormData({
      patient_id: "patient-1",
      doctor_id: "doctor-1",
      chair_id: "chair-1",
      visit_type_id: "visit-type-1",
      scheduled_date: "2026-07-10",
      scheduled_time: "10:00",
      duration_minutes: "30",
      priority: "urgent",
      is_emergency: "on",
      chief_complaint: "Tooth pain",
      notes: "Bring x-ray",
    });

    const values = appointmentFormValuesFromFormData(formData);

    expect(values).toEqual({
      patient_id: "patient-1",
      doctor_id: "doctor-1",
      chair_id: "chair-1",
      visit_type_id: "visit-type-1",
      scheduled_date: "2026-07-10",
      scheduled_time: "10:00",
      duration_minutes: "30",
      priority: "urgent",
      is_emergency: true,
      chief_complaint: "Tooth pain",
      notes: "Bring x-ray",
    });

    const result = appointmentFormSchema.safeParse(values);
    expect(result.success).toBe(true);
  });

  it("maps an absent is_emergency checkbox to false", () => {
    const formData = buildFormData({
      patient_id: "patient-1",
      doctor_id: "doctor-1",
      visit_type_id: "visit-type-1",
      scheduled_date: "2026-07-10",
      scheduled_time: "10:00",
      duration_minutes: "30",
    });

    const values = appointmentFormValuesFromFormData(formData);
    expect(values.is_emergency).toBe(false);
  });

  it("defaults missing fields to empty strings, undefined optionals, and priority normal", () => {
    const formData = new FormData();
    const values = appointmentFormValuesFromFormData(formData);

    expect(values.patient_id).toBe("");
    expect(values.doctor_id).toBe("");
    expect(values.visit_type_id).toBe("");
    expect(values.scheduled_date).toBe("");
    expect(values.scheduled_time).toBe("");
    expect(values.duration_minutes).toBe("");
    expect(values.priority).toBe("normal");
    expect(values.chair_id).toBeUndefined();
    expect(values.chief_complaint).toBeUndefined();
    expect(values.notes).toBeUndefined();
    expect(values.is_emergency).toBe(false);
  });
});
