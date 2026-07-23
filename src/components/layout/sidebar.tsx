"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/typography";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  NAV_ITEMS,
  groupNavItemsBySection,
  isNavItemActive,
  visibleNavItems,
} from "@/components/layout/nav-items";
import type { StaffRole } from "@/types/domain";

const COLLAPSE_STORAGE_KEY = "dentra:sidebar-collapsed";
const COLLAPSE_CHANGE_EVENT = "dentra:sidebar-collapsed-change";

function subscribeToCollapsePref(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(COLLAPSE_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(COLLAPSE_CHANGE_EVENT, callback);
  };
}

function getCollapsePref() {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
}

function getCollapsePrefServerSnapshot() {
  return false;
}

export function Sidebar({ permissions, role }: { permissions: string[]; role: StaffRole }) {
  const pathname = usePathname();
  const items = visibleNavItems(NAV_ITEMS, permissions, role);
  const groups = groupNavItemsBySection(items);

  // Reads the persisted preference through the external-store API rather than
  // effect+setState — the server has no notion of it, so getServerSnapshot
  // reports expanded and React reconciles the client value after hydration
  // without a markup mismatch; the (rare, one-time) flash for a returning
  // collapsed-mode user is preferable to fighting hydration for a low-stakes
  // layout preference.
  const collapsed = useSyncExternalStore(
    subscribeToCollapsePref,
    getCollapsePref,
    getCollapsePrefServerSnapshot,
  );

  function toggleCollapsed() {
    const next = !getCollapsePref();
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(COLLAPSE_CHANGE_EVENT));
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center gap-2.5", collapsed ? "justify-center px-0" : "px-5")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground shadow-elevation-low">
          D
        </div>
        {!collapsed && (
          <span className={cn(typography.sectionTitle, "text-sidebar-foreground")}>Dentra</span>
        )}
      </div>

      <nav className={cn("flex-1 space-y-5 overflow-y-auto py-4", collapsed ? "px-2.5" : "px-3")}>
        {groups.map(({ section, items: sectionItems }) => (
          <div key={section} className="space-y-1">
            {!collapsed && (
              <h2 className={cn(typography.eyebrow, "px-3 text-sidebar-foreground/50")}>{section}</h2>
            )}
            {sectionItems.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(pathname, href);
              const link = (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group/nav relative flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150",
                    collapsed ? "justify-center px-0" : "px-3",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:pl-3.5",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary transition-opacity duration-150",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              );

              if (!collapsed) return link;

              return (
                <Tooltip key={href}>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-sidebar-border py-2", collapsed ? "px-2.5" : "px-3")}>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            collapsed ? "justify-center px-0" : "px-3",
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
          {!collapsed && "Collapse"}
        </button>
      </div>
    </aside>
  );
}
