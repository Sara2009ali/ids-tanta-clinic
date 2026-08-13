"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteTreatmentPlanItem, reorderTreatmentPlanItems } from "@/lib/treatment-plans/actions";
import { TreatmentPlanItemDialog } from "@/components/treatment-plans/treatment-plan-item-dialog";
import { TreatmentPlanItemRow } from "@/components/treatment-plans/treatment-plan-item-row";
import { TreatmentPlanRecordTreatmentDialog } from "@/components/treatment-plans/treatment-plan-record-treatment-dialog";
import type { TreatmentPlanItemWithContext } from "@/lib/treatment-plans/queries";
import type { ScheduleRow } from "@/lib/appointments/queries";
import type { TreatmentPlanStatus, VisitType } from "@/types/domain";

export function TreatmentPlanItemsList({
  planId,
  planStatus,
  items,
  visitTypes,
  appointments,
  canEdit,
}: {
  planId: string;
  planStatus: TreatmentPlanStatus;
  items: TreatmentPlanItemWithContext[];
  visitTypes: VisitType[];
  appointments: ScheduleRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TreatmentPlanItemWithContext | null>(null);
  const [recordingItem, setRecordingItem] = useState<TreatmentPlanItemWithContext | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Items can only be hard-deleted while the plan itself is still draft — see
  // deleteTreatmentPlanItem()'s own server-side check, which re-enforces
  // this regardless of what the UI shows.
  const canDeleteItems = canEdit && planStatus === "draft";
  // Reordering is a "building the plan" activity — once proposed, the
  // sequence is the plan as communicated, so the control disappears rather
  // than inviting changes to a plan that's already active/finished.
  const canReorderItems = canEdit && planStatus === "draft";
  // Once a plan is completed/abandoned its item statuses are a historical
  // record, not something to casually re-toggle — this is the "reduce
  // editing affordances" requirement from the approved UX pass, presentation
  // only (the backend doesn't restrict this).
  const canChangeItemStatus = canEdit && (planStatus === "draft" || planStatus === "active");

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    startTransition(async () => {
      const result = await reorderTreatmentPlanItems(planId, reordered.map((i) => i.id));
      if (result.error) {
        toast.error(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      const result = await deleteTreatmentPlanItem(itemId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Procedure removed");
        setDeletingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add Procedure
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="This plan is empty"
          description="Add the procedures this patient needs — you can sequence, price, and prioritize them as you go."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add Procedure
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <TreatmentPlanItemRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              canChangeStatus={canChangeItemStatus}
              canReorder={canReorderItems}
              canDelete={canDeleteItems}
              onEdit={() => setEditingItem(item)}
              onDelete={() => setDeletingId(item.id)}
              onMoveUp={() => move(index, -1)}
              onMoveDown={() => move(index, 1)}
              onRecordTreatment={() => setRecordingItem(item)}
              canMoveUp={index > 0 && !pending}
              canMoveDown={index < items.length - 1 && !pending}
            />
          ))}
        </div>
      )}

      {canEdit && recordingItem && (
        <TreatmentPlanRecordTreatmentDialog
          item={recordingItem}
          visitTypes={visitTypes}
          open={!!recordingItem}
          onOpenChange={(open) => !open && setRecordingItem(null)}
        />
      )}

      {canEdit && addOpen && (
        <TreatmentPlanItemDialog
          planId={planId}
          visitTypes={visitTypes}
          appointments={appointments}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      )}

      {canEdit && editingItem && (
        <TreatmentPlanItemDialog
          planId={planId}
          visitTypes={visitTypes}
          appointments={appointments}
          item={editingItem}
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this procedure?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it from this draft plan. It hasn&apos;t been shown to the patient yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={() => deletingId && handleDelete(deletingId)}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
