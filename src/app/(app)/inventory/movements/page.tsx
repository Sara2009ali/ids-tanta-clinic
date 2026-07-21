import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovementsTable } from "@/components/inventory/movements-table";
import { AdjustmentFormSheet } from "@/components/inventory/adjustment-form-sheet";
import { ConsumptionFormSheet } from "@/components/inventory/consumption-form-sheet";
import { getInventoryMovements, listProducts } from "@/lib/inventory/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

const MOVEMENTS_PAGE_LIMIT = 100;

export default async function InventoryMovementsPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);
  const canLogConsumption = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);

  const [movements, products] = await Promise.all([getInventoryMovements(MOVEMENTS_PAGE_LIMIT), listProducts()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" render={<Link href="/inventory" aria-label="Back to inventory" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Movements</h1>
            <p className="text-sm text-muted-foreground">Every stock change, clinic-wide.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canLogConsumption && <ConsumptionFormSheet products={products} />}
          {canManage && <AdjustmentFormSheet products={products} />}
        </div>
      </div>

      <MovementsTable movements={movements} />
    </div>
  );
}
