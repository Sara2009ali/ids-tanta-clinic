import { describe, it, expect } from "vitest";
import { patientFormSchema, patientFormValuesFromFormData } from "@/lib/patients/schema";

const validInput = {
  first_name: "John",
  last_name: "Doe",
  date_of_birth: "1990-01-01",
  gender: "male",
  phone: "01012345678",
  email: "john@example.com",
  address: "123 Street",
  national_id: "12345678901234",
  occupation: "Engineer",
  emergency_contact_name: "Jane Doe",
  emergency_contact_phone: "01099999999",
  allergies: ["penicillin"],
  current_medications: ["aspirin"],
  medical_conditions: ["asthma"],
  is_pregnant: false,
  is_smoker: false,
  has_hypertension: false,
  has_diabetes: false,
  has_heart_disease: false,
  has_bleeding_disorder: false,
  clinical_notes: "notes",
  chief_complaint: "pain",
  referral_source: "friend",
  preferred_dentist_id: "doctor-1",
  insurance_provider: "Acme",
  insurance_policy_number: "POL123",
};

describe("patientFormSchema", () => {
  it("parses a valid full input successfully", () => {
    const result = patientFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("fails when first_name is missing", () => {
    const { first_name, ...rest } = validInput;
    void first_name;
    const result = patientFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("fails when last_name is missing", () => {
    const { last_name, ...rest } = validInput;
    void last_name;
    const result = patientFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("fails on an invalid email format", () => {
    const result = patientFormSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("fails on a future date_of_birth", () => {
    const result = patientFormSchema.safeParse({ ...validInput, date_of_birth: "2999-01-01" });
    expect(result.success).toBe(false);
  });

  it("passes when all optional fields are omitted", () => {
    const result = patientFormSchema.safeParse({
      first_name: "John",
      last_name: "Doe",
    });
    expect(result.success).toBe(true);
  });
});

describe("patientFormValuesFromFormData", () => {
  function buildFormData(entries: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entries)) {
      formData.set(key, value);
    }
    return formData;
  }

  it("parses a submitted form into the shape patientFormSchema expects", () => {
    const formData = buildFormData({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      allergies: "peanuts, latex",
      is_pregnant: "on",
      is_smoker: "false",
    });

    const values = patientFormValuesFromFormData(formData);

    expect(values.first_name).toBe("John");
    expect(values.last_name).toBe("Doe");
    expect(values.allergies).toEqual(["peanuts", "latex"]);
    expect(values.is_pregnant).toBe(true);
    expect(values.is_smoker).toBe(false);

    const result = patientFormSchema.safeParse(values);
    expect(result.success).toBe(true);
  });

  it("produces a value that fails validation when required fields are absent", () => {
    const formData = buildFormData({ email: "john@example.com" });
    const values = patientFormValuesFromFormData(formData);

    expect(values.first_name).toBe("");
    expect(values.last_name).toBe("");

    const result = patientFormSchema.safeParse(values);
    expect(result.success).toBe(false);
  });
});
