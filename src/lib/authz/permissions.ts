/**
 * Permission catalog + pure authorization checks for Phase 2.1 RBAC.
 *
 * Keys must match `public.permissions.key` seeded in
 * supabase/migrations/0005_rbac.sql exactly — this file is the
 * application-side mirror of that catalog, not a second source of truth.
 * Adding a new permission still requires a migration (to seed the row and
 * map it to whichever roles should get it); this file just gives the rest
 * of the app typed, autocompleted names instead of hand-typed strings.
 *
 * Nothing in this file talks to Supabase — it's pure and synchronous on
 * purpose, so it's trivially unit-testable and reusable from both server
 * and client components. The IO side (fetching *which* permissions the
 * current user actually has) lives in `@/lib/authz/session`.
 */

export const PERMISSIONS = {
  PATIENTS_VIEW: "patients.view",
  PATIENTS_CREATE: "patients.create",
  PATIENTS_EDIT: "patients.edit",
  PATIENTS_DELETE: "patients.delete",

  APPOINTMENTS_VIEW: "appointments.view",
  APPOINTMENTS_CREATE: "appointments.create",
  APPOINTMENTS_EDIT: "appointments.edit",
  APPOINTMENTS_CANCEL: "appointments.cancel",

  CLINICAL_VIEW: "clinical.view",
  CLINICAL_EDIT: "clinical.edit",

  BILLING_VIEW: "billing.view",
  BILLING_EDIT: "billing.edit",

  REPORTS_VIEW: "reports.view",

  SETTINGS_MANAGE: "settings.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Role catalog for display purposes (labels shown in the UI). The
 * authoritative role→permission mapping lives in the database
 * (role_permissions) — this is *not* used for authorization decisions,
 * only for rendering a human-readable role name given a `roles.key`.
 */
export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  dentist: "Dentist",
  receptionist: "Receptionist",
  reception_manager: "Reception Manager",
  dental_assistant: "Dental Assistant",
  accountant: "Accountant",
  viewer: "Viewer",
};

/** True if `granted` includes every permission in `required`. */
export function hasPermission(
  granted: readonly string[],
  required: Permission | Permission[],
): boolean {
  const grantedSet = new Set(granted);
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((permission) => grantedSet.has(permission));
}

/** True if `granted` includes at least one permission in `required`. */
export function hasAnyPermission(granted: readonly string[], required: Permission[]): boolean {
  const grantedSet = new Set(granted);
  return required.some((permission) => grantedSet.has(permission));
}
