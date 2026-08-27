import { z } from "zod";

const trimmedOptional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

/**
 * Roles assignable through the general Staff flow. Doctor keeps its own
 * dedicated flow (Settings → Doctors) because it carries extra
 * doctor_profiles fields (specialty, license, schedules) this form doesn't
 * collect; super_admin is a platform-level role with no clinic
 * (staff_profiles_clinic_required_unless_super_admin), never assignable
 * from clinic-scoped UI. This is the same `staff_role` enum from
 * 0001_phase1_foundation.sql, just the subset this form is allowed to set.
 */
export const STAFF_ASSIGNABLE_ROLES = ["admin", "assistant", "reception", "accounting"] as const;
export type StaffAssignableRole = (typeof STAFF_ASSIGNABLE_ROLES)[number];

export function isStaffAssignableRole(value: string): value is StaffAssignableRole {
  return (STAFF_ASSIGNABLE_ROLES as readonly string[]).includes(value);
}

export const staffCreateFormSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the staff member's name").max(100, "Keep it under 100 characters"),
  phone: trimmedOptional,
  email: z
    .string()
    .trim()
    .min(1, "Enter an email")
    .email("Enter a valid email address")
    .max(150, "Keep it under 150 characters"),
  role: z.enum(STAFF_ASSIGNABLE_ROLES, "Choose a role"),
});

export type StaffCreateFormValues = z.infer<typeof staffCreateFormSchema>;

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export function staffCreateFormValuesFromFormData(formData: FormData) {
  return {
    full_name: str(formData, "full_name") ?? "",
    phone: str(formData, "phone"),
    email: str(formData, "email") ?? "",
    role: str(formData, "role") ?? "",
  };
}

export type StaffRoleReassignmentBlockReason = "self" | "invalid_role" | "target_not_assignable";

export type StaffRoleReassignmentDecision =
  | { allowed: true }
  | { allowed: false; reason: StaffRoleReassignmentBlockReason };

/**
 * Pure authorization decision for changeStaffRole(), kept separate from the
 * clinic-scoped DB lookup so the security-critical part — can this actor
 * touch this target at all — is unit-testable without a Supabase client.
 * Clinic-membership matching still happens in actions.ts via
 * `.eq("clinic_id", staff.clinic_id)` on the target fetch, since that's a
 * property of the database row, not something this function is given.
 */
export function decideStaffRoleReassignment(input: {
  actorId: string;
  targetId: string;
  targetRole: string;
  newRole: string;
}): StaffRoleReassignmentDecision {
  if (input.targetId === input.actorId) return { allowed: false, reason: "self" };
  if (!isStaffAssignableRole(input.newRole)) return { allowed: false, reason: "invalid_role" };
  if (!isStaffAssignableRole(input.targetRole)) return { allowed: false, reason: "target_not_assignable" };
  return { allowed: true };
}

export type StaffInvitationStatus = "pending" | "active" | "inactive";

/**
 * Pure status classifier for the Staff list: deactivated beats everything
 * else, then "has this account ever signed in" distinguishes an activated
 * account from one still waiting on its invite email. Mirrors the same
 * banned_until/last_sign_in_at fields getDoctorAccessMap already reads off
 * the Admin API for Doctors, just resolved to one label instead of a
 * boolean, since Staff has no separate "access enabled" concept.
 */
export function deriveStaffInvitationStatus(input: {
  isActive: boolean;
  lastSignInAt: string | null;
}): StaffInvitationStatus {
  if (!input.isActive) return "inactive";
  return input.lastSignInAt ? "active" : "pending";
}
