import { Badge } from "@/components/ui/badge";
import type { AlertSeverity } from "@/types/domain";

const SEVERITY_VARIANT: Record<AlertSeverity, "secondary" | "warning" | "destructive"> = {
  info: "secondary",
  warning: "warning",
  critical: "destructive",
};

export function MedicalAlertBadge({ label, severity }: { label: string; severity: AlertSeverity }) {
  return <Badge variant={SEVERITY_VARIANT[severity]}>{label}</Badge>;
}
