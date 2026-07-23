"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { NotificationList } from "@/components/notifications/notification-list";
import type { NotificationListItem } from "@/lib/notifications/queries";
import type { NotificationRecipientStatus } from "@/types/domain";
import { typography } from "@/lib/typography";

/**
 * Owns the single source of truth for the page's notification list so both
 * tabs (and the "mark all read" button) stay in sync from one optimistic
 * update instead of each list re-fetching independently via router.refresh().
 */
export function NotificationsPageClient({ initialItems }: { initialItems: NotificationListItem[] }) {
  const [items, setItems] = useState(initialItems);

  const visibleItems = items.filter((item) => item.status !== "archived");
  const unreadItems = visibleItems.filter((item) => item.status === "unread");

  function updateItemStatus(recipientId: string, status: NotificationRecipientStatus) {
    setItems((prev) => prev.map((item) => (item.recipientId === recipientId ? { ...item, status } : item)));
  }

  function markAllRead() {
    setItems((prev) => prev.map((item) => (item.status === "unread" ? { ...item, status: "read" } : item)));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>Notifications</h1>
          <p className="text-sm text-muted-foreground">Updates across the clinic that need your attention.</p>
        </div>
        {unreadItems.length > 0 && <MarkAllReadButton onSuccess={markAllRead} />}
      </div>

      <Tabs defaultValue="unread">
        <TabsList>
          <TabsTrigger value="unread">Unread{unreadItems.length > 0 ? ` (${unreadItems.length})` : ""}</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="unread" className="pt-6">
          <NotificationList
            items={unreadItems}
            emptyMessage="You're all caught up. No unread notifications."
            onItemUpdated={updateItemStatus}
          />
        </TabsContent>

        <TabsContent value="all" className="pt-6">
          <NotificationList items={visibleItems} emptyMessage="No notifications yet." onItemUpdated={updateItemStatus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
