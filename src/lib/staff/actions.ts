"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import { isDuplicateAuthError } from "@/lib/auth/errors";
import { getAppOrigin } from "@/lib/http/origin";
import { fieldErrorsFromZod } from "@/lib/forms/zod-errors";
import {
  staffCreateFormSchema,
  staffCreateFormValuesFromFormData,
  isStaffAssignableRole,
  decideStaffRoleReassignment,
  buildStaffRoleUpdate,
} from "@/lib/staff/schema";
import { createNotification, getStaffIdsWithPermission } from "@/lib/notifications/service";
import { buildStaffInvitedNotification } from "@/lib/notifications/events";

export interface StaffActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  staffId?: string;
}

const STAFF_PATH = "/settings/staff";
/** Supabase's documented convention for an effectively permanent ban (~100 years) — matches PERMANENT_BAN in doctors/actions.ts. */
const PERMANENT_BAN = "876000h";

/**
 * Invites a new staff member by email — the general-purpose counterpart to
 * createDoctor(), for every role that doesn't need doctor_profiles' extra
 * fields. Unlike doctors (created with a permanently-banned auto-generated
 * password an admin later enables), this uses a real Supabase Auth invite:
 * the new account only gets a password once the invitee sets one themselves
 * from the emailed link (see /activate), so the application never handles
 * or stores a staff member's password. clinic_id always comes from the
 * caller's own session (ensurePermission → staff.clinic_id), never from the
 * form, so a crafted request can't attach a new staff member to a
 * different clinic.
 */
export async function inviteStaffMember(formData: FormData): Promise<StaffActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = staffCreateFormSchema.safeParse(staffCreateFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  if (!isStaffAssignableRole(values.role)) {
    return { error: "Choose a valid role.", fieldErrors: { role: "Choose a valid role" } };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("inviteStaffMember: admin client unavailable", error);
    return { error: "Staff accounts aren't configured in this environment yet. Contact your administrator." };
  }

  const origin = await getAppOrigin();
  const { data: created, error: inviteError } = await admin.auth.admin.inviteUserByEmail(values.email, {
    data: { full_name: values.full_name },
    redirectTo: `${origin}/activate`,
  });

  if (inviteError || !created?.user) {
    if (isDuplicateAuthError(inviteError)) {
      return { error: "This email is already in use.", fieldErrors: { email: "Already in use" } };
    }
    console.error("inviteStaffMember: invite failed", inviteError);
    return { error: "Couldn't send the invitation. Please try again." };
  }

  const staffId = created.user.id;
  const supabase = await createClient();

  const { error: staffError } = await supabase.from("staff_profiles").insert({
    id: staffId,
    clinic_id: staff.clinic_id,
    full_name: values.full_name,
    role: values.role,
    phone: values.phone ?? null,
  });

  if (staffError) {
    console.error("inviteStaffMember: staff_profiles insert failed", staffError);
    await admin.auth.admin.deleteUser(staffId);
    return { error: "Couldn't add the staff member. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "staff.invited",
    entityType: "staff",
    entityId: staffId,
    changes: { role: values.role },
  });

  // Best-effort, informational only — never blocks the invite that already
  // succeeded above. No email, invite link, or token is included (per the
  // approved design: this is an internal event notice, not a substitute for
  // the actual Supabase Auth invite email). No separate dedup mechanism is
  // needed here: a retried call can only ever reach this point once per
  // email, since a second `inviteUserByEmail` for the same address fails
  // with isDuplicateAuthError() well before this line runs.
  const recipientStaffIds = await getStaffIdsWithPermission(supabase, staff.clinic_id, PERMISSIONS.SETTINGS_MANAGE);
  await createNotification(
    supabase,
    buildStaffInvitedNotification({
      clinicId: staff.clinic_id,
      staffId,
      fullName: values.full_name,
      role: values.role,
      createdBy: staff.id,
      recipientStaffIds,
    }),
  );

  revalidatePath(STAFF_PATH);
  return { success: true, staffId };
}

/**
 * Activate/deactivate a staff member's roster status, mirroring
 * setDoctorActive() — except reactivating here also lifts the ban. Staff
 * (unlike Doctors) has no separate "enable access" step: an invited
 * account's only access gate is is_active/ban together, so reactivating a
 * mistakenly-deactivated staff member should let them sign in again right
 * away rather than leaving them stuck banned with no UI to unban them.
 *
 * Every read/write here is scoped to `.eq("clinic_id", staff.clinic_id)` in
 * addition to RLS — belt-and-suspenders so a staffId from another clinic
 * (or a doctor/super_admin row, which this action must never touch) simply
 * doesn't match, rather than relying solely on Postgres silently filtering
 * the row out.
 */
