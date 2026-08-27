"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Loader2, Pencil, Trash2 } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RecallStatusActions } from "@/components/recalls/recall-status-actions";
import { RecallFormSheet } from "@/components/recalls/recall-form-sheet";
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

/**
 * Cross-patient worklist — same shape InvoicesTable already established
 * (server-paginated rows rendered as-is, no client-side re-sort invented
 * here since none was asked for). Overdue gets a clear warning treatment
 * via RecallStatusBadge's own destructive-variant handling plus a
 * destructive tone on the due date cell — no new color/badge system, just
 * the existing `destructive` variant already used everywhere else.
 */
export function RecallsTable({
  rows,
  hasFilters,
  doctors,
  visitTypes,
  canEdit,
}: {
  rows: RecallListRow[];
  hasFilters: boolean;
  doctors: DoctorOption[];
  visitTypes: VisitType[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  if (rows.length === 0) {
    return hasFilters ? (
      <EmptyState title="No recalls match these filters" description="Try a different status, doctor, or search term." />
    ) : (
      <EmptyState
        title="No recalls yet"
        description="Flag a patient for a clinical follow-up and it will show up here, sorted by due date."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned Doctor</TableHead>
            <TableHead>Linked Appointment</TableHead>
            <TableHead className="text-end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const overdue = isRecallOverdue(row);
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  <Link href={`/patients/${row.patient_id}?tab=recalls`} className="hover:underline">
                    {row.patient_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <p className="line-clamp-2">{row.reason}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {row.procedure_name && <Badge variant="outline">{row.procedure_name}</Badge>}
                    {row.treatment_record_id && (
                      <Badge variant="secondary" title="Automatically generated from a completed treatment">
                        Auto
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                  {formatDate(row.due_date)}
                </TableCell>
                <TableCell>
                  <RecallStatusActions recallId={row.id} status={row.status} dueDate={row.due_date} canEdit={canEdit} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.doctor_name ? `Dr. ${row.doctor_name}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.appointment_scheduled_start ? (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarClock className="size-3.5" />
                      {formatDateTime(row.appointment_scheduled_start)}
                      {row.appointment_status && (
                        <span className="text-xs">({APPOINTMENT_STATUS_LABELS[row.appointment_status]})</span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit recall for ${row.patient_name}`} onClick={() => setEditingRecall(row)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      {canDeleteRecall(row.status) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="hover:text-destructive"
                          aria-label={`Delete recall for ${row.patient_name}`}
                          onClick={() => setDeletingId(row.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {editingRecall && (
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
