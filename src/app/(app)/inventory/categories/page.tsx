import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoriesManager } from "@/components/inventory/categories-manager";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { listCategoriesForManagement } from "@/lib/inventory/queries";

export default async function InventoryCategoriesPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);

  const categories = await listCategoriesForManagement();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" render={<Link href="/inventory" aria-label="Back to inventory" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
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
