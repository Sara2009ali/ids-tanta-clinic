"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { createClinicalNote, deleteClinicalNote, updateClinicalNote } from "@/lib/clinical-notes/actions";
import type { ClinicalNoteWithContext } from "@/lib/clinical-notes/queries";
import type { ScheduleRow } from "@/lib/appointments/queries";

const NO_APPOINTMENT = "__none__";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function appointmentLabel(appointment: ScheduleRow): string {
  return `${formatDateTime(appointment.scheduled_start)} — ${appointment.visit_type_name}`;
}

function AppointmentPicker({
  id,
  appointments,
  value,
  onValueChange,
}: {
  id: string;
  appointments: ScheduleRow[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const items = { [NO_APPOINTMENT]: "No linked appointment", ...Object.fromEntries(appointments.map((a) => [a.id, appointmentLabel(a)])) };

  return (
    <Select items={items} value={value || NO_APPOINTMENT} onValueChange={(v) => v && onValueChange(v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_APPOINTMENT}>No linked appointment</SelectItem>
        {appointments.map((appointment) => (
          <SelectItem key={appointment.id} value={appointment.id}>
            {appointmentLabel(appointment)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Deliberately a card list, not the dense table treatment_records uses
 * (TreatmentRecordsList) — a procedure name fits a table cell, a narrative
 * clinical note doesn't, and Step 4 requires the note text to be visibly
 * readable rather than hidden behind an expand toggle.
 */
export function ClinicalNotesList({
  patientId,
  notes,
  appointments,
  canEdit,
  emptyMessage,
}: {
  patientId: string;
  notes: ClinicalNoteWithContext[];
  appointments: ScheduleRow[];
  canEdit: boolean;
  emptyMessage: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [newNote, setNewNote] = useState("");
  const [newAppointmentId, setNewAppointmentId] = useState("");
  const [createError, setCreateError] = useState<string | undefined>();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editAppointmentId, setEditAppointmentId] = useState("");
  const [editError, setEditError] = useState<string | undefined>();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleCreate() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("note", newNote);
      formData.set("appointment_id", newAppointmentId === NO_APPOINTMENT ? "" : newAppointmentId);
      const result = await createClinicalNote(patientId, formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.note ?? result.error);
        toast.error(result.error);
      } else {
        setNewNote("");
        setNewAppointmentId("");
        setCreateError(undefined);
        toast.success("Note added");
        router.refresh();
      }
    });
  }

  function startEdit(note: ClinicalNoteWithContext) {
    setEditingId(note.id);
    setEditNote(note.note);
    setEditAppointmentId(note.appointment_id ?? "");
    setEditError(undefined);
  }

  function handleSave(noteId: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("note", editNote);
      formData.set("appointment_id", editAppointmentId === NO_APPOINTMENT ? "" : editAppointmentId);
      const result = await updateClinicalNote(noteId, formData);
      if (result.error) {
        setEditError(result.fieldErrors?.note ?? result.error);
        toast.error(result.error);
      } else {
        toast.success("Note updated");
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleDelete(noteId: string) {
    startTransition(async () => {
      const result = await deleteClinicalNote(noteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Note removed");
        setDeletingId(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="clinical_note_text">New note *</Label>
            <Textarea
              id="clinical_note_text"
              value={newNote}
              onChange={(event) => setNewNote(event.target.value)}
              placeholder="e.g. Reviewed panoramic X-ray. No obvious carious lesions. Monitor lower third molar."
              rows={3}
              aria-invalid={!!createError}
            />
            {createError && (
              <p className="text-sm text-destructive" role="alert">
                {createError}
              </p>
            )}
          </div>

          {appointments.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="clinical_note_appointment">Linked appointment (optional)</Label>
              <AppointmentPicker
                id="clinical_note_appointment"
                appointments={appointments}
                value={newAppointmentId}
                onValueChange={setNewAppointmentId}
              />
            </div>
          )}

          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={pending || !newNote.trim()} onClick={handleCreate}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add note
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState title={emptyMessage} />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const isEditing = editingId === note.id;
            const wasEdited = note.updated_at !== note.created_at;

            return (
              <div key={note.id} className="space-y-3 rounded-xl border border-border p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editNote}
                      onChange={(event) => setEditNote(event.target.value)}
                      rows={3}
                      aria-invalid={!!editError}
                    />
                    {editError && (
                      <p className="text-sm text-destructive" role="alert">
                        {editError}
                      </p>
                    )}
                    {appointments.length > 0 && (
                      <AppointmentPicker
                        id={`clinical_note_edit_appointment_${note.id}`}
                        appointments={appointments}
                        value={editAppointmentId}
                        onValueChange={setEditAppointmentId}
                      />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" disabled={pending || !editNote.trim()} onClick={() => handleSave(note.id)}>
                        {pending && <Loader2 className="size-3.5 animate-spin" />}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                      <span>{note.authorName ?? "Unknown author"}</span>
                      <span>{formatDateTime(note.created_at)}</span>
                      {wasEdited && <span>Edited {formatDateTime(note.updated_at)}</span>}
                      {note.appointmentScheduledStart && (
                        <Badge variant="secondary">Linked to appointment on {formatDateTime(note.appointmentScheduledStart)}</Badge>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(note)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:text-destructive"
                          onClick={() => setDeletingId(note.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this note?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it from the patient&apos;s clinical notes. It can only be restored by a database
              administrator.
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
