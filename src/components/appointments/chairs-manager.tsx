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
import { createChair, deleteChair, toggleChairActive, updateChair } from "@/lib/appointments/chair-actions";
import type { ChairForManagement } from "@/lib/appointments/queries";

function ChairRow({
  chair,
  order,
  onDeleteRequest,
}: {
  chair: ChairForManagement;
  order: number;
  onDeleteRequest: (chair: ChairForManagement) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(chair.label);
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", label);
      const result = await updateChair(chair.id, formData);
      if (result.error) {
        setError(result.fieldErrors?.label ?? result.error);
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
    setLabel(chair.label);
    setError(undefined);
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleChairActive(chair.id, !chair.is_active);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(chair.is_active ? `${chair.label} disabled` : `${chair.label} enabled`);
        router.refresh();
      }
    });
  }

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{order}</TableCell>
      <TableCell>
        {editing ? (
          <div className="space-y-1">
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={pending}
              aria-invalid={!!error}
              aria-label="Chair name"
              className="h-8 w-40"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <span className="font-medium">{chair.label}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{chair.clinic_name ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={chair.is_active ? "secondary" : "outline"}>{chair.is_active ? "Active" : "Disabled"}</Badge>
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
                aria-label={`Edit ${chair.label}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={handleToggle}
                aria-label={chair.is_active ? `Disable ${chair.label}` : `Enable ${chair.label}`}
              >
                {chair.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onDeleteRequest(chair)}
                aria-label={`Delete ${chair.label}`}
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
 * "Order" below is the list's current display position (alphabetical by
 * label), not a separately stored/reorderable field — chairs has no such
 * column, and Phase 3B's Chair Management scope doesn't call for manual
 * reordering, only listing, create/edit/enable-disable/delete.
 */
export function ChairsManager({ chairs }: { chairs: ChairForManagement[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newLabel, setNewLabel] = useState("");
  const [createError, setCreateError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ChairForManagement | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createChair(formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.label ?? result.error);
        toast.error(result.error);
      } else {
        setNewLabel("");
        setCreateError(undefined);
        toast.success("Chair added");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteChair(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${deleteTarget.label} deleted`);
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={handleCreate} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="new_chair_label" className="text-xs">
            New chair name
          </Label>
          <Input
            id="new_chair_label"
            name="label"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="e.g. Chair 3"
            aria-invalid={!!createError}
            disabled={pending}
            className="h-8 w-48"
          />
          {createError && <p className="text-xs text-destructive">{createError}</p>}
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add chair
        </Button>
      </form>

      {chairs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No chairs yet. Add one above.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Order</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chairs.map((chair, index) => (
              <ChairRow key={chair.id} chair={chair} order={index + 1} onDeleteRequest={setDeleteTarget} />
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the chair. Past appointments that used it keep every other
              detail but will show no chair. This can&apos;t be undone from this UI.
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
