import { Badge } from "@/components/ui/badge";
import { PATIENT_STATUS_LABELS, type PatientStatus } from "@/types/domain";

const STATUS_VARIANT: Record<PatientStatus, "success" | "secondary" | "warning"> = {
  active: "success",
  inactive: "secondary",
  archived: "warning",
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{PATIENT_STATUS_LABELS[status]}</Badge>;
}
