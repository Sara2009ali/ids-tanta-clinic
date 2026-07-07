import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PATIENT_STATUS_LABELS, type PatientStatus } from "@/types/domain";

const STATUS_CLASSES: Record<PatientStatus, string> = {
  active: "bg-success/15 text-success border-success/30",
  inactive: "bg-muted text-muted-foreground",
  archived: "bg-warning/15 text-amber-700 dark:text-amber-400 border-warning/30",
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_CLASSES[status])}>
      {PATIENT_STATUS_LABELS[status]}
    </Badge>
  );
}
