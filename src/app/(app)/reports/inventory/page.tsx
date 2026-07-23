import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, Package, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/billing/format";
import { getExpiringSoonItems, getInventoryDashboardSummary, getLowStockProducts } from "@/lib/inventory/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * A thin Reports lens over Inventory's own numbers — every figure here is
 * getInventoryDashboardSummary()/getLowStockProducts()/getExpiringSoonItems()
 * called directly, not reimplemented, matching the exact "no duplicated
 * reporting logic" relationship Reports already has with Billing/
 * Compensation/Appointments. Same compound-permission gate every other
 * Reports sub-route uses: reports.view alone is never sufficient.
 */
export default async function InventoryReportPage() {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.INVENTORY_VIEW]);

  const [summary, lowStock, expiringSoon] = await Promise.all([
    getInventoryDashboardSummary(),
    getLowStockProducts(),
    getExpiringSoonItems(30),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
            <ArrowLeft className="size-4" />
            Reports
          </Button>
          <h1 className={cn("mt-1", typography.pageTitle)}>Inventory</h1>
          <p className="text-sm text-muted-foreground">Stock value, low stock, and expiring items.</p>
        </div>
        <Button variant="outline" render={<Link href="/inventory" />}>
          Open Inventory
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Products" value={summary.activeProductCount} icon={Package} />
        <StatCard label="Low Stock" value={summary.lowStockCount} icon={AlertTriangle} />
        <StatCard label="Expiring Soon" value={summary.expiringSoonCount} icon={CalendarClock} />
        <StatCard label="Estimated Stock Value" value={formatCurrency(summary.estimatedStockValue)} icon={Warehouse} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Low stock</h2>
        {lowStock.length === 0 ? (
          <EmptyState title={"Nothing is running low right now."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStock.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <Link href={`/inventory/products/${product.id}`} className="hover:underline">
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.stock_level} {product.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {product.reorder_threshold} {product.unit}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Expiring within 30 days</h2>
        {expiringSoon.length === 0 ? (
          <EmptyState title={"Nothing is expiring soon."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringSoon.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/inventory/products/${item.product_id}`} className="hover:underline">
                        {item.product_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantity_remaining}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(item.expiration_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
