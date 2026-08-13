"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CalendarClock, CircleCheck, Loader2, Pencil, Stethoscope, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/billing/format";
import { changeTreatmentPlanItemStatus } from "@/lib/treatment-plans/actions";
import { isAppointmentTreatmentEligible } from "@/lib/treatment-plans/calculations";
import { TreatmentPlanItemPriorityBadge, TreatmentPlanItemStatusBadge } from "@/components/treatment-plans/treatment-plan-item-badges";
import { TREATMENT_PLAN_ITEM_STATUS_LABELS, type TreatmentPlanItemStatus } from "@/types/domain";
import { cn } from "@/lib/utils";
import type { TreatmentPlanItemWithContext } from "@/lib/treatment-plans/queries";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One proposed procedure. Deliberately a card, not a dense spreadsheet row —
 * visual priority follows the approved mental model: procedure + priority,
 * then tooth/site + clinical note as one scannable caption, then status
 * paired with its scheduling/performed state as a badge cluster, then price
 * de-emphasized at the bottom (it matters, but it's not what a dentist scans
 * for first while reviewing what a patient needs).
 */
export function TreatmentPlanItemRow({
  item,
  canEdit,
  canChangeStatus,
  canReorder,
  canDelete,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onRecordTreatment,
  canMoveUp,
  canMoveDown,
}: {
  item: TreatmentPlanItemWithContext;
  canEdit: boolean;
  /** False once the plan itself is completed/abandoned — status becomes a historical fact, not something to casually re-toggle. */
  canChangeStatus: boolean;
  /** True only while the plan is still draft — reordering is a "building the plan" activity, not a "tracking it" one. */
  canReorder: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRecordTreatment: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isPerformed = item.performed.length > 0;
  const latestPerformed = isPerformed
    ? item.performed.reduce((latest, p) => (p.performedAt > latest.performedAt ? p : latest))
    : null;
  const isUrgent = item.priority === "urgent";
  // Same rule TreatmentRecordForm/AppointmentEditSheet already gate on
  // ("only makes sense once the patient has actually been seen"), reused
  // from this second entry point rather than invented fresh.
  const canRecordTreatment = canEdit && !!item.appointment_id && isAppointmentTreatmentEligible(item.appointmentStatus);

  const caption = [item.tooth_reference, item.notes].filter(Boolean).join(" · ");

  function handleStatusChange(status: string | null) {
    if (!status) return;
    startTransition(async () => {
      const result = await changeTreatmentPlanItemStatus(item.id, status);
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div
      className={cn(
        "space-y-2.5 rounded-xl border border-border p-4",
        isUrgent && "border-l-2 border-l-destructive",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-1.5">
        {isUrgent && <TreatmentPlanItemPriorityBadge priority="urgent" />}
        {item.priority === "high" && <TreatmentPlanItemPriorityBadge priority="high" />}
        <p className="font-medium">{item.procedure_name}</p>
      </div>

      {caption && <p className="line-clamp-2 text-sm text-muted-foreground">{caption}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {canChangeStatus ? (
          <Select items={TREATMENT_PLAN_ITEM_STATUS_LABELS} value={item.status} onValueChange={handleStatusChange}>
            <SelectTrigger size="sm" disabled={pending} aria-label={`Status for ${item.procedure_name}`}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <SelectValue />}
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(TREATMENT_PLAN_ITEM_STATUS_LABELS) as [TreatmentPlanItemStatus, string][]).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        ) : (
          <TreatmentPlanItemStatusBadge status={item.status as TreatmentPlanItemStatus} />
        )}

        {item.appointmentScheduledStart && (
          <Badge variant="outline">
            <CalendarClock className="size-3" />
            {formatDateTime(item.appointmentScheduledStart)}
          </Badge>
        )}

        {isPerformed && latestPerformed && (
          <Badge variant="success">
            <CircleCheck className="size-3" />
            Performed {formatDate(latestPerformed.performedAt)}
            {item.performed.length > 1 && ` (${item.performed.length}×)`}
          </Badge>
        )}
      </div>

      {canEdit && !item.appointment_id && (
        <p className="text-xs text-muted-foreground">Link an appointment to this procedure to record treatment.</p>
      )}

      <p className="text-xs text-muted-foreground">
        Estimated {formatCurrency(Number(item.estimated_price))}
        {Number(item.quantity) !== 1 && ` × ${Number(item.quantity)}`}
      </p>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border pt-2">
          {canRecordTreatment ? (
            <Button variant="outline" size="sm" onClick={onRecordTreatment}>
              <Stethoscope className="size-3.5" />
              Record Treatment
            </Button>
          ) : (
            <span />
          )}

          <div className="flex flex-wrap items-center gap-1">
            {canReorder && (
              <>
                <Button variant="ghost" size="icon-sm" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Move up">
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Move down">
                  <ArrowDown className="size-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="hover:text-destructive"
                onClick={onDelete}
                aria-label={`Remove ${item.procedure_name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
