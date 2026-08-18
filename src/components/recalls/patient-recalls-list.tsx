"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { RecallFormSheet } from "@/components/recalls/recall-form-sheet";
import { RecallStatusActions } from "@/components/recalls/recall-status-actions";
import { deleteRecall } from "@/lib/recalls/actions";
import { canDeleteRecall, isRecallOverdue } from "@/lib/recalls/calculations";
import { APPOINTMENT_STATUS_LABELS } from "@/types/domain";
import type { RecallListRow } from "@/lib/recalls/queries";
import type { DoctorOption } from "@/lib/patients/queries";
import type { VisitType } from "@/types/domain";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RecallCard({
  recall,
  canEdit,
  onEdit,
  onDelete,
}: {
  recall: RecallListRow;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = isRecallOverdue(recall);

  return (
    <div className="space-y-2.5 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-baseline gap-1.5">
        <p className="font-medium">{recall.reason}</p>
        {recall.procedure_name && <Badge variant="outline">{recall.procedure_name}</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <RecallStatusActions recallId={recall.id} status={recall.status} dueDate={recall.due_date} canEdit={canEdit} />
        <Badge variant="secondary" className={overdue ? "text-destructive" : undefined}>
          Due {formatDate(recall.due_date)}
        </Badge>
        {recall.doctor_name && <Badge variant="outline">Dr. {recall.doctor_name}</Badge>}
        {recall.appointment_scheduled_start && (
          <Badge variant="outline">
            <CalendarClock className="size-3" />
            {formatDateTime(recall.appointment_scheduled_start)}
            {recall.appointment_status && ` (${APPOINTMENT_STATUS_LABELS[recall.appointment_status]})`}
          </Badge>
        )}
      </div>

      {recall.notes && <p className="line-clamp-2 text-sm text-muted-foreground">{recall.notes}</p>}

      {canEdit && (
        <div className="flex items-center justify-end gap-1 border-t border-border pt-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          {canDeleteRecall(recall.status) && (
            <Button variant="ghost" size="sm" className="hover:text-destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact, patient-scoped recall list — deliberately not another worklist
 * (that's RecallsTable's job on /recalls): a card per recall, same density
 * as TreatmentPlanItemRow, sorted soonest-due-first as returned by
 * getRecallsForPatient().
 */
export function PatientRecallsList({
  patientId,
  patientName,
  recalls,
  doctors,
  visitTypes,
  canEdit,
}: {
  patientId: string;
  patientName: string;
  recalls: RecallListRow[];
  doctors: DoctorOption[];
  visitTypes: VisitType[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRecall, setEditingRecall] = useState<RecallListRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(recallId: string) {
    startTransition(async () => {
      const result = await deleteRecall(recallId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Recall deleted");
        setDeletingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            New Recall
          </Button>
        </div>
      )}

      {recalls.length === 0 ? (
        <EmptyState
          title="No recalls for this patient"
          description="Flag a follow-up — a hygiene recall, a post-op review, anything that needs a future visit."
          action={
            canEdit ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New Recall
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {recalls.map((recall) => (
            <RecallCard
              key={recall.id}
              recall={recall}
              canEdit={canEdit}
              onEdit={() => setEditingRecall(recall)}
              onDelete={() => setDeletingId(recall.id)}
            />
          ))}
        </div>
      )}

      {canEdit && createOpen && (
        <RecallFormSheet
          initialPatient={{ id: patientId, full_name: patientName }}
          doctors={doctors}
          visitTypes={visitTypes}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      {canEdit && editingRecall && (
        <RecallFormSheet
          recall={editingRecall}
          doctors={doctors}
          visitTypes={visitTypes}
          open={!!editingRecall}
          onOpenChange={(open) => !open && setEditingRecall(null)}
        />
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recall?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it. It&apos;s only offered while the recall is still due.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={() => deletingId && handleDelete(deletingId)}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
