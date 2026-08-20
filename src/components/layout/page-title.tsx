"use client";

import { Bell } from "lucide-react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/components/layout/nav-items";
import { useTranslation } from "@/components/locale-provider";
import type { Dictionary } from "@/lib/i18n/types";

/**
 * Routes reachable outside the sidebar (e.g. via the topbar bell) have no
 * NAV_ITEMS entry to derive an icon/label from — listed here so the topbar
 * anchor never silently goes blank for a page that's one click away.
 */
const EXTRA_ROUTES: { href: string; labelKey: keyof Dictionary["nav"]; icon: typeof Bell }[] = [
  { href: "/notifications", labelKey: "notifications", icon: Bell },
];

/**
 * A persistent "where am I" anchor in the topbar — each page already
 * renders its own <h1>, but that scrolls out of view; this stays fixed at
 * the top the way Linear/Notion keep a section label pinned regardless of
 * scroll position. Derived from the same NAV_ITEMS used by Sidebar/MobileNav
 * rather than a second source of truth.
 */
export function PageTitle() {
  const pathname = usePathname();
  const { nav: dict } = useTranslation();
  const current =
    NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href)) ??
    EXTRA_ROUTES.find((item) => isNavItemActive(pathname, item.href));

  if (!current) return null;

  const Icon = current.icon;
  return (
    <div className="hidden items-center gap-2 text-sm font-medium text-foreground/80 md:flex">
      <Icon className="size-4 text-muted-foreground" />
      {dict[current.labelKey]}
    </div>
  );
}
