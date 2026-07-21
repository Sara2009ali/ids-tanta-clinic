import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  unavailable,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  unavailable?: boolean;
  /** Marks this one card as a "premium/featured" high-value indicator — soft gold accent, used sparingly (at most one per page) per the brand direction. */
  highlight?: "gold";
}) {
  return (
    <Card className={cn(highlight === "gold" && "ring-gold/40")}>
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              "mt-1 text-2xl font-semibold tabular-nums",
              unavailable && "text-muted-foreground/50",
            )}
          >
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground",
            highlight === "gold" && "bg-gold/15 text-gold-text",
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
