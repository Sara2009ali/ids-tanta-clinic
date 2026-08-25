import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  clinicUpdateFormSchema,
  clinicUpdateFormValuesFromFormData,
  buildClinicLogoStoragePath,
  isStoragePathForClinic,
  extractClinicLogoStoragePath,
  validateClinicLogoFile,
  CLINIC_LOGOS_BUCKET,
  MAX_CLINIC_LOGO_BYTES,
} from "@/lib/clinic/schema";

describe("clinicUpdateFormSchema", () => {
  const valid = {
    name: "IDS Tanta",
    phone: "0403334444",
    address: "12 Nile St, Tanta",
    timezone: "Africa/Cairo",
  };

  it("parses valid values successfully", () => {
    expect(clinicUpdateFormSchema.safeParse(valid).success).toBe(true);
  });

  it("fails on an empty clinic name", () => {
    expect(clinicUpdateFormSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("fails when the name exceeds 120 characters", () => {
    expect(clinicUpdateFormSchema.safeParse({ ...valid, name: "x".repeat(121) }).success).toBe(false);
  });

  it("fails on a timezone outside the supported list", () => {
    expect(clinicUpdateFormSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("passes when phone/address are omitted", () => {
    const { phone, address, ...rest } = valid;
    void phone;
    void address;
    const result = clinicUpdateFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
      expect(result.data.address).toBeUndefined();
    }
  });
});

describe("clinicUpdateFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("name", "IDS Tanta");
    formData.set("phone", "0403334444");
    formData.set("address", "12 Nile St, Tanta");
    formData.set("timezone", "Africa/Cairo");

    expect(clinicUpdateFormValuesFromFormData(formData)).toEqual({
      name: "IDS Tanta",
      phone: "0403334444",
      address: "12 Nile St, Tanta",
      timezone: "Africa/Cairo",
    });
  });

  it("defaults name to empty and timezone to Africa/Cairo when missing", () => {
    expect(clinicUpdateFormValuesFromFormData(new FormData())).toEqual({
      name: "",
      phone: undefined,
      address: undefined,
      timezone: "Africa/Cairo",
    });
  });
});

describe("buildClinicLogoStoragePath", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefixes the path with the clinic id", () => {
    const path = buildClinicLogoStoragePath("clinic-42", "logo.png");
    expect(path.startsWith("clinic-42/")).toBe(true);
  });

  it("preserves the file extension, lowercased", () => {
    expect(buildClinicLogoStoragePath("clinic-1", "MyLogo.PNG")).toMatch(/\.png$/);
    expect(buildClinicLogoStoragePath("clinic-1", "logo.jpeg")).toMatch(/\.jpeg$/);
  });

  it("falls back to png when the file name has no extension", () => {
    expect(buildClinicLogoStoragePath("clinic-1", "logo")).toMatch(/\.png$/);
  });

  it("produces a different path for a second upload a moment later (cache-busting)", () => {
    const first = buildClinicLogoStoragePath("clinic-1", "logo.png");
    vi.advanceTimersByTime(1000);
    const second = buildClinicLogoStoragePath("clinic-1", "logo.png");
    expect(first).not.toBe(second);
  });
});

describe("isStoragePathForClinic", () => {
  it("accepts a path under the clinic's own folder", () => {
    expect(isStoragePathForClinic("clinic-42/logo-123.png", "clinic-42")).toBe(true);
  });

  it("rejects a path under a different clinic's folder", () => {
    expect(isStoragePathForClinic("clinic-99/logo-123.png", "clinic-42")).toBe(false);
  });

  it("rejects a path that merely starts with the clinic id as a string prefix without the folder separator", () => {
    expect(isStoragePathForClinic("clinic-42x/logo.png", "clinic-42")).toBe(false);
  });
});

describe("extractClinicLogoStoragePath", () => {
  it("extracts the path from a well-formed public bucket URL", () => {
    const url = `https://project.supabase.co/storage/v1/object/public/${CLINIC_LOGOS_BUCKET}/clinic-42/logo-123.png`;
    expect(extractClinicLogoStoragePath(url)).toBe("clinic-42/logo-123.png");
  });

  it("returns null for null/undefined", () => {
    expect(extractClinicLogoStoragePath(null)).toBeNull();
    expect(extractClinicLogoStoragePath(undefined)).toBeNull();
  });

  it("returns null for a URL that isn't a clinic-logos public object URL", () => {
    expect(extractClinicLogoStoragePath("https://example.com/some-other-image.png")).toBeNull();
  });

  it("decodes URL-encoded characters in the path", () => {
    const url = `https://project.supabase.co/storage/v1/object/public/${CLINIC_LOGOS_BUCKET}/clinic-42/logo%20final.png`;
    expect(extractClinicLogoStoragePath(url)).toBe("clinic-42/logo final.png");
  });
});

describe("validateClinicLogoFile", () => {
  it("accepts a small PNG", () => {
    expect(validateClinicLogoFile({ type: "image/png", size: 1024 })).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(validateClinicLogoFile({ type: "application/pdf", size: 1024 })).toBe("invalid_type");
  });

  it("rejects a file over the size limit", () => {
    expect(validateClinicLogoFile({ type: "image/png", size: MAX_CLINIC_LOGO_BYTES + 1 })).toBe("too_large");
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validateClinicLogoFile({ type: "image/png", size: MAX_CLINIC_LOGO_BYTES })).toBeNull();
  });
});
