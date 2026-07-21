"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";

export interface NotificationActionState {
  error?: string;
  success?: boolean;
}

/**
 * Every action here is a plain RLS-protected update to a row the caller
 * already owns (notification_recipients.staff_id = auth.uid()) — no
 * permission check beyond being a signed-in staff member, same reasoning
 * the approved architecture review gave for why these are plain Server
 * Actions rather than SECURITY DEFINER RPCs: unlike settlement (atomic
 * writes across many rows owned by someone else), these are single-user,
 * single- or simple-multi-row writes RLS alone can enforce.
 */

function friendlyError(action: string, error: unknown): string {
  console.error(`${action} failed`, error);
  return "Couldn't update this notification. Please try again.";
}

/** unread -> read only; already read/dismissed/archived rows are left alone (no-op, not an error) — the lifecycle only ever moves forward. */
export async function markNotificationRead(recipientId: string): Promise<NotificationActionState> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_recipients")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("id", recipientId)
    .eq("status", "unread");

  if (error) {
    return { error: friendlyError("markNotificationRead", error) };
  }

  revalidatePath("/notifications");
  return { success: true };
}

/** Every one of the caller's own currently-unread rows -> read, in one round trip. */
export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_recipients")
    .update({ status: "read", read_at: new Date().toISOString() })
    .eq("status", "unread");

  if (error) {
    return { error: friendlyError("markAllNotificationsRead", error) };
  }

  revalidatePath("/notifications");
  return { success: true };
}

/** unread|read -> dismissed. Already-dismissed/archived rows are left alone. */
export async function dismissNotification(recipientId: string): Promise<NotificationActionState> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_recipients")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", recipientId)
    .in("status", ["unread", "read"]);

  if (error) {
    return { error: friendlyError("dismissNotification", error) };
  }

  revalidatePath("/notifications");
  return { success: true };
}

/**
 * Archive is reachable from any prior status, not just dismissed — per the
 * approved architecture, archived is an orthogonal "set aside" state, not
 * the last step of the unread -> read -> dismissed chain.
 */
export async function archiveNotification(recipientId: string): Promise<NotificationActionState> {
  await requireStaff();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_recipients")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", recipientId)
    .neq("status", "archived");

  if (error) {
    return { error: friendlyError("archiveNotification", error) };
  }

  revalidatePath("/notifications");
  return { success: true };
}

/** Bulk variant of dismissNotification — same forward-only guard, applied to every id in one round trip. */
export async function bulkDismissNotifications(recipientIds: string[]): Promise<NotificationActionState> {
  await requireStaff();
  if (recipientIds.length === 0) return { success: true };
  const supabase = await createClient();

  const { error } = await supabase
    .from("notification_recipients")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .in("id", recipientIds)
    .in("status", ["unread", "read"]);

  if (error) {
    return { error: friendlyError("bulkDismissNotifications", error) };
  }

  revalidatePath("/notifications");
  return { success: true };
}
