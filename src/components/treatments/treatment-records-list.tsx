"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { deleteTreatmentRecord, updateTreatmentRecord } from "@/lib/treatments/actions";
import type { DoctorOption } from "@/lib/patients/queries";
import type { TreatmentRecord, VisitType } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * One shared component for both call sites — the appointment Sheet's
 * Treatment tab (one appointment's records) and Patient Profile's Clinical
 * Notes tab (a patient's full history) — same expand-to-see-detail shape
 * MyCompensationEarningsTable already established, reused rather than
 * inventing a second row pattern.
 */
export function TreatmentRecordsList({
  records,
  visitTypes,
  doctors,
  canEdit,
  emptyMessage,
}: {
  records: TreatmentRecord[];
  visitTypes: VisitType[];
  doctors: DoctorOption[];
  canEdit: boolean;
  emptyMessage: string;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVisitTypeId, setEditVisitTypeId] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(record: TreatmentRecord) {
    setExpanded((prev) => new Set(prev).add(record.id));
    setEditingId(record.id);
    setEditVisitTypeId(record.visit_type_id);
    setEditNotes(record.notes ?? "");
  }

  function handleSave(recordId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("visit_type_id", editVisitTypeId);
      formData.set("notes", editNotes);
      const result = await updateTreatmentRecord(recordId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Treatment record updated");
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleDelete(recordId: string) {
    startTransition(async () => {
      const result = await deleteTreatmentRecord(recordId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Treatment record removed");
        setDeletingId(null);
        router.refresh();
      }
    });
  }

  if (records.length === 0) {
    return (
      <EmptyState title={emptyMessage} />
    );
  }

  const columnCount = canEdit ? 5 : 4;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <span className="sr-only">Expand</span>
            </TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Procedure</TableHead>
            <TableHead>Doctor</TableHead>
            {canEdit && (
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const isExpanded = expanded.has(record.id);
            const isEditing = editingId === record.id;
            const procedureName = visitTypes.find((v) => v.id === record.visit_type_id)?.name ?? "—";
            const doctorName = doctors.find((d) => d.id === record.doctor_id)?.full_name ?? "—";

            return (
              <Fragment key={record.id}>
                <TableRow>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggle(record.id)}>
                      {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      <span className="sr-only">Details</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(record.created_at)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{procedureName}</Badge>
                  </TableCell>
                  <TableCell>Dr. {doctorName}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(record)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:text-destructive"
                          onClick={() => setDeletingId(record.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
                {isExpanded && (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="bg-muted/30">
                      {isEditing ? (
                        <div className="space-y-3 py-2">
                          <Select value={editVisitTypeId} onValueChange={(v) => v && setEditVisitTypeId(v)}>
                            <SelectTrigger className="w-full sm:w-64">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {visitTypes.map((visitType) => (
                                <SelectItem key={visitType.id} value={visitType.id}>
                                  {visitType.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Textarea
                            value={editNotes}
                            onChange={(event) => setEditNotes(event.target.value)}
                            placeholder="Notes"
                            rows={3}
                          />
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                            <Button size="sm" disabled={pending} onClick={() => handleSave(record.id)}>
                              {pending && <Loader2 className="size-3.5 animate-spin" />}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="py-2 text-sm whitespace-pre-wrap">{record.notes || "No notes recorded."}</p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this treatment record?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the patient&apos;s treatment history. It can only be restored by a database
              administrator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
