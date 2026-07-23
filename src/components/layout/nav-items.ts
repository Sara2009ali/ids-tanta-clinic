import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ClipboardList,
  RotateCcw,
  Receipt,
  HandCoins,
  Boxes,
  BarChart3,
  Settings,
} from "lucide-react";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/authz/permissions";
import type { StaffRole } from "@/types/domain";

export type NavSection = "Overview" | "Clinical" | "Business" | "Insights" | "System";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: NavSection;
  permission?: Permission;
  /** Shown to this legacy role regardless of permissions — e.g. a doctor's own self-service view needs no permission key at all (see compensation.view/compensation.manage: doctors are deliberately granted neither). */
  visibleToRole?: StaffRole;
}

/**
 * Shared by the desktop Sidebar and the mobile nav drawer — one source of
 * truth for the nav structure. `section` is presentation-only grouping
 * (visual rhythm in the redesigned sidebar) — it doesn't affect routing,
 * permissions, or the underlying visibility logic below.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/patients", label: "Patients", icon: Users, section: "Clinical", permission: PERMISSIONS.PATIENTS_VIEW },
  {
    href: "/appointments",
    label: "Appointments",
    icon: CalendarDays,
    section: "Clinical",
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  {
    href: "/reception",
    label: "Reception",
    icon: ClipboardList,
    section: "Clinical",
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  { href: "/recalls", label: "Recalls", icon: RotateCcw, section: "Clinical" },
  { href: "/billing", label: "Billing", icon: Receipt, section: "Business", permission: PERMISSIONS.BILLING_VIEW },
  {
    href: "/compensation",
    label: "Compensation",
    icon: HandCoins,
    section: "Business",
    permission: PERMISSIONS.COMPENSATION_VIEW,
    visibleToRole: "doctor",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Boxes,
    section: "Business",
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  { href: "/reports", label: "Reports", icon: BarChart3, section: "Insights", permission: PERMISSIONS.REPORTS_VIEW },
  { href: "/settings", label: "Settings", icon: Settings, section: "System", permission: PERMISSIONS.SETTINGS_MANAGE },
];

export const NAV_SECTION_ORDER: NavSection[] = ["Overview", "Clinical", "Business", "Insights", "System"];

export function visibleNavItems(items: NavItem[], permissions: string[], role: StaffRole): NavItem[] {
  return items.filter(
    (item) =>
      !item.permission ||
      hasPermission(permissions, item.permission) ||
      (item.visibleToRole && item.visibleToRole === role),
  );
}

export function groupNavItemsBySection(items: NavItem[]): { section: NavSection; items: NavItem[] }[] {
  return NAV_SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((item) => item.section === section),
  })).filter((group) => group.items.length > 0);
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
