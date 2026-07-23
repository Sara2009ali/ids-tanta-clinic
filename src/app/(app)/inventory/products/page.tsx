import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductFormSheet } from "@/components/inventory/product-form-sheet";
import { ProductsFilters } from "@/components/inventory/products-filters";
import { ProductsTable } from "@/components/inventory/products-table";
import type { ProductsQueryParams } from "@/components/inventory/products-query-params";
import { listCategories, listProductsForManagement, listSuppliers, type ProductForManagement } from "@/lib/inventory/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Filtering happens in memory over the clinic's full product list — no new query, same "fetch broad, filter in JS" convention as /appointments/visit-types. */
function filterProducts(products: ProductForManagement[], params: ProductsQueryParams): ProductForManagement[] {
  const query = params.query?.trim().toLowerCase();

  return products.filter((product) => {
    if (params.status === "active" && !product.is_active) return false;
    if (params.status === "inactive" && product.is_active) return false;
    if (params.categoryId && product.category_id !== params.categoryId) return false;
    if (params.lowStock && product.stock_level > product.reorder_threshold) return false;
    if (query && !product.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);

  const sp = await searchParams;
  const filterValue: ProductsQueryParams = {
    query: firstParam(sp.query) || undefined,
    categoryId: firstParam(sp.categoryId) || undefined,
    status: (firstParam(sp.status) as ProductsQueryParams["status"]) || undefined,
    lowStock: firstParam(sp.lowStock) === "1" ? "1" : undefined,
  };
  const hasFilters = Boolean(filterValue.query || filterValue.categoryId || filterValue.status || filterValue.lowStock);

  const [products, categories, suppliers] = await Promise.all([
    listProductsForManagement(),
    listCategories(),
    listSuppliers(),
  ]);
  const filteredProducts = filterProducts(products, filterValue);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" render={<Link href="/inventory" aria-label="Back to inventory" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className={typography.pageTitle}>Products</h1>
            <p className="text-sm text-muted-foreground">The clinic&apos;s inventory catalog.</p>
          </div>
        </div>
        {canManage && <ProductFormSheet categories={categories} suppliers={suppliers} />}
      </div>

      <ProductsFilters value={filterValue} categories={categories} />
      <ProductsTable
        products={filteredProducts}
        categories={categories}
        suppliers={suppliers}
        hasFilters={hasFilters}
        canManage={canManage}
      />
    </div>
  );
}
