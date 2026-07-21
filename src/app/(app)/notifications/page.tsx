import { NotificationsPageClient } from "@/components/notifications/notifications-page-client";
import { getMyNotifications } from "@/lib/notifications/queries";
import { requireStaff } from "@/lib/auth/session";

// Generous enough to cover a clinic's active notification volume at this
// app's established scale without needing real pagination yet — same
// "fetch broad" tradeoff used throughout Rules/Unresolved/Billing, chosen
// deliberately over building cursor pagination UI before it's needed.
const PAGE_FETCH_LIMIT = 50;

export default async function NotificationsPage() {
  await requireStaff();

  const items = await getMyNotifications({ limit: PAGE_FETCH_LIMIT });

  return <NotificationsPageClient initialItems={items} />;
}
