"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { markNotificationRead } from "@/lib/notifications/actions";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NOTIFICATION_TYPE_META, formatNotificationTime } from "@/components/notifications/notification-format";
import type { NotificationListItem } from "@/lib/notifications/queries";
import type { NotificationType } from "@/types/domain";

/**
 * Recent-notifications preview — read/dismiss/archive controls live on the
 * full /notifications page (reached via "View all" below); this stays a
 * quick-glance surface, the same scope split Billing draws between an
 * invoice's own detail page and any place that just links to it.
 *
 * State is seeded from the initial server props, then updated optimistically
 * in place — this component is a persistent client island inside the (app)
 * layout, so it doesn't remount between navigations, and a one-row read
 * status flip doesn't need a full router.refresh() of the whole tree.
 */
export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: {
  notifications: NotificationListItem[];
  unreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  function handleRowClick(item: NotificationListItem) {
    if (item.status === "unread") {
      setNotifications((prev) => prev.map((n) => (n.recipientId === item.recipientId ? { ...n, status: "read" } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      startTransition(async () => {
        await markNotificationRead(item.recipientId);
      });
    }
  }

  function handleAllRead() {
    setNotifications((prev) => prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n)));
    setUnreadCount(0);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`} className="relative" />}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] max-w-96 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && <MarkAllReadButton size="sm" onSuccess={handleAllRead} />}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <BellOff className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        ) : (
          <ul className="max-h-96 divide-y divide-border overflow-y-auto">
            {notifications.map((item) => {
              const meta = NOTIFICATION_TYPE_META[item.notification.type as NotificationType];
              const Icon = meta.icon;
              const isUnread = item.status === "unread";
              const content = (
                <div className="flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/40">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${meta.className}`} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={`text-sm ${isUnread ? "font-medium" : "text-foreground/90"}`}>{item.notification.title}</p>
                    {item.notification.body && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.notification.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatNotificationTime(item.notification.created_at)}</p>
                  </div>
                  {isUnread && <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </div>
              );

              return (
                <li key={item.recipientId}>
                  {item.notification.action_url ? (
                    <Link href={item.notification.action_url} onClick={() => handleRowClick(item)} className="block">
                      {content}
                    </Link>
                  ) : (
                    <button type="button" className="block w-full" onClick={() => handleRowClick(item)}>
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/notifications"
          className="block border-t border-border px-3 py-2 text-center text-sm text-muted-foreground hover:bg-accent/40 hover:text-foreground"
        >
          View all
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
