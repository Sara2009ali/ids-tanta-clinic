"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
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
import { ProductFormSheet } from "@/components/inventory/product-form-sheet";
import { deleteProduct, toggleProductActive } from "@/lib/inventory/actions";
import type { InventoryCategory, InventorySupplier } from "@/types/domain";
import type { ProductForManagement } from "@/lib/inventory/queries";

/**
 * Interactive island for a single product row — extracted out of
 * ProductsTable so the table itself can be a plain server component
 * (matches the PatientRowActions/patients-table.tsx split): only the
 * handful of rows' worth of action buttons need to hydrate, not the whole
 * table's read-only cells.
 */
export function ProductRowActions({
  product,
  categories,
  suppliers,
}: {
  product: ProductForManagement;
  categories: InventoryCategory[];
  suppliers: InventorySupplier[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleProductActive(product.id, !product.is_active);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(product.is_active ? `${product.name} disabled` : `${product.name} enabled`);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteProduct(product.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${product.name} deleted`);
        setDeleteOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={handleToggle}
          aria-label={product.is_active ? `Disable ${product.name}` : `Enable ${product.name}`}
        >
          {product.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => setDeleteOpen(true)}
          aria-label={`Delete ${product.name}`}
          className="hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {editing && (
        <ProductFormSheet
          categories={categories}
          suppliers={suppliers}
          existingProduct={product}
          open={editing}
          onOpenChange={setEditing}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {product.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product. It can only be deleted if it has no purchase or movement
              history — otherwise, disable it instead. This can&apos;t be undone from this UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={pending} onClick={handleDelete}>
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
