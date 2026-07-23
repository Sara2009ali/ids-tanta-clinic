import { notFound } from "next/navigation";
import { Boxes, CalendarClock, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementsTable } from "@/components/inventory/movements-table";
import { AdjustmentFormSheet } from "@/components/inventory/adjustment-form-sheet";
import { ConsumptionFormSheet } from "@/components/inventory/consumption-form-sheet";
import { formatCurrency } from "@/lib/billing/format";
import { getProductDetail, listProducts } from "@/lib/inventory/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { INVENTORY_UNIT_LABELS, type InventoryUnit } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);
  const canLogConsumption = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);

  const { id } = await params;
  const [detail, products] = await Promise.all([getProductDetail(id), listProducts()]);

  if (!detail) {
    notFound();
  }

  const { product, movements, purchaseOrderItems } = detail;
  const isLow = product.stock_level <= product.reorder_threshold;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Inventory", href: "/inventory" },
          { label: "Products", href: "/inventory/products" },
          { label: product.name },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={typography.pageTitle}>{product.name}</h1>
            <Badge variant={product.is_active ? "secondary" : "outline"}>
              {product.is_active ? "Active" : "Disabled"}
            </Badge>
            {isLow && <Badge variant="destructive">Low stock</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {product.category_name ?? "Uncategorized"}
            {product.sku ? ` · SKU ${product.sku}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canLogConsumption && <ConsumptionFormSheet products={products} defaultProductId={product.id} />}
          {canManage && <AdjustmentFormSheet products={products} defaultProductId={product.id} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current Stock"
          value={`${product.stock_level} ${INVENTORY_UNIT_LABELS[product.unit as InventoryUnit]}`}
          icon={Package}
        />
        <StatCard
          label="Reorder Threshold"
          value={`${product.reorder_threshold} ${INVENTORY_UNIT_LABELS[product.unit as InventoryUnit]}`}
          icon={Boxes}
        />
        <StatCard label="Default Supplier" value={product.supplier_name ?? "—"} icon={CalendarClock} />
      </div>

      <Tabs defaultValue="movements">
        <TabsList>
          <TabsTrigger value="movements">Movement History</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="pt-6">
          <MovementsTable
            movements={movements.map((movement) => ({ ...movement, product_name: product.name }))}
            showProductLink={false}
          />
        </TabsContent>

        <TabsContent value="purchases" className="pt-6">
          {purchaseOrderItems.length === 0 ? (
            <EmptyState title={"No purchase history for this product yet."} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Received</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit cost</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrderItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                      <TableCell>{item.supplier_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{item.purchase_order_reference ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity_ordered}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.quantity_received}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.unit_cost))}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.expiration_date ? formatDate(item.expiration_date) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
