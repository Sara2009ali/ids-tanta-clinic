"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Loader2, Pencil, Plus, Power, PowerOff, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  createVisitType,
  deleteVisitType,
  toggleVisitTypeActive,
  updateVisitType,
} from "@/lib/appointments/visit-type-actions";
import type { VisitTypeForManagement } from "@/lib/appointments/queries";

const DEFAULT_COLOR = "#6366f1";

function VisitTypeRow({
  visitType,
  onDeleteRequest,
}: {
  visitType: VisitTypeForManagement;
  onDeleteRequest: (visitType: VisitTypeForManagement) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(visitType.name);
  const [duration, setDuration] = useState(String(visitType.default_duration_minutes));
  const [color, setColor] = useState(visitType.color);
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("default_duration_minutes", duration);
      formData.set("color", color);
      const result = await updateVisitType(visitType.id, formData);
      if (result.error) {
        setError(result.fieldErrors?.name ?? result.fieldErrors?.default_duration_minutes ?? result.error);
        toast.error(result.error);
      } else {
        setEditing(false);
        setError(undefined);
        router.refresh();
      }
    });
  }

  function handleCancelEdit() {
    setEditing(false);
    setName(visitType.name);
    setDuration(String(visitType.default_duration_minutes));
    setColor(visitType.color);
    setError(undefined);
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleVisitTypeActive(visitType.id, !visitType.is_active);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(visitType.is_active ? `${visitType.name} disabled` : `${visitType.name} enabled`);
        router.refresh();
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            disabled={pending}
            aria-label="Color"
            className="size-7 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-block size-3.5 rounded-full"
            style={{ backgroundColor: visitType.color }}
          />
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <div className="space-y-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              aria-invalid={!!error}
              aria-label="Procedure name"
              className="h-8 w-44"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <span className="font-medium">{visitType.name}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {editing ? (
          <Input
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            disabled={pending}
            aria-label="Default duration in minutes"
            className="h-8 w-20"
          />
        ) : (
          `${visitType.default_duration_minutes} min`
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{visitType.clinic_name ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={visitType.is_active ? "secondary" : "outline"}>
          {visitType.is_active ? "Active" : "Disabled"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <Button size="icon-sm" variant="ghost" disabled={pending} onClick={handleSave} aria-label="Save">
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={handleCancelEdit}
                aria-label="Cancel"
              >
                <X className="size-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={() => setEditing(true)}
                aria-label={`Edit ${visitType.name}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={handleToggle}
                aria-label={visitType.is_active ? `Disable ${visitType.name}` : `Enable ${visitType.name}`}
              >
                {visitType.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onDeleteRequest(visitType)}
                aria-label={`Delete ${visitType.name}`}
                className="hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Mirrors ChairsManager exactly (inline create form + table with inline
 * edit/enable-disable/delete) with three fields instead of one. Filtering
 * (search/status) happens one level up, in the page, via VisitTypesFilters
 * — this component only ever renders the already-filtered list it's given,
 * same separation CompensationRulesTable keeps from CompensationRulesFilters.
 */
export function VisitTypesManager({
  visitTypes,
  hasFilters,
}: {
  visitTypes: VisitTypeForManagement[];
  hasFilters: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [createError, setCreateError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<VisitTypeForManagement | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createVisitType(formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.name ?? result.fieldErrors?.default_duration_minutes ?? result.error);
        toast.error(result.error);
      } else {
        setNewName("");
        setNewDuration("30");
        setNewColor(DEFAULT_COLOR);
        setCreateError(undefined);
        toast.success("Procedure added");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteVisitType(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${deleteTarget.name} deleted`);
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="new_visit_type_color" className="text-xs">
            Color
          </Label>
          <input
            id="new_visit_type_color"
            name="color"
            type="color"
            value={newColor}
            onChange={(event) => setNewColor(event.target.value)}
            disabled={pending}
            className="size-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new_visit_type_name" className="text-xs">
            New procedure name
          </Label>
          <Input
            id="new_visit_type_name"
            name="name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="e.g. Root Canal"
            aria-invalid={!!createError}
            disabled={pending}
            className="h-8 w-48"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="new_visit_type_duration" className="text-xs">
            Duration (min)
          </Label>
          <Input
            id="new_visit_type_duration"
            name="default_duration_minutes"
            type="number"
            min={5}
            max={480}
            value={newDuration}
            onChange={(event) => setNewDuration(event.target.value)}
            disabled={pending}
            className="h-8 w-24"
          />
        </div>
        {createError && <p className="text-xs text-destructive">{createError}</p>}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add procedure
        </Button>
      </form>

      {visitTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {hasFilters ? "No procedures match these filters." : "No procedures yet. Add one above."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Color</span>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visitTypes.map((visitType) => (
              <VisitTypeRow key={visitType.id} visitType={visitType} onDeleteRequest={setDeleteTarget} />
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the procedure. It can only be deleted if no appointments, compensation
              rules, or treatment records reference it — otherwise, disable it instead. This can&apos;t be
              undone from this UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
