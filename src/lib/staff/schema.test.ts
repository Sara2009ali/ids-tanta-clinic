import { describe, it, expect } from "vitest";
import {
  staffCreateFormSchema,
  staffCreateFormValuesFromFormData,
  staffCreateFormValuesFromFormData as fromFormData,
  isStaffAssignableRole,
  deriveStaffInvitationStatus,
  decideStaffRoleReassignment,
  buildStaffRoleUpdate,
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

describe("decideStaffRoleReassignment", () => {
  const base = { actorId: "actor-1", targetId: "target-1", targetRole: "reception", newRole: "admin" };

  it("allows an admin to reassign another staff member between assignable roles", () => {
    expect(decideStaffRoleReassignment(base)).toEqual({ allowed: true });
  });

  it("blocks self-reassignment even when the new role is itself assignable — prevents self-escalation", () => {
    expect(decideStaffRoleReassignment({ ...base, targetId: "actor-1" })).toEqual({
      allowed: false,
      reason: "self",
    });
  });

  it("blocks a self-reassignment attempt to a non-assignable role too — self-check runs before role validity", () => {
    expect(decideStaffRoleReassignment({ ...base, targetId: "actor-1", newRole: "super_admin" })).toEqual({
      allowed: false,
      reason: "self",
    });
  });

  it("rejects doctor and super_admin as a new role", () => {
    expect(decideStaffRoleReassignment({ ...base, newRole: "doctor" })).toEqual({
      allowed: false,
      reason: "invalid_role",
    });
    expect(decideStaffRoleReassignment({ ...base, newRole: "super_admin" })).toEqual({
      allowed: false,
      reason: "invalid_role",
    });
  });

  it("rejects an arbitrary/unknown new role", () => {
    expect(decideStaffRoleReassignment({ ...base, newRole: "owner" })).toEqual({
      allowed: false,
      reason: "invalid_role",
    });
  });

  it("refuses to retarget a doctor or super_admin row, regardless of the requested new role", () => {
    expect(decideStaffRoleReassignment({ ...base, targetRole: "doctor" })).toEqual({
      allowed: false,
      reason: "target_not_assignable",
    });
    expect(decideStaffRoleReassignment({ ...base, targetRole: "super_admin" })).toEqual({
      allowed: false,
      reason: "target_not_assignable",
    });
  });

  it("allows a no-op reassignment (new role equals current role)", () => {
    expect(decideStaffRoleReassignment({ ...base, newRole: base.targetRole })).toEqual({ allowed: true });
  });
});

describe("buildStaffRoleUpdate", () => {
  it("always nulls role_id alongside the new role — this is what forces sync_staff_role_id() to recompute effective permissions for the NEW role instead of leaving the stale role_id (and therefore stale permissions) from before the reassignment", () => {
    for (const role of STAFF_ASSIGNABLE_ROLES) {
      expect(buildStaffRoleUpdate(role)).toEqual({ role, role_id: null });
    }
  });

  it("never omits role_id — a payload that forgot it would silently reintroduce the Batch 9 bug", () => {
    const payload = buildStaffRoleUpdate("admin");
    expect(payload).toHaveProperty("role_id", null);
  });
});
