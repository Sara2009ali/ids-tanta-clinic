import Link from "next/link";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ProductRowActions } from "@/components/inventory/product-row-actions";
import { INVENTORY_UNIT_LABELS, type InventoryCategory, type InventorySupplier, type InventoryUnit } from "@/types/domain";
import type { ProductForManagement } from "@/lib/inventory/queries";

/**
 * Plain server component — read-only rows render without hydrating; only
 * ProductRowActions (a small per-row island) ships as client JS, matching
 * the same split PatientRowActions already established for patients-table.tsx.
 */
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
  if (products.length === 0) {
    return (
      <EmptyState
        icon={hasFilters ? Package : undefined}
        illustration={hasFilters ? undefined : "boxes"}
        title={hasFilters ? "No products match these filters" : "No products yet"}
        description={
          hasFilters
            ? "Try a different category or clear your search to see more results."
            : "Add your first product above to start tracking stock levels, purchase orders, and low-stock alerts."
        }
      />
    );
  }

  return (
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
                    <ProductRowActions product={product} categories={categories} suppliers={suppliers} />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
