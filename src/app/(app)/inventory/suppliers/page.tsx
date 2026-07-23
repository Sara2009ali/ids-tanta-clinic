import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SuppliersManager } from "@/components/inventory/suppliers-manager";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { listSuppliersForManagement } from "@/lib/inventory/queries";
import { typography } from "@/lib/typography";

export default async function InventorySuppliersPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);

  const suppliers = await listSuppliersForManagement();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" render={<Link href="/inventory" aria-label="Back to inventory" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className={typography.pageTitle}>Suppliers</h1>
          <p className="text-sm text-muted-foreground">Who the clinic orders products from.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All suppliers</CardTitle>
        </CardHeader>
        <CardContent>
          <SuppliersManager suppliers={suppliers} canManage={canManage} />
        </CardContent>
      </Card>
    </div>
  );
}
