import { Badge, type badgeVariants } from "@/components/ui/badge";
import { TOOTH_CONDITION_LABELS, TOOTH_STATUS_LABELS, type ToothCondition, type ToothStatus } from "@/types/domain";
import type { VariantProps } from "class-variance-authority";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Same Record<Status, BadgeVariant> + dedicated <X>Badge shape as TreatmentPlanItemStatusBadge/TreatmentPlanStatusBadge. */
const STATUS_BADGE_VARIANT: Record<ToothStatus, BadgeVariant> = {
  present: "outline",
  missing: "secondary",
  unerupted: "secondary",
};

export function ToothStatusBadge({ status }: { status: ToothStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{TOOTH_STATUS_LABELS[status]}</Badge>;
}

/** caries/watch are open clinical concerns (destructive/warning); filling/crown/root_canal/other are existing, already-addressed work (neutral secondary) — same distinction toothNeedsAttention() in calculations.ts encodes. */
const CONDITION_BADGE_VARIANT: Record<ToothCondition, BadgeVariant> = {
  caries: "destructive",
  watch: "warning",
  filling: "secondary",
  crown: "secondary",
  root_canal: "secondary",
  other: "secondary",
};

export function ToothConditionBadge({ condition }: { condition: ToothCondition }) {
  return <Badge variant={CONDITION_BADGE_VARIANT[condition]}>{TOOTH_CONDITION_LABELS[condition]}</Badge>;
}
