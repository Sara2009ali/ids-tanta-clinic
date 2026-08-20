import Link from "next/link";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

export interface SummaryRailItem {
  label: string;
  value: string;
  tone?: "default" | "warning" | "success";
  /** When set, the item becomes a link to the relevant tab (e.g. `?tab=recalls`) — the "clear route to that module" the item's number is a summary of. Omitted for items with no single natural destination (Last Visit's own record isn't a tab; Medical Alerts already has its detail in the hero above). */
  href?: string;
}

/** Static column-count → class lookup — Tailwind can't see a template-built `grid-cols-${n}` string. */
const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

/**
 * The "what do I need to know right now" strip beneath the workspace hero —
 * last visit, next appointment, outstanding balance, alert count. Each item
 * is optional per-caller so it disappears cleanly when the viewer lacks the
 * relevant permission (billing/appointments) rather than showing a zero.
 */
export function WorkspaceSummaryRail({ items }: { items: SummaryRailItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className={cn("grid divide-x divide-y divide-border border-t border-border", GRID_COLS[Math.min(items.length, 4)])}>
      {items.map((item) => {
        const content = (
          <>
            <p className={typography.eyebrow}>{item.label}</p>
            <p
              className={cn(
                "font-heading mt-1 text-lg font-medium tabular-nums",
                item.tone === "warning" && "text-warning-text",
                item.tone === "success" && "text-success-text",
              )}
            >
              {item.value}
            </p>
          </>
        );

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            scroll={false}
            className="px-5 py-4 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            {content}
          </Link>
        ) : (
          <div key={item.label} className="px-5 py-4">
            {content}
          </div>
        );
      })}
    </div>
  );
}
