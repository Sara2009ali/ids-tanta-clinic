import * as React from "react";

import { cn } from "@/lib/utils";
import { EMPTY_STATE_ILLUSTRATIONS, type EmptyStateIllustrationName } from "@/components/ui/empty-state-illustration";

/**
 * Shared empty-state shell for tables/lists across every module — replaces
 * the near-identical "rounded-xl border-dashed ... py-16" divs that were
 * hand-duplicated per table. Copy/icon/action stay per-usage; only the
 * container and rhythm are standardized.
 *
 * `illustration` is an opt-in, larger visual for genuine first-run moments
 * (an empty patients/invoices/products list) — reserved for the handful of
 * screens where "teach and guide" is worth more visual weight than a plain
 * icon. Everywhere else (filtered-to-zero-results, a sub-tab with nothing
 * yet) stays on the lighter `icon` treatment so illustrations don't become
 * visual noise themselves.
 */
function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: EmptyStateIllustrationName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const Illustration = illustration ? EMPTY_STATE_ILLUSTRATIONS[illustration] : undefined;

  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex animate-in flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center fade-in duration-150",
        className,
      )}
      {...props}
    >
      {Illustration ? (
        <Illustration className="mb-1 h-[66px] w-auto" />
      ) : (
        Icon && (
          <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" />
          </div>
        )
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
