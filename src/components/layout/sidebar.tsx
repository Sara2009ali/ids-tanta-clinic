"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  Receipt,
  HandCoins,
  RotateCcw,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/authz/permissions";
import type { StaffRole } from "@/types/domain";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  /** Shown to this legacy role regardless of permissions — e.g. a doctor's own self-service view needs no permission key at all (see compensation.view/compensation.manage: doctors are deliberately granted neither). */
  visibleToRole?: StaffRole;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users, permission: PERMISSIONS.PATIENTS_VIEW },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarDays,
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  {
    href: "/reception",
    label: "Reception",
    icon: ClipboardList,
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  { href: "/billing", label: "Billing", icon: Receipt, permission: PERMISSIONS.BILLING_VIEW },
  {
    href: "/compensation",
    label: "Compensation",
    icon: HandCoins,
    permission: PERMISSIONS.COMPENSATION_VIEW,
    visibleToRole: "doctor",
  },
  { href: "/recalls", label: "Recalls", icon: RotateCcw },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/settings", label: "Settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
];

export function Sidebar({ permissions, role }: { permissions: string[]; role: StaffRole }) {
  const pathname = usePathname();
  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      !item.permission ||
      hasPermission(permissions, item.permission) ||
      (item.visibleToRole && item.visibleToRole === role),
  );

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-sm font-semibold">
          IT
        </div>
        <span className="font-semibold text-sidebar-foreground">IDS Tanta</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {visibleNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
