import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff, requireStaff } from "@/lib/auth/session";
import { PERMISSIONS, hasPermission, type Permission } from "@/lib/authz/permissions";
import type { StaffProfile, StaffRole } from "@/types/domain";

/**
 * Fallback permission set computed from the legacy `staff_role` enum,
 * mirroring the exact role -> permission mapping seeded for the
 * corresponding new role in `0005_rbac.sql` (doctor -> dentist,
 * assistant -> dental_assistant, reception -> receptionist,
 * accounting -> accountant). Used only when `current_permissions()` isn't
 * callable yet (migration not applied to this environment), so
 * authorization behaves identically before and after the migration lands
 * instead of failing closed for every user in the interim.
 */
const ALL_PERMISSIONS = Object.values(PERMISSIONS);

const LEGACY_ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  doctor: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.PATIENTS_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_EDIT,
    PERMISSIONS.APPOINTMENTS_CANCEL,
    PERMISSIONS.CLINICAL_VIEW,
    PERMISSIONS.CLINICAL_EDIT,
    PERMISSIONS.REPORTS_VIEW,
  ],
  assistant: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.CLINICAL_VIEW,
  ],
  reception: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_CREATE,
    PERMISSIONS.PATIENTS_EDIT,
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_EDIT,
    PERMISSIONS.APPOINTMENTS_CANCEL,
  ],
  accounting: [
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_EDIT,
    PERMISSIONS.REPORTS_VIEW,
  ],
};

/**
 * Data Access Layer entry point for the current signed-in staff member's
 * permission set (their role's permissions, or every permission that
 * exists if they're super_admin — see `public.current_permissions()`).
 * Cached per-request like `getCurrentStaff`, so multiple components/actions
 * can call this without duplicating the round trip.
 */
export const getCurrentPermissions = cache(async (): Promise<string[]> => {
  const staff = await getCurrentStaff();
  if (!staff) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_permissions");

  if (error || !data) {
    if (error) {
      console.error(
        "getCurrentPermissions: current_permissions() RPC unavailable (has 0005_rbac.sql been applied?) — falling back to the legacy role mapping",
        error,
      );
    }
    return LEGACY_ROLE_PERMISSIONS[staff.role] ?? [];
  }

  return data;
});

/**
 * Requires a signed-in staff member who holds the given permission(s).
 * Redirects to /login if unauthenticated, or to /dashboard if authenticated
 * but not authorized — same shape as `requireRole` in `@/lib/auth/session`,
 * but driven by the data-driven permission catalog instead of the legacy
 * role enum. Prefer this (or `ensurePermission` inside server actions) over
 * `requireRole` for anything new.
 */
export async function requirePermission(permission: Permission | Permission[]): Promise<StaffProfile> {
  const staff = await requireStaff();
  const granted = await getCurrentPermissions();

  if (!hasPermission(granted, permission)) {
    redirect("/dashboard");
  }

  return staff;
}

export type EnsurePermissionResult =
  | { ok: true; staff: StaffProfile }
  | { ok: false; error: string };

/**
 * Server-action-friendly authorization check: returns a result instead of
 * redirecting, so callers can return their usual `{ error }` shape rather
 * than throwing. Still requires a signed-in staff member first (redirects
 * to /login if there isn't one, matching every other action's behavior).
 */
export async function ensurePermission(
  permission: Permission | Permission[],
): Promise<EnsurePermissionResult> {
  const staff = await requireStaff();
  const granted = await getCurrentPermissions();

  if (!hasPermission(granted, permission)) {
    return { ok: false, error: "You don't have permission to perform this action." };
  }

  return { ok: true, staff };
}
