import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseOrderStatusBadge } from "@/components/inventory/purchase-order-status-badge";
import type { PurchaseOrderStatus } from "@/types/domain";
import type { PurchaseOrderForList } from "@/lib/inventory/queries";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function PurchaseOrdersTable({ orders }: { orders: PurchaseOrderForList[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        No purchase orders yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Order date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell>
                <Link href={`/inventory/purchase-orders/${order.id}`} className="font-medium hover:underline">
                  {order.reference_number || `PO-${order.id.slice(0, 8)}`}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{order.supplier_name}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(order.order_date)}</TableCell>
              <TableCell>
                <PurchaseOrderStatusBadge status={order.status as PurchaseOrderStatus} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