export async function setStaffActive(staffId: string, isActive: boolean): Promise<StaffActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  if (staffId === staff.id) {
    return { error: "You can't change your own access here." };
  }

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("staff_profiles")
    .select("id, role")
    .eq("id", staffId)
    .eq("clinic_id", staff.clinic_id)
    .maybeSingle();

  if (!target) {
    return { error: "Staff member not found." };
  }
  if (!isStaffAssignableRole(target.role)) {
    return { error: "This account is managed from a different screen." };
  }

  const { error } = await supabase
    .from("staff_profiles")
    .update({ is_active: isActive })
    .eq("id", staffId)
    .eq("clinic_id", staff.clinic_id);

  if (error) {
    console.error("setStaffActive: update failed", error);
    return { error: "Couldn't update the staff member. Please try again." };
  }

  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(staffId, { ban_duration: isActive ? "none" : PERMANENT_BAN });
  } catch (accessError) {
    console.error("setStaffActive: updating account access failed", accessError);
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "staff.reactivated" : "staff.deactivated",
    entityType: "staff",
    entityId: staffId,
  });

  revalidatePath(STAFF_PATH);
  return { success: true, staffId };
}

/**
 * Reassigns a staff member's role among the same clinic-manageable set
 * inviteStaffMember() already allows (admin/assistant/reception/
 * accounting) — never doctor or super_admin, so this action can never
 * become a path into either the doctor-specific flow or the platform
 * role. Mirrors setStaffActive()'s exact guard shape: self-modification is
 * blocked outright (an admin cannot change their own role here, which is
 * both "prevent self-escalation" and, just as importantly, "prevent an
 * admin from locking themselves out of admin by mistake"), the target is
 * re-fetched scoped to the caller's own clinic_id before any write (belt-
 * and-suspenders on top of RLS), and only a row already holding one of the
 * assignable roles can be retargeted — a doctor or super_admin row is
 * never reachable through this action, regardless of what id is passed.
 */
export async function changeStaffRole(staffId: string, newRole: string): Promise<StaffActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("staff_profiles")
    .select("id, role")
    .eq("id", staffId)
    .eq("clinic_id", staff.clinic_id)
    .maybeSingle();

  if (!target) {
    return { error: "Staff member not found." };
  }

  const decision = decideStaffRoleReassignment({
    actorId: staff.id,
    targetId: staffId,
    targetRole: target.role,
    newRole,
  });

  if (!decision.allowed || !isStaffAssignableRole(newRole)) {
    if (decision.allowed === false && decision.reason === "self") return { error: "You can't change your own role." };
    if (decision.allowed === false && decision.reason === "target_not_assignable") {
      return { error: "This account is managed from a different screen." };
    }
    return { error: "Choose a valid role." };
  }

  if (target.role === newRole) {
    return { success: true, staffId };
  }

  const { error } = await supabase
    .from("staff_profiles")
    .update(buildStaffRoleUpdate(newRole))
    .eq("id", staffId)
    .eq("clinic_id", staff.clinic_id);

  if (error) {
    console.error("changeStaffRole: update failed", error);
    return { error: "Couldn't update this staff member's role. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "staff.role_changed",
    entityType: "staff",
    entityId: staffId,
    changes: { from: target.role, to: newRole },
  });

  revalidatePath(STAFF_PATH);
  return { success: true, staffId };
}

/**
 * Resends an invite — the only "duplicate invitation" case worth a
 * dedicated action in v1 (a fresh invite for a brand-new email is just
 * inviteStaffMember, which already rejects emails already in use). Blocks
 * resending to an account that has already completed activation, so a
 * stale "Resend" click can't reset an active teammate's credentials.
 */
export async function resendStaffInvite(staffId: string): Promise<StaffActionState> {
  const authz = await ensurePermission(PERMISSIONS.SETTINGS_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("staff_profiles")
    .select("id, full_name, role, is_active")
    .eq("id", staffId)
    .eq("clinic_id", staff.clinic_id)
    .maybeSingle();

  if (!target) return { error: "Staff member not found." };
  if (!isStaffAssignableRole(target.role)) return { error: "This account is managed from a different screen." };
  if (!target.is_active) return { error: "Reactivate this staff member before resending their invite." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("resendStaffInvite: admin client unavailable", error);
    return { error: "Staff accounts aren't configured in this environment yet. Contact your administrator." };
  }

  const { data: userRes, error: userError } = await admin.auth.admin.getUserById(staffId);
  if (userError || !userRes?.user?.email) {
    console.error("resendStaffInvite: account lookup failed", userError);
    return { error: "Couldn't find this account's email." };
  }
  if (userRes.user.last_sign_in_at) {
    return { error: "This staff member has already activated their account." };
  }

  const origin = await getAppOrigin();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(userRes.user.email, {
    data: { full_name: target.full_name },
    redirectTo: `${origin}/activate`,
  });

  if (inviteError) {
    console.error("resendStaffInvite: invite failed", inviteError);
    return { error: "Couldn't resend the invitation. Please try again." };
  }

  revalidatePath(STAFF_PATH);
  return { success: true, staffId };
}
