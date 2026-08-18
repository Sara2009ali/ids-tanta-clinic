import { Badge } from "@/components/ui/badge";
import {
  TREATMENT_PLAN_ITEM_PRIORITY_LABELS,
  TREATMENT_PLAN_ITEM_STATUS_LABELS,
  type TreatmentPlanItemPriority,
  type TreatmentPlanItemStatus,
} from "@/types/domain";

/**
 * in_progress uses the "gold" token (already defined in badge.tsx/
 * globals.css, previously only used by dashboard StatCard highlights) so it
 * reads distinctly from postponed's "warning" — an active, moving-forward
 * state and a stalled one shouldn't share one color when scanning a plan.
 */
const STATUS_BADGE_VARIANT: Record<TreatmentPlanItemStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "gold"> = {
  planned: "outline",
  accepted: "default",
  postponed: "warning",
  rejected: "destructive",
  in_progress: "gold",
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
