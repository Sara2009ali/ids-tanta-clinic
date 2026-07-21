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
import { createSupplier, deleteSupplier, toggleSupplierActive, updateSupplier } from "@/lib/inventory/actions";
import type { SupplierForManagement } from "@/lib/inventory/queries";

interface SupplierFields {
  name: string;
  contact_name: string;
  phone: string;
  email: string;
}

function SupplierRow({
  supplier,
  canManage,
  onDeleteRequest,
}: {
  supplier: SupplierForManagement;
  canManage: boolean;
  onDeleteRequest: (supplier: SupplierForManagement) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<SupplierFields>({
    name: supplier.name,
    contact_name: supplier.contact_name ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
  });
  const [error, setError] = useState<string | undefined>();

  function handleSave() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", fields.name);
      formData.set("contact_name", fields.contact_name);
      formData.set("phone", fields.phone);
      formData.set("email", fields.email);
      const result = await updateSupplier(supplier.id, formData);
      if (result.error) {
        setError(result.fieldErrors?.name ?? result.fieldErrors?.email ?? result.error);
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
    setFields({
      name: supplier.name,
      contact_name: supplier.contact_name ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
    });
    setError(undefined);
  }

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleSupplierActive(supplier.id, !supplier.is_active);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(supplier.is_active ? `${supplier.name} disabled` : `${supplier.name} enabled`);
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
              value={fields.name}
              onChange={(event) => setFields((prev) => ({ ...prev, name: event.target.value }))}
              disabled={pending}
              aria-invalid={!!error}
              aria-label="Supplier name"
              className="h-8 w-40"
              autoFocus
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <span className="font-medium">{supplier.name}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {editing ? (
          <Input
            value={fields.contact_name}
            onChange={(event) => setFields((prev) => ({ ...prev, contact_name: event.target.value }))}
            disabled={pending}
            aria-label="Contact name"
            className="h-8 w-32"
          />
        ) : (
          supplier.contact_name || "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {editing ? (
          <Input
            value={fields.phone}
            onChange={(event) => setFields((prev) => ({ ...prev, phone: event.target.value }))}
            disabled={pending}
            aria-label="Phone"
            className="h-8 w-28"
          />
        ) : (
          supplier.phone || "—"
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {editing ? (
          <Input
            value={fields.email}
            onChange={(event) => setFields((prev) => ({ ...prev, email: event.target.value }))}
            disabled={pending}
            aria-label="Email"
            className="h-8 w-40"
          />
        ) : (
          supplier.email || "—"
        )}
      </TableCell>
      <TableCell>
        <Badge variant={supplier.is_active ? "secondary" : "outline"}>{supplier.is_active ? "Active" : "Disabled"}</Badge>
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
                  aria-label={`Edit ${supplier.name}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={handleToggle}
                  aria-label={supplier.is_active ? `Disable ${supplier.name}` : `Enable ${supplier.name}`}
                >
                  {supplier.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => onDeleteRequest(supplier)}
                  aria-label={`Delete ${supplier.name}`}
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

export function SuppliersManager({ suppliers, canManage }: { suppliers: SupplierForManagement[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newFields, setNewFields] = useState<SupplierFields>({ name: "", contact_name: "", phone: "", email: "" });
  const [createError, setCreateError] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<SupplierForManagement | null>(null);

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createSupplier(formData);
      if (result.error) {
        setCreateError(result.fieldErrors?.name ?? result.fieldErrors?.email ?? result.error);
        toast.error(result.error);
      } else {
        setNewFields({ name: "", contact_name: "", phone: "", email: "" });
        setCreateError(undefined);
        toast.success("Supplier added");
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteSupplier(deleteTarget.id);
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
            <Label htmlFor="new_supplier_name" className="text-xs">
              Name
            </Label>
            <Input
              id="new_supplier_name"
              name="name"
              value={newFields.name}
              onChange={(event) => setNewFields((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="e.g. Dental Supply Co."
              aria-invalid={!!createError}
              disabled={pending}
              className="h-8 w-44"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new_supplier_contact" className="text-xs">
              Contact
            </Label>
            <Input
              id="new_supplier_contact"
              name="contact_name"
              value={newFields.contact_name}
              onChange={(event) => setNewFields((prev) => ({ ...prev, contact_name: event.target.value }))}
              disabled={pending}
              className="h-8 w-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new_supplier_phone" className="text-xs">
              Phone
            </Label>
            <Input
              id="new_supplier_phone"
              name="phone"
              value={newFields.phone}
              onChange={(event) => setNewFields((prev) => ({ ...prev, phone: event.target.value }))}
              disabled={pending}
              className="h-8 w-28"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new_supplier_email" className="text-xs">
              Email
            </Label>
            <Input
              id="new_supplier_email"
              name="email"
              value={newFields.email}
              onChange={(event) => setNewFields((prev) => ({ ...prev, email: event.target.value }))}
              disabled={pending}
              className="h-8 w-44"
            />
          </div>
          {createError && <p className="text-xs text-destructive">{createError}</p>}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Add supplier
          </Button>
        </form>
      )}

      {suppliers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No suppliers yet. Add one above.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <SupplierRow key={supplier.id} supplier={supplier} canManage={canManage} onDeleteRequest={setDeleteTarget} />
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the supplier. It can only be deleted if no products or purchase orders
              reference it — otherwise, disable it instead. This can&apos;t be undone from this UI.
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
