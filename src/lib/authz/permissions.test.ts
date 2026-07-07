import { describe, it, expect } from "vitest";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

// NOTE: as of writing, src/lib/authz/permissions.ts is a temporary placeholder
// (see the TODO comment at the top of that file) that only exports
// `hasPermission`. It does not (yet) export `hasAnyPermission`, so that
// function is not covered here. Add OR-semantics coverage once the
// authoritative permissions module lands and exports it.

describe("hasPermission", () => {
  it("returns true when the single required permission is present", () => {
    expect(hasPermission([PERMISSIONS.PATIENTS_VIEW], PERMISSIONS.PATIENTS_VIEW)).toBe(true);
  });

  it("returns false when the single required permission is absent", () => {
    expect(hasPermission([PERMISSIONS.PATIENTS_VIEW], PERMISSIONS.PATIENTS_DELETE)).toBe(false);
  });

  it("returns true (AND semantics) when all permissions in a required array are present", () => {
    const granted = [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_EDIT, PERMISSIONS.PATIENTS_DELETE];
    const required = [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_EDIT];
    expect(hasPermission(granted, required)).toBe(true);
  });

  it("returns false (AND semantics) when one permission in a required array is missing", () => {
    const granted = [PERMISSIONS.PATIENTS_VIEW];
    const required = [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_EDIT];
    expect(hasPermission(granted, required)).toBe(false);
  });

  it("returns false for any non-empty requirement when granted is empty", () => {
    expect(hasPermission([], PERMISSIONS.PATIENTS_VIEW)).toBe(false);
    expect(hasPermission([], [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_EDIT])).toBe(false);
  });
});
