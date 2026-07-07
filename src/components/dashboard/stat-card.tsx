import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  unavailable,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  unavailable?: boolean;
}) {
  return (
    <Card>
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
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
