import { Badge } from "@/components/ui/badge";
import { isRecallOverdue } from "@/lib/recalls/calculations";
import { RECALL_STATUS_LABELS, type RecallStatus } from "@/types/domain";

const STATUS_BADGE_VARIANT: Record<RecallStatus, "default" | "secondary" | "outline" | "destructive" | "success" | "warning"> = {
  due: "secondary",
  scheduled: "default",
  completed: "success",
  dismissed: "outline",
};

/**
 * Overdue is a display state layered on top of `due`, never a fifth stored
 * status (see isRecallOverdue()) — this badge is the one place that
 * distinction becomes visible: an overdue recall still reads "Due" but in
 * the destructive variant instead of secondary, the same warning-tone
 * convention TreatmentPlanItemStatusBadge already uses for its own
 * clinically-notable states.
 */
export function RecallStatusBadge({ status, dueDate }: { status: RecallStatus; dueDate: string }) {
  const overdue = isRecallOverdue({ status, due_date: dueDate });
  return (
    <Badge variant={overdue ? "destructive" : STATUS_BADGE_VARIANT[status]}>
      {overdue ? "Overdue" : RECALL_STATUS_LABELS[status]}
    </Badge>
  );
}
