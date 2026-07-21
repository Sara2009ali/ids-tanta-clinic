import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Notification, NotificationRecipientStatus } from "@/types/domain";

const DEFAULT_PAGE_SIZE = 20;

export interface NotificationListItem {
  recipientId: string;
  status: NotificationRecipientStatus;
  readAt: string | null;
  dismissedAt: string | null;
  archivedAt: string | null;
  notification: Notification;
}

export interface MyNotificationsParams {
  /** Omit for every status; pass to scope to e.g. just 'unread'. */
  status?: NotificationRecipientStatus;
  limit?: number;
  /** Cursor: created_at of the last row already fetched — omit for the first page. */
  before?: string;
}

interface NotificationRecipientQueryRow {
  id: string;
  status: string;
  read_at: string | null;
  dismissed_at: string | null;
  archived_at: string | null;
  notification: Notification | null;
}

/**
 * The signed-in staff member's own notifications, newest first. RLS
 * (notification_recipients.staff_id = auth.uid()) is what actually scopes
 * this — same "bare query, let RLS do the scoping" shape getCompensationRules()
 * uses for a doctor's own self-service view — so there's no explicit staff_id
 * filter here. Cursor-paginated on created_at rather than this app's usual
 * "fetch everything" convention (Rules/Unresolved/Invoices all render full
 * result sets): per the approved architecture review, notification volume
 * is genuinely unbounded over a clinic's lifetime in a way those lists aren't.
 */
export async function getMyNotifications(params: MyNotificationsParams = {}): Promise<NotificationListItem[]> {
  const supabase = await createClient();
  const limit = params.limit ?? DEFAULT_PAGE_SIZE;

  let query = supabase
    .from("notification_recipients")
    .select("id, status, read_at, dismissed_at, archived_at, notification:notifications(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (params.status) query = query.eq("status", params.status);
  if (params.before) query = query.lt("created_at", params.before);

  const { data, error } = await query;
  if (error) {
    console.error("getMyNotifications failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as NotificationRecipientQueryRow[];
  return rows
    .filter((row): row is NotificationRecipientQueryRow & { notification: Notification } => row.notification !== null)
    .map((row) => ({
      recipientId: row.id,
      status: row.status as NotificationRecipientStatus,
      readAt: row.read_at,
      dismissedAt: row.dismissed_at,
      archivedAt: row.archived_at,
      notification: row.notification,
    }));
}

/** Cheap count-only query for the future bell badge — same shape as getDoctorEarningsSummary's unresolvedRes (count: exact, head: true). */
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("notification_recipients")
    .select("*", { count: "exact", head: true })
    .eq("status", "unread");

  if (error) {
    console.error("getUnreadNotificationCount failed", error);
    return 0;
  }

  return count ?? 0;
}
