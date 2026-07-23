import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { typography } from "@/lib/typography";
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
    <Card className={cn(highlight === "gold" && "ring-gold/40 shadow-elevation-featured")}>
      <CardContent>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="size-3.5 shrink-0" />
          <p className="truncate text-sm">{label}</p>
          {highlight === "gold" && (
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-gold" />
          )}
        </div>
        <p
          className={cn(
            "mt-2",
            typography.statValue,
            unavailable && "text-muted-foreground/50",
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
