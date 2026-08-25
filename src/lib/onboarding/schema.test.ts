import { describe, it, expect } from "vitest";
import {
  signUpFormSchema,
  signUpFormValuesFromFormData,
  generateClinicSlug,
  canSelfServeSignUp,
  CLINIC_TIMEZONE_OPTIONS,
} from "@/lib/onboarding/schema";

describe("signUpFormSchema", () => {
  const valid = {
    clinic_name: "IDS Tanta",
    address: "12 Nile St, Tanta",
    timezone: "Africa/Cairo",
    full_name: "Sara Emara",
    email: "sara@idstanta.com",
    password: "supersecret1",
    confirm_password: "supersecret1",
  };

  it("parses valid values successfully", () => {
    expect(signUpFormSchema.safeParse(valid).success).toBe(true);
  });

  it("fails on an empty clinic name", () => {
    expect(signUpFormSchema.safeParse({ ...valid, clinic_name: "" }).success).toBe(false);
  });

  it("fails on a malformed email", () => {
    expect(signUpFormSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("fails on a password shorter than 8 characters", () => {
    expect(signUpFormSchema.safeParse({ ...valid, password: "short1", confirm_password: "short1" }).success).toBe(false);
  });

  it("fails when password and confirm_password don't match", () => {
    const result = signUpFormSchema.safeParse({ ...valid, confirm_password: "somethingElse1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes("confirm_password"))).toBe(true);
    }
  });

  it("fails on a timezone outside the supported list", () => {
    expect(signUpFormSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("passes when address is omitted", () => {
    const { address, ...rest } = valid;
    void address;
    const result = signUpFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address).toBeUndefined();
  });
});

describe("signUpFormValuesFromFormData", () => {
  it("extracts every field, defaulting timezone to Africa/Cairo when missing", () => {
    const formData = new FormData();
    formData.set("clinic_name", "IDS Tanta");
    formData.set("full_name", "Sara Emara");
    formData.set("email", "sara@idstanta.com");
    formData.set("password", "supersecret1");
    formData.set("confirm_password", "supersecret1");

    const values = signUpFormValuesFromFormData(formData);
    expect(values.clinic_name).toBe("IDS Tanta");
    expect(values.timezone).toBe("Africa/Cairo");
    expect(values.address).toBeUndefined();
  });
});

describe("generateClinicSlug", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(generateClinicSlug("IDS Tanta", [])).toBe("ids-tanta");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(generateClinicSlug("  Dr. Adel's Clinic!!  ", [])).toBe("dr-adel-s-clinic");
  });

  it("falls back to 'clinic' when the name has no ASCII-alphanumeric characters", () => {
    expect(generateClinicSlug("عيادة الأسنان", [])).toBe("clinic");
  });

  it("appends a numeric suffix on collision", () => {
    expect(generateClinicSlug("IDS Tanta", ["ids-tanta"])).toBe("ids-tanta-2");
  });

  it("keeps incrementing the suffix until a free slug is found", () => {
    expect(generateClinicSlug("IDS Tanta", ["ids-tanta", "ids-tanta-2", "ids-tanta-3"])).toBe("ids-tanta-4");
  });

  it("truncates very long names before deduplicating", () => {
    const slug = generateClinicSlug("a".repeat(200), []);
    expect(slug.length).toBeLessThanOrEqual(60);
  });
});

describe("canSelfServeSignUp", () => {
  it("allows sign-up when there is no existing staff profile", () => {
    expect(canSelfServeSignUp(null)).toBe(true);
  });

  it("rejects sign-up for someone who already has a staff profile", () => {
    expect(canSelfServeSignUp({ id: "staff-1" })).toBe(false);
  });
});

describe("CLINIC_TIMEZONE_OPTIONS", () => {
  it("defaults to Africa/Cairo first, matching the clinics.timezone column default", () => {
    expect(CLINIC_TIMEZONE_OPTIONS[0]).toBe("Africa/Cairo");
  });
});
