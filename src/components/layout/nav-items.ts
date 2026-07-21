import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  Receipt,
  HandCoins,
  Boxes,
  RotateCcw,
  BarChart3,
  Settings,
} from "lucide-react";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/authz/permissions";
import type { StaffRole } from "@/types/domain";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission?: Permission;
  /** Shown to this legacy role regardless of permissions — e.g. a doctor's own self-service view needs no permission key at all (see compensation.view/compensation.manage: doctors are deliberately granted neither). */
  visibleToRole?: StaffRole;
}

/** Shared by the desktop Sidebar and the mobile nav drawer — one source of truth for the nav structure. */
export const NAV_ITEMS: NavItem[] = [
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
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  { href: "/recalls", label: "Recalls", icon: RotateCcw },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/settings", label: "Settings", icon: Settings, permission: PERMISSIONS.SETTINGS_MANAGE },
];

export function visibleNavItems(items: NavItem[], permissions: string[], role: StaffRole): NavItem[] {
  return items.filter(
    (item) =>
      !item.permission ||
      hasPermission(permissions, item.permission) ||
      (item.visibleToRole && item.visibleToRole === role),
  );
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
