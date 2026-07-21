"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ProductFormSheet } from "@/components/inventory/product-form-sheet";
import { deleteProduct, toggleProductActive } from "@/lib/inventory/actions";
import { INVENTORY_UNIT_LABELS, type InventoryCategory, type InventorySupplier, type InventoryUnit } from "@/types/domain";
import type { ProductForManagement } from "@/lib/inventory/queries";

export function ProductsTable({
  products,
  categories,
  suppliers,
  hasFilters,
  canManage,
}: {
  products: ProductForManagement[];
  categories: InventoryCategory[];
  suppliers: InventorySupplier[];
  hasFilters: boolean;
  /** inventory.view alone reaches this table read-only — same "hide the Actions column" pattern CompensationRulesTable's own canManage prop already established. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editingProduct, setEditingProduct] = useState<ProductForManagement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductForManagement | null>(null);

  function handleToggle(product: ProductForManagement) {
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
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteProduct(deleteTarget.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${deleteTarget.name} deleted`);
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        {hasFilters ? "No products match these filters." : "No products yet. Add one above."}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const isLow = product.stock_level <= product.reorder_threshold;
              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <Link href={`/inventory/products/${product.id}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.category_name ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">
                    <span className={isLow ? "font-medium text-destructive" : undefined}>
                      {product.stock_level} {INVENTORY_UNIT_LABELS[product.unit as InventoryUnit]}
                    </span>
                    {isLow && (
                      <Badge variant="destructive" className="ml-2">
                        Low
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{product.supplier_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "secondary" : "outline"}>
                      {product.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setEditingProduct(product)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => handleToggle(product)}
                          aria-label={product.is_active ? `Disable ${product.name}` : `Enable ${product.name}`}
                        >
                          {product.is_active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() => setDeleteTarget(product)}
                          aria-label={`Delete ${product.name}`}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editingProduct && (
        <ProductFormSheet
          categories={categories}
          suppliers={suppliers}
          existingProduct={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
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
