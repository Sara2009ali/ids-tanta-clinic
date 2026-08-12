import { describe, it, expect } from "vitest";
import {
  doctorCreateFormSchema,
  doctorCreateFormValuesFromFormData,
  doctorEditFormSchema,
  doctorEditFormValuesFromFormData,
} from "@/lib/doctors/schema";

describe("doctorCreateFormSchema", () => {
  const valid = {
    full_name: "Dr. Karim Youssef",
    phone: "0100000000",
    email: "karim@clinic.com",
    specialty: "Orthodontics",
    license_number: "LIC-123",
  };

  it("parses valid values successfully", () => {
    const result = doctorCreateFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("fails on an empty name", () => {
    expect(doctorCreateFormSchema.safeParse({ ...valid, full_name: "" }).success).toBe(false);
  });

  it("fails when the name exceeds 100 characters", () => {
    expect(doctorCreateFormSchema.safeParse({ ...valid, full_name: "x".repeat(101) }).success).toBe(false);
  });

  it("requires an email", () => {
    expect(doctorCreateFormSchema.safeParse({ ...valid, email: "" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(doctorCreateFormSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("passes when phone/specialty/license_number are omitted", () => {
    const { phone, specialty, license_number, ...rest } = valid;
    void phone;
    void specialty;
    void license_number;
    const result = doctorCreateFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
      expect(result.data.specialty).toBeUndefined();
      expect(result.data.license_number).toBeUndefined();
    }
  });

  it("trims whitespace-only optional fields to undefined", () => {
    const result = doctorCreateFormSchema.safeParse({ ...valid, specialty: "   " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.specialty).toBeUndefined();
  });
});

describe("doctorCreateFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("full_name", "Dr. Karim Youssef");
    formData.set("phone", "0100000000");
    formData.set("email", "karim@clinic.com");
    formData.set("specialty", "Orthodontics");
    formData.set("license_number", "LIC-123");

    expect(doctorCreateFormValuesFromFormData(formData)).toEqual({
      full_name: "Dr. Karim Youssef",
      phone: "0100000000",
      email: "karim@clinic.com",
      specialty: "Orthodontics",
      license_number: "LIC-123",
    });
  });

  it("defaults name/email to empty strings and leaves the rest undefined when missing", () => {
    const formData = new FormData();
    expect(doctorCreateFormValuesFromFormData(formData)).toEqual({
      full_name: "",
      phone: undefined,
      email: "",
      specialty: undefined,
      license_number: undefined,
    });
  });
});

describe("doctorEditFormSchema", () => {
  const valid = {
    full_name: "Dr. Karim Youssef",
    phone: "0100000000",
    specialty: "Orthodontics",
    license_number: "LIC-123",
    bio: "15 years of experience.",
    color: "#6366f1",
  };

  it("parses valid values successfully", () => {
    expect(doctorEditFormSchema.safeParse(valid).success).toBe(true);
  });

  it("fails on an empty name", () => {
    expect(doctorEditFormSchema.safeParse({ ...valid, full_name: "" }).success).toBe(false);
  });

  it("fails on a malformed hex color", () => {
    expect(doctorEditFormSchema.safeParse({ ...valid, color: "blue" }).success).toBe(false);
  });

  it("has no email field even if one is passed", () => {
    const result = doctorEditFormSchema.safeParse({ ...valid, email: "karim@clinic.com" });
    expect(result.success).toBe(true);
    if (result.success) expect((result.data as Record<string, unknown>).email).toBeUndefined();
  });
});

describe("doctorEditFormValuesFromFormData", () => {
  it("extracts every field, defaulting color to the fallback swatch when missing", () => {
    const formData = new FormData();
    formData.set("full_name", "Dr. Karim Youssef");

    const values = doctorEditFormValuesFromFormData(formData);
    expect(values.full_name).toBe("Dr. Karim Youssef");
    expect(values.color).toBe("#6366f1");
  });
});
