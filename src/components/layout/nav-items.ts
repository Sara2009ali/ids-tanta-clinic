import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Tags,
  CalendarDays,
  CalendarClock,
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
import type { Dictionary } from "@/lib/i18n/types";

export type NavSection = "Overview" | "Clinical" | "Business" | "Insights" | "System";

/** Keys into `Dictionary["nav"]` — labels/sections are resolved at render time via `dict.nav[labelKey]` so Sidebar/MobileNav/PageTitle stay in sync with the active locale from one source of truth. */
type NavLabelKey = Exclude<keyof Dictionary["nav"], "notifications" | `section${string}` | "collapse" | "expandSidebar" | "collapseSidebar" | "openNav">;

export interface NavItem {
  href: string;
  labelKey: NavLabelKey;
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
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/patients", labelKey: "patients", icon: Users, section: "Clinical", permission: PERMISSIONS.PATIENTS_VIEW },
  {
    href: "/settings/doctors",
    labelKey: "doctors",
    icon: Stethoscope,
    section: "Clinical",
    // Same gate /settings/doctors already enforces on itself
    // (requirePermission(SETTINGS_MANAGE)) — the nav entry shouldn't offer
    // a link the page would immediately redirect away from.
    permission: PERMISSIONS.SETTINGS_MANAGE,
  },
  {
    href: "/procedures",
    labelKey: "procedures",
    icon: Tags,
    section: "Clinical",
    // Same gate the page enforces on itself — moved out of Appointments
    // (Phase: IA cleanup) so the catalog has one canonical, standalone
    // management home; Appointments/billing/reception remain consumers of
    // it, not owners.
    permission: PERMISSIONS.SETTINGS_MANAGE,
  },
  {
    href: "/appointments",
    labelKey: "appointments",
    icon: CalendarDays,
    section: "Clinical",
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  {
    href: "/reception",
    labelKey: "reception",
    icon: ClipboardList,
    section: "Clinical",
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  {
    href: "/doctor-schedule",
    labelKey: "doctorSchedule",
    icon: CalendarClock,
    section: "Clinical",
    // Same gate /appointments itself uses — a read-oriented planning view,
    // not clinic configuration (that's /appointments/doctor-schedule,
    // gated on SETTINGS_MANAGE instead).
    permission: PERMISSIONS.APPOINTMENTS_VIEW,
  },
  {
    href: "/recalls",
    labelKey: "recalls",
    icon: RotateCcw,
    section: "Clinical",
    // Matches the page's own requirePermission(CLINICAL_VIEW) gate — the nav
    // entry shouldn't offer a link the page would immediately redirect away
    // from. Previously ungated (visible to every role) from when this route
    // was still a ComingSoon placeholder with no real access boundary.
    permission: PERMISSIONS.CLINICAL_VIEW,
  },
  { href: "/billing", labelKey: "billing", icon: Receipt, section: "Business", permission: PERMISSIONS.BILLING_VIEW },
  {
    href: "/compensation",
    labelKey: "compensation",
    icon: HandCoins,
    section: "Business",
    permission: PERMISSIONS.COMPENSATION_VIEW,
    visibleToRole: "doctor",
  },
  {
    href: "/inventory",
    labelKey: "inventory",
    icon: Boxes,
    section: "Business",
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  { href: "/reports", labelKey: "reports", icon: BarChart3, section: "Insights", permission: PERMISSIONS.REPORTS_VIEW },
  // Ungated: Settings now hosts every staff member's own Preferences
  // (language/theme), not just clinic configuration. The page itself
  // conditionally renders the admin-only Doctors section based on
  // SETTINGS_MANAGE — the nav entry mustn't hide the whole page from
  // everyone else just because part of it is admin-only.
  { href: "/settings", labelKey: "settings", icon: Settings, section: "System" },
];

export const NAV_SECTION_ORDER: NavSection[] = ["Overview", "Clinical", "Business", "Insights", "System"];

export const NAV_SECTION_LABEL_KEYS: Record<NavSection, keyof Dictionary["nav"]> = {
  Overview: "sectionOverview",
  Clinical: "sectionClinical",
  Business: "sectionBusiness",
  Insights: "sectionInsights",
  System: "sectionSystem",
};

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
