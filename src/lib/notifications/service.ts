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
  });

  if (error) {
    console.error("createNotification failed", { source: input.source, error });
    return null;
  }

  return data;
}
