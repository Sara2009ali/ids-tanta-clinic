import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { NotificationPriority, NotificationType } from "@/types/domain";

export interface CreateNotificationInput {
  clinicId: string;
  source: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  requiresAction?: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdBy?: string;
  /**
   * Already-resolved staff ids — individual/role/clinic-wide targeting
   * (per the approved architecture's Recipients section) is resolved by
   * the caller before this call, not inside it. See create_notification()
   * (0016_notifications.sql) for why the resolution boundary sits here.
   */
  recipientStaffIds: string[];
  /**
   * Database-enforced idempotency key (notifications.event_key,
   * 0040_notification_event_key.sql) for events that can be retried or
   * re-evaluated (e.g. a scheduler job running twice) — omit for a
   * naturally one-shot event (Batch 6's recall-created/staff-invited
   * events, whose own call sites already guarantee at-most-once). When
   * given, a second call with the same key returns null instead of a new
   * notification id.
   */
  eventKey?: string;
}

/**
 * Best-effort notification write, mirroring writeAuditLog()'s philosophy
 * exactly: a notification failure should never block the underlying
 * mutation from succeeding for the user. Unlike writeAuditLog() this can't
 * be a plain insert — notifications/notification_recipients have no INSERT
 * policy for authenticated at all (recipient fan-out has to happen
 * atomically server-side, the same reason run_doctor_settlement()/
 * resolve_compensation_entry() are RPCs instead of plain actions) — so this
 * goes through the create_notification() SECURITY DEFINER RPC instead.
 *
 * This is the entry point for future Server-Action-originated integrations
 * (called the same way writeAuditLog() already is, from within another
 * module's actions.ts). The one integration wired in Phase 2
 * (compensation.rule_missing) is trigger-originated instead, so it calls
 * create_notification() directly from SQL — both paths share the same RPC
 * as their single source of truth, this function is just the TS-callable
 * half of that pairing.
 */
export async function createNotification(
  supabase: SupabaseClient<Database>,
  input: CreateNotificationInput,
): Promise<string | null> {
  if (input.recipientStaffIds.length === 0) return null;

  const { data, error } = await supabase.rpc("create_notification", {
    p_clinic_id: input.clinicId,
    p_source: input.source,
    p_type: input.type,
    p_priority: input.priority,
    p_title: input.title,
    p_recipient_staff_ids: input.recipientStaffIds,
    p_body: input.body,
    p_entity_type: input.entityType,
    p_entity_id: input.entityId,
    p_requires_action: input.requiresAction,
    p_action_url: input.actionUrl,
    p_action_label: input.actionLabel,
    p_created_by: input.createdBy,
    p_event_key: input.eventKey,
  });

  if (error) {
    console.error("createNotification failed", { source: input.source, error });
    return null;
  }

  return data;
}

/**
 * Resolves clinic-scoped recipient staff ids for a given permission key —
 * the same staff_profiles -> role_permissions -> permissions join
 * sync_doctor_compensation() already performs in SQL
 * (0016_notifications.sql, compensation.rule_missing), expressed as
 * sequential PostgREST queries so a TS Server Action can resolve recipients
 * itself instead of needing a new database function per event. Deliberately
 * clinic-scoped only (no super_admin special-case) — recipient resolution
 * for a specific clinic's operational event has never needed to reach
 * platform-wide staff, matching the one existing precedent's own scope.
 */
export async function getStaffIdsWithPermission(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  permissionKey: string,
): Promise<string[]> {
  const { data: permission } = await supabase.from("permissions").select("id").eq("key", permissionKey).maybeSingle();
  if (!permission) return [];

  const { data: rolePermissions } = await supabase
    .from("role_permissions")
    .select("role_id")
    .eq("permission_id", permission.id);
  const roleIds = (rolePermissions ?? []).map((row) => row.role_id);
  if (roleIds.length === 0) return [];

  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("id")
    .eq("clinic_id", clinicId)
    .in("role_id", roleIds)
    .eq("is_active", true)
    .is("deleted_at", null);

  return (staff ?? []).map((row) => row.id);
}
