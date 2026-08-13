"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CalendarCheck2, CircleCheck, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/billing/format";
import { changeTreatmentPlanItemStatus } from "@/lib/treatment-plans/actions";
import { TreatmentPlanItemPriorityBadge, TreatmentPlanItemStatusBadge } from "@/components/treatment-plans/treatment-plan-item-badges";
import { TREATMENT_PLAN_ITEM_STATUS_LABELS, type TreatmentPlanItemStatus } from "@/types/domain";
import type { TreatmentPlanItemWithContext } from "@/lib/treatment-plans/queries";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * One proposed procedure. Deliberately a card, not a dense spreadsheet row —
 * the approved design calls for "cards/rows with enough hierarchy for
 * dentists to scan quickly," and planned-vs-performed needs to be visually
 * obvious rather than another column to read.
 */
export function TreatmentPlanItemRow({
  item,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  item: TreatmentPlanItemWithContext;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isPerformed = item.performed.length > 0;
  const latestPerformed = isPerformed
    ? item.performed.reduce((latest, p) => (p.performedAt > latest.performedAt ? p : latest))
    : null;

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
    <div className="space-y-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-medium">{item.procedure_name}</p>
            {item.tooth_reference && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                Tooth {item.tooth_reference}
              </span>
            )}
            {item.priority !== "normal" && <TreatmentPlanItemPriorityBadge priority={item.priority as "high" | "urgent"} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(Number(item.estimated_price))}
            {Number(item.quantity) !== 1 && ` × ${Number(item.quantity)}`}
          </p>
        </div>

        {canEdit ? (
          <Select
            items={TREATMENT_PLAN_ITEM_STATUS_LABELS}
            value={item.status}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger size="sm" disabled={pending}>
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
      </div>

      {item.notes && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{item.notes}</p>}

      {(item.appointmentScheduledStart || isPerformed) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {item.appointmentScheduledStart && (
            <span className="inline-flex items-center gap-1">
              <CalendarCheck2 className="size-3.5" />
              Appointment {formatDateTime(item.appointmentScheduledStart)}
            </span>
          )}
          {isPerformed && latestPerformed && (
            <span className="inline-flex items-center gap-1 text-success-text">
              <CircleCheck className="size-3.5" />
              Performed {formatDate(latestPerformed.performedAt)}
              {item.performed.length > 1 && ` (${item.performed.length} visits)`}
            </span>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-sm" disabled={!canMoveUp} onClick={onMoveUp} aria-label="Move up">
            <ArrowUp className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" disabled={!canMoveDown} onClick={onMoveDown} aria-label="Move down">
            <ArrowDown className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          {canDelete && (
            <Button variant="ghost" size="sm" className="hover:text-destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
