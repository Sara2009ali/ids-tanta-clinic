import Link from "next/link";
import { AlertTriangle, Boxes, CalendarClock, Package, Warehouse } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MovementsTable } from "@/components/inventory/movements-table";
import { formatCurrency } from "@/lib/billing/format";
import {
  getExpiringSoonItems,
  getInventoryDashboardSummary,
  getInventoryMovements,
  getLowStockProducts,
} from "@/lib/inventory/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

function formatExpirationDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/** Mirrors /compensation's own dashboard shape exactly: a KPI row, two side-by-side "needs attention" cards, and a recent-activity list. */
export default async function InventoryDashboardPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);

  const [summary, lowStock, expiringSoon, recentMovements] = await Promise.all([
    getInventoryDashboardSummary(),
    getLowStockProducts(),
    getExpiringSoonItems(30),
    getInventoryMovements(10),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Products, purchasing, and stock levels.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/inventory/products" />}>
            Products
          </Button>
          <Button variant="outline" render={<Link href="/inventory/purchase-orders" />}>
            Purchase Orders
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Products" value={summary.activeProductCount} icon={Package} />
          <StatCard label="Low Stock" value={summary.lowStockCount} icon={AlertTriangle} />
          <StatCard label="Expiring Soon" value={summary.expiringSoonCount} icon={CalendarClock} />
          <StatCard label="Estimated Stock Value" value={formatCurrency(summary.estimatedStockValue)} icon={Warehouse} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length > 0 ? (
              <ul className="space-y-2">
                {lowStock.slice(0, 10).map((product) => (
                  <li key={product.id} className="flex items-center justify-between text-sm">
                    <Link href={`/inventory/products/${product.id}`} className="hover:underline">
                      {product.name}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      {product.stock_level} / {product.reorder_threshold} {product.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing is running low right now.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiring within 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {expiringSoon.length > 0 ? (
              <ul className="space-y-2">
                {expiringSoon.slice(0, 10).map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <Link href={`/inventory/products/${item.product_id}`} className="hover:underline">
                      {item.product_name}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      {item.quantity_remaining} · {formatExpirationDate(item.expiration_date)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing is expiring soon.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent movements</h2>
          <Button variant="ghost" size="sm" render={<Link href="/inventory/movements" />}>
            <Boxes className="size-4" />
            View all
          </Button>
        </div>
        <MovementsTable movements={recentMovements} emptyMessage="No stock movements recorded yet." />
      </div>
    </div>
  );
}
