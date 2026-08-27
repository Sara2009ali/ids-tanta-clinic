import { BackLink } from "@/components/layout/back-link";
import { PurchaseOrderFormSheet } from "@/components/inventory/purchase-order-form-sheet";
import { PurchaseOrdersTable } from "@/components/inventory/purchase-orders-table";
import { listProducts, listPurchaseOrders, listSuppliers } from "@/lib/inventory/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

export default async function PurchaseOrdersPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);

  const [orders, suppliers, products] = await Promise.all([listPurchaseOrders(), listSuppliers(), listProducts()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackLink href="/inventory" ariaLabel="Back to inventory" />
          <div>
            <h1 className={typography.pageTitle}>Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">Orders placed with suppliers, and what&apos;s been received.</p>
          </div>
        </div>
        {canManage && <PurchaseOrderFormSheet suppliers={suppliers} products={products} />}
      </div>

      <PurchaseOrdersTable orders={orders} />
    </div>
  );
}
