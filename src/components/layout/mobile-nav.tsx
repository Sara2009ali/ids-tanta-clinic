"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/typography";
import {
  NAV_ITEMS,
  groupNavItemsBySection,
  isNavItemActive,
  visibleNavItems,
} from "@/components/layout/nav-items";
import type { StaffRole } from "@/types/domain";

/**
 * Sheet-based drawer for viewports below `md`, where Sidebar (sidebar.tsx)
 * is `hidden` — reuses the same NAV_ITEMS/visibility/grouping logic so the
 * two never drift, and the existing Sheet primitive rather than a new
 * dependency. Closes itself on navigation since a Link click doesn't
 * dismiss a Sheet.
 */
export function MobileNav({ permissions, role }: { permissions: string[]; role: StaffRole }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = visibleNavItems(NAV_ITEMS, permissions, role);
  const groups = groupNavItemsBySection(items);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu" />}>
        <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="w-3/4 max-w-xs p-0">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              D
            </span>
            Dentra
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map(({ section, items: sectionItems }) => (
            <div key={section} className="space-y-1">
              <h2 className={cn(typography.eyebrow, "px-3 text-muted-foreground/70")}>{section}</h2>
              {sectionItems.map(({ href, label, icon: Icon }) => {
                const active = isNavItemActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground/70 hover:bg-accent/60 hover:text-accent-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-opacity duration-150",
                        active ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
