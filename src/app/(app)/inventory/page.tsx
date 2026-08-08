import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Boxes, CalendarClock, Package, Warehouse } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MovementsTable } from "@/components/inventory/movements-table";
import { formatCurrency } from "@/lib/billing/format";
import {
  getExpiringSoonItems,
  getInventoryMovements,
  getInventoryStockValueSummary,
  getLowStockProducts,
} from "@/lib/inventory/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";
import { interactiveRowCard } from "@/lib/interactive-styles";
import { cn } from "@/lib/utils";

function formatExpirationDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * KPIs + the two "needs attention" cards share `lowStock`/`expiringSoon`
 * (that's the whole point of the dedup fix above this component), so they
 * stay one Suspense boundary/fetch. Recent Movements queries a completely
 * separate table and gets its own boundary so it can stream independently.
 */
async function InventoryOverviewSection() {
  const [lowStock, expiringSoon, stockValueSummary] = await Promise.all([
    getLowStockProducts(),
    getExpiringSoonItems(30),
    getInventoryStockValueSummary(),
  ]);
  const summary = {
    ...stockValueSummary,
    lowStockCount: lowStock.length,
    expiringSoonCount: expiringSoon.length,
  };

  return (
    <>
      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Products" value={summary.activeProductCount} icon={Package} />
          <StatCard label="Low Stock" value={summary.lowStockCount} icon={AlertTriangle} />
          <StatCard label="Expiring Soon" value={summary.expiringSoonCount} icon={CalendarClock} />
          <StatCard label="Estimated Stock Value" value={formatCurrency(summary.estimatedStockValue)} icon={Warehouse} highlight="gold" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock.length > 0 ? (
              <div className="space-y-2">
                {lowStock.slice(0, 10).map((product) => (
                  <Link
                    key={product.id}
                    href={`/inventory/products/${product.id}`}
                    className={cn(interactiveRowCard, "justify-between text-sm")}
                  >
                    <span className="font-medium">{product.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {product.stock_level} / {product.reorder_threshold} {product.unit}
                    </span>
                  </Link>
                ))}
              </div>
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
              <div className="space-y-2">
                {expiringSoon.slice(0, 10).map((item) => (
                  <Link
                    key={item.id}
                    href={`/inventory/products/${item.product_id}`}
                    className={cn(interactiveRowCard, "justify-between text-sm")}
                  >
                    <span className="font-medium">{item.product_name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {item.quantity_remaining} · {formatExpirationDate(item.expiration_date)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing is expiring soon.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

async function RecentMovementsSection() {
  const recentMovements = await getInventoryMovements(10);
  return <MovementsTable movements={recentMovements} emptyMessage="No stock movements recorded yet." />;
}

function InventoryOverviewSkeleton() {
  return (
    <>
      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </>
  );
}

/** Mirrors /compensation's own dashboard shape exactly: a KPI row, two side-by-side "needs attention" cards, and a recent-activity list. */
export default async function InventoryDashboardPage() {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>Inventory</h1>
          <p className="text-sm text-muted-foreground">Products, purchasing, and stock levels.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href="/inventory/products" />}>
            Products
          </Button>
          <Button variant="outline" render={<Link href="/inventory/purchase-orders" />}>
            Purchase Orders
          </Button>
        </div>
      </div>

      <Suspense fallback={<InventoryOverviewSkeleton />}>
        <InventoryOverviewSection />
      </Suspense>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent movements</h2>
          <Button variant="ghost" size="sm" render={<Link href="/inventory/movements" />}>
            <Boxes className="size-4" />
            View all
          </Button>
        </div>
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <RecentMovementsSection />
        </Suspense>
      </div>
    </div>
  );
}
