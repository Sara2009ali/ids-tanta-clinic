import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  /** Omit on the current/last page — it renders as plain text, not a link. */
  href?: string;
}

/**
 * Lightweight wayfinding trail for deep pages (patient/product/purchase
 * order/doctor/invoice detail routes) — no primitive library needed here,
 * unlike the interactive ui/* components, since a breadcrumb is just
 * semantic nav markup with no focus-management complexity of its own.
 */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm text-muted-foreground", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground/50" />}
              {item.href && !isLast ? (
                <Link href={item.href} className="rounded-sm transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-medium text-foreground" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
