import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared empty-state shell for tables/lists across every module — replaces
 * the near-identical "rounded-xl border-dashed ... py-16" divs that were
 * hand-duplicated per table. Copy/icon/action stay per-usage; only the
 * container and rhythm are standardized.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex animate-in flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center fade-in duration-150",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
