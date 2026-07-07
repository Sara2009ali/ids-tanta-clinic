import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AlertSeverity } from "@/types/domain";

const SEVERITY_CLASSES: Record<AlertSeverity, string> = {
  info: "bg-accent text-accent-foreground",
  warning: "bg-warning/15 text-amber-700 dark:text-amber-400 border-warning/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

export function MedicalAlertBadge({
  label,
  severity,
}: {
  label: string;
  severity: AlertSeverity;
}) {
  return (
    <Badge variant="outline" className={cn(SEVERITY_CLASSES[severity])}>
      {label}
    </Badge>
  );
}
