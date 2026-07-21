import { NotificationBell } from "@/components/notifications/notification-bell";
import { getMyNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";

const BELL_PREVIEW_LIMIT = 8;
// Fetched larger than the preview count since dismissed/archived rows are
// filtered out below after the fetch — same "fetch broad, filter in JS"
// shape used throughout Rules/Unresolved.
const BELL_FETCH_LIMIT = 15;

/**
 * Isolated in its own Server Component so the topbar's notification fetch
 * can stream inside its own <Suspense> boundary (see Topbar) instead of
 * blocking the whole page's first paint on every navigation — this data
 * only feeds the bell dropdown, it has nothing to do with the page content
 * underneath it.
 */
export async function NotificationBellServer() {
  const [notifications, unreadNotificationCount] = await Promise.all([
    getMyNotifications({ limit: BELL_FETCH_LIMIT }),
    getUnreadNotificationCount(),
  ]);

  const bellNotifications = notifications
    .filter((item) => item.status !== "dismissed" && item.status !== "archived")
    .slice(0, BELL_PREVIEW_LIMIT);

  return <NotificationBell notifications={bellNotifications} unreadCount={unreadNotificationCount} />;
}
