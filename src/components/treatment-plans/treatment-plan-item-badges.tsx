import { Badge } from "@/components/ui/badge";
import {
  TREATMENT_PLAN_ITEM_PRIORITY_LABELS,
  TREATMENT_PLAN_ITEM_STATUS_LABELS,
  type TreatmentPlanItemPriority,
  type TreatmentPlanItemStatus,
} from "@/types/domain";

const STATUS_BADGE_VARIANT: Record<TreatmentPlanItemStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  planned: "outline",
  accepted: "default",
  postponed: "warning",
  rejected: "destructive",
  in_progress: "warning",
  completed: "success",
};

export function TreatmentPlanItemStatusBadge({ status }: { status: TreatmentPlanItemStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{TREATMENT_PLAN_ITEM_STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_BADGE_VARIANT: Record<TreatmentPlanItemPriority, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  normal: "secondary",
  high: "warning",
  urgent: "destructive",
};

/** Only rendered for high/urgent — a "Normal" chip on every single item would just be visual noise (see the item row, which calls this conditionally). */
export function TreatmentPlanItemPriorityBadge({ priority }: { priority: TreatmentPlanItemPriority }) {
  return <Badge variant={PRIORITY_BADGE_VARIANT[priority]}>{TREATMENT_PLAN_ITEM_PRIORITY_LABELS[priority]}</Badge>;
}
