import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink } from "@/components/layout/back-link";
import { CategoriesManager } from "@/components/inventory/categories-manager";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { listCategoriesForManagement } from "@/lib/inventory/queries";
import { typography } from "@/lib/typography";

export default async function InventoryCategoriesPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);

  const categories = await listCategoriesForManagement();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackLink href="/inventory" ariaLabel="Back to inventory" />
        <div>
          <h1 className={typography.pageTitle}>Categories</h1>
          <p className="text-sm text-muted-foreground">Group products for easier filtering and reporting.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All categories</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoriesManager categories={categories} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
