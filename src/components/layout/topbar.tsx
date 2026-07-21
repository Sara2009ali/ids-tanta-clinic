import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationBellServer } from "@/components/notifications/notification-bell-server";
import type { StaffRole } from "@/types/domain";

export function Topbar({
  fullName,
  role,
  permissions,
}: {
  fullName: string;
  role: StaffRole;
  permissions: string[];
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 sm:gap-4 sm:px-6">
      <MobileNav permissions={permissions} role={role} />
      <div className="ml-auto flex items-center gap-2">
        <Suspense fallback={<Skeleton className="size-8 rounded-lg" />}>
          <NotificationBellServer />
        </Suspense>
        <UserMenu fullName={fullName} role={role} />
      </div>
    </header>
  );
}
