"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, BellOff, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { archiveNotification, dismissNotification, markNotificationRead } from "@/lib/notifications/actions";
import { NOTIFICATION_TYPE_META, formatNotificationTime } from "@/components/notifications/notification-format";
import type { NotificationListItem } from "@/lib/notifications/queries";
import type { NotificationRecipientStatus, NotificationType } from "@/types/domain";

type NotificationRowAction = "read" | "dismiss" | "archive";
type PendingAction = { recipientId: string; action: NotificationRowAction } | null;

/**
 * Status updates are applied optimistically to the parent's local item list
 * (via onItemUpdated) instead of router.refresh() — a full-tree re-render for
 * a single row's status flip is unnecessary work on every click. The Server
 * Action still revalidates /notifications server-side, so a real navigation
 * or reload always reflects the true state.
 */
export function NotificationList({
  items,
  emptyMessage,
  onItemUpdated,
}: {
  items: NotificationListItem[];
  emptyMessage: string;
  onItemUpdated: (recipientId: string, status: NotificationRecipientStatus) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  function runAction(
    recipientId: string,
    action: NotificationRowAction,
    status: NotificationRecipientStatus,
    call: () => ReturnType<typeof markNotificationRead>,
  ) {
    setPendingAction({ recipientId, action });
    startTransition(async () => {
      const result = await call();
      if (result.error) {
        toast.error(result.error);
      } else {
        onItemUpdated(recipientId, status);
      }
      setPendingAction(null);
    });
  }

  if (items.length === 0) {
    return <EmptyState icon={BellOff} title={emptyMessage} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <ul className="divide-y divide-border">
        {items.map((item) => {
          const meta = NOTIFICATION_TYPE_META[item.notification.type as NotificationType];
          const Icon = meta.icon;
          const isUnread = item.status === "unread";
          const isPending = (action: NotificationRowAction) =>
            pending && pendingAction?.recipientId === item.recipientId && pendingAction.action === action;
          const isRowPending = pending && pendingAction?.recipientId === item.recipientId;

          const body = (
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className={`text-sm ${isUnread ? "font-medium" : "text-foreground/90"}`}>{item.notification.title}</p>
                {item.notification.body && <p className="text-sm text-muted-foreground">{item.notification.body}</p>}
                <p className="text-xs text-muted-foreground">{formatNotificationTime(item.notification.created_at)}</p>
              </div>
              {isUnread && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
            </div>
          );

          return (
            <li
              key={item.recipientId}
              className={cn(
                "flex flex-wrap items-start justify-between gap-3 px-4 py-3 transition-opacity duration-150 sm:flex-nowrap",
                isRowPending && "opacity-50",
              )}
            >
              {item.notification.action_url ? (
                <Link
                  href={item.notification.action_url}
                  className="flex min-w-0 flex-1 items-start gap-3 hover:opacity-80"
                  onClick={() => {
                    if (isUnread) runAction(item.recipientId, "read", "read", () => markNotificationRead(item.recipientId));
                  }}
                >
                  {body}
                </Link>
              ) : (
                body
              )}

              <div className="flex shrink-0 items-center gap-1">
                {isUnread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => runAction(item.recipientId, "read", "read", () => markNotificationRead(item.recipientId))}
                  >
                    {isPending("read") ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Mark read
                  </Button>
                )}
                {(item.status === "unread" || item.status === "read") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => runAction(item.recipientId, "dismiss", "dismissed", () => dismissNotification(item.recipientId))}
                  >
                    {isPending("dismiss") ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                    Dismiss
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => runAction(item.recipientId, "archive", "archived", () => archiveNotification(item.recipientId))}
                  aria-label="Archive"
                >
                  {isPending("archive") ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
