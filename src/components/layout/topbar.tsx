import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTitle } from "@/components/layout/page-title";
import { QuickPatientSearch } from "@/components/appointments/quick-patient-search";
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
    <header className="relative z-10 flex h-16 shrink-0 items-center gap-3 border-b border-border/70 bg-background px-4 shadow-elevation-low sm:gap-4 sm:px-6">
      <MobileNav permissions={permissions} role={role} />
      <PageTitle />
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden lg:block">
          <QuickPatientSearch />
        </div>
        <Suspense fallback={<Skeleton className="size-8 rounded-lg" />}>
          <NotificationBellServer />
        </Suspense>
        <UserMenu fullName={fullName} role={role} />
      </div>
    </header>
  );
}
