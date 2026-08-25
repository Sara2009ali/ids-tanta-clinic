import { describe, it, expect } from "vitest";
import {
  staffCreateFormSchema,
  staffCreateFormValuesFromFormData,
  staffCreateFormValuesFromFormData as fromFormData,
  isStaffAssignableRole,
  deriveStaffInvitationStatus,
  STAFF_ASSIGNABLE_ROLES,
} from "@/lib/staff/schema";

describe("STAFF_ASSIGNABLE_ROLES / isStaffAssignableRole", () => {
  it("includes exactly the four clinic-manageable roles", () => {
    expect([...STAFF_ASSIGNABLE_ROLES].sort()).toEqual(["accounting", "admin", "assistant", "reception"]);
  });

  it("accepts every assignable role", () => {
    for (const role of STAFF_ASSIGNABLE_ROLES) {
      expect(isStaffAssignableRole(role)).toBe(true);
    }
  });

  it("rejects doctor — doctors are provisioned through their own flow", () => {
    expect(isStaffAssignableRole("doctor")).toBe(false);
  });

  it("rejects super_admin — a platform-level role, never assignable from clinic UI", () => {
    expect(isStaffAssignableRole("super_admin")).toBe(false);
  });

  it("rejects an arbitrary/unknown string", () => {
    expect(isStaffAssignableRole("owner")).toBe(false);
  });
});

describe("staffCreateFormSchema", () => {
  const valid = {
    full_name: "Mona Adel",
    phone: "0100000000",
    email: "mona@clinic.com",
    role: "reception",
  };

  it("parses valid values successfully", () => {
    expect(staffCreateFormSchema.safeParse(valid).success).toBe(true);
  });

  it("fails on an empty name", () => {
    expect(staffCreateFormSchema.safeParse({ ...valid, full_name: "" }).success).toBe(false);
  });

  it("fails on a malformed email", () => {
    expect(staffCreateFormSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("fails on a role outside the assignable set (e.g. doctor or super_admin)", () => {
    expect(staffCreateFormSchema.safeParse({ ...valid, role: "doctor" }).success).toBe(false);
    expect(staffCreateFormSchema.safeParse({ ...valid, role: "super_admin" }).success).toBe(false);
  });

  it("passes when phone is omitted", () => {
    const { phone, ...rest } = valid;
    void phone;
    const result = staffCreateFormSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBeUndefined();
  });
});

describe("staffCreateFormValuesFromFormData", () => {
  it("extracts every field from a populated form", () => {
    const formData = new FormData();
    formData.set("full_name", "Mona Adel");
    formData.set("phone", "0100000000");
    formData.set("email", "mona@clinic.com");
    formData.set("role", "reception");

    expect(staffCreateFormValuesFromFormData(formData)).toEqual({
      full_name: "Mona Adel",
      phone: "0100000000",
      email: "mona@clinic.com",
      role: "reception",
    });
  });

  it("defaults name/email/role to empty strings when missing", () => {
    expect(fromFormData(new FormData())).toEqual({
      full_name: "",
      phone: undefined,
      email: "",
      role: "",
    });
  });
});

describe("deriveStaffInvitationStatus", () => {
  it("returns inactive when the staff row is deactivated, regardless of sign-in history", () => {
    expect(deriveStaffInvitationStatus({ isActive: false, lastSignInAt: "2026-01-01T00:00:00Z" })).toBe("inactive");
    expect(deriveStaffInvitationStatus({ isActive: false, lastSignInAt: null })).toBe("inactive");
  });

  it("returns pending when active but never signed in", () => {
    expect(deriveStaffInvitationStatus({ isActive: true, lastSignInAt: null })).toBe("pending");
  });

  it("returns active once they've signed in at least once", () => {
    expect(deriveStaffInvitationStatus({ isActive: true, lastSignInAt: "2026-01-01T00:00:00Z" })).toBe("active");
  });
});
