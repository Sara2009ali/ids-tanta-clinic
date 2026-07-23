import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseOrderStatusBadge } from "@/components/inventory/purchase-order-status-badge";
import { PurchaseOrderDetailActions } from "@/components/inventory/purchase-order-detail-actions";
import { ReceiveStockForm } from "@/components/inventory/receive-stock-form";
import { formatCurrency } from "@/lib/billing/format";
import { getPurchaseOrderDetail } from "@/lib/inventory/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { PurchaseOrderStatus } from "@/types/domain";
import { typography } from "@/lib/typography";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

const RECEIVE_INELIGIBLE = new Set<PurchaseOrderStatus>(["received", "cancelled"]);

export default async function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const permissions = await getCurrentPermissions();
  const canManage = hasPermission(permissions, PERMISSIONS.INVENTORY_MANAGE);

  const { id } = await params;
  const order = await getPurchaseOrderDetail(id);

  if (!order) {
    notFound();
  }

  const status = order.status as PurchaseOrderStatus;
  const totalCost = order.items.reduce((sum, item) => sum + Number(item.quantity_ordered) * Number(item.unit_cost), 0);

  const orderLabel = order.reference_number || `PO-${order.id.slice(0, 8)}`;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Inventory", href: "/inventory" },
          { label: "Purchase Orders", href: "/inventory/purchase-orders" },
          { label: orderLabel },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={typography.pageTitle}>{orderLabel}</h1>
            <PurchaseOrderStatusBadge status={status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {order.supplier_name} · Ordered {formatDate(order.order_date)}
            {order.received_date ? ` · Received ${formatDate(order.received_date)}` : ""}
          </p>
        </div>
        {canManage && <PurchaseOrderDetailActions purchaseOrderId={order.id} status={status} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Line items</p>
          <p className="text-lg font-semibold tabular-nums">{order.items.length}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Estimated total</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(totalCost)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="truncate text-sm">{order.notes || "—"}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Items</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead>Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity_ordered} {item.product_unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {item.quantity_received} {item.product_unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.unit_cost))}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.expiration_date ? formatDate(item.expiration_date) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {canManage && !RECEIVE_INELIGIBLE.has(status) && (
        <div>
          <h2 className="mb-2 text-sm font-medium">Receive stock</h2>
          <ReceiveStockForm purchaseOrderId={order.id} items={order.items} />
        </div>
      )}
    </div>
  );
}
