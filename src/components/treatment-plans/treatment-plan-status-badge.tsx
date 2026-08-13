import { Badge } from "@/components/ui/badge";
import { TREATMENT_PLAN_STATUS_LABELS, type TreatmentPlanStatus } from "@/types/domain";

const STATUS_BADGE_VARIANT: Record<TreatmentPlanStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  draft: "outline",
  active: "default",
  completed: "success",
  abandoned: "destructive",
};

export function TreatmentPlanStatusBadge({ status }: { status: TreatmentPlanStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{TREATMENT_PLAN_STATUS_LABELS[status]}</Badge>;
}
