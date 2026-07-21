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
import { createCategory, deleteCategory, toggleCategoryActive, updateCategory } from "@/lib/inventory/actions";
import type { CategoryForManagement } from "@/lib/inventory/queries";

function CategoryRow({
  category,
  canManage,
  onDeleteRequest,
}: {
  category: CategoryForManagement;
  canManage: boolean;
  onDeleteRequest: (category: CategoryForManagement) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      const result = await updateCategory(category.id, formData);
      if (result.error) {
        setError(result.fieldErrors?.name ?? result.error);
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
    setName(category.name);
    setError(undefined);
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleCategoryActive(category.id, !category.is_active);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(category.is_active ? `${category.name} disabled` : `${category.name} enabled`);
        router.refresh();
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <div className="space-y-1">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={pending}
              aria-invalid={!!error}
              aria-label="Category name"
              className="h-8 w-44"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <span className="font-medium">{category.name}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{category.clinic_name ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={category.is_active ? "secondary" : "outline"}>{category.is_active ? "Active" : "Disabled"}</Badge>
      </TableCell>
      {canManage && (
        <TableCell>
          <div className="flex items-center justify-end gap-1">
            {editing ? (
              <>
                <Button size="icon-sm" variant="ghost" disabled={pending} onClick={handleSave} aria-label="Save">
                  {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                </Button>
                <Button size="icon-sm" variant="ghost" disabled={pending} onClick={handleCancelEdit} aria-label="Cancel">
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
                  aria-label={`Edit ${category.name}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={handleToggle}
                  aria-label={category.is_active ? `Disable ${category.name}` : `Enable ${category.name}`}
                >
                  {category.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onDeleteRequest(category)}
                  aria-label={`Delete ${category.name}`}
                  className="hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

/** Mirrors ChairsManager exactly — inline create form + table with inline edit/enable-disable/delete. inventory.view-only visitors get the read-only list (no create form, no Actions column). */
export function CategoriesManager({ categories, canManage }: { categories: CategoryForManagement[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<CategoryForManagement | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createCategory(formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.name ?? result.error);
        toast.error(result.error);
      } else {
        setNewName("");
        setCreateError(undefined);
        toast.success("Category added");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteCategory(deleteTarget.id);
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
      {canManage && (
        <form action={handleCreate} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="new_category_name" className="text-xs">
              New category name
            </Label>
            <Input
              id="new_category_name"
              name="name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Consumables"
              aria-invalid={!!createError}
              disabled={pending}
              className="h-8 w-48"
            />
            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add category
          </Button>
        </form>
      )}

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet. Add one above.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Clinic</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} canManage={canManage} onDeleteRequest={setDeleteTarget} />
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the category. It can only be deleted if no products use it — otherwise,
              disable it instead. This can&apos;t be undone from this UI.
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
