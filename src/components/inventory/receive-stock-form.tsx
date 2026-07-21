"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { receivePurchaseOrder } from "@/lib/inventory/actions";
import type { PurchaseOrderItemDetail } from "@/lib/inventory/queries";

/** Records how much of each line was actually received — one 'receive' movement per item with a positive delta, per the approved lifecycle (Purchase -> Receive is the only insertion point for new stock). */
export function ReceiveStockForm({ purchaseOrderId, items }: { purchaseOrderId: string; items: PurchaseOrderItemDetail[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, String(Number(item.quantity_ordered) - Number(item.quantity_received))]),
    ),
  );

  function handleSubmit() {
    const payload = items.map((item) => ({
      item_id: item.id,
      quantity_received: Number(item.quantity_received) + Number(quantities[item.id] || 0),
    }));

    const formData = new FormData();
    formData.set("items", JSON.stringify(payload));

    startTransition(async () => {
      const result = await receivePurchaseOrder(purchaseOrderId, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stock received");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Ordered</TableHead>
              <TableHead>Already received</TableHead>
              <TableHead>Receive now</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.product_name}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {item.quantity_ordered} {item.product_unit}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {item.quantity_received} {item.product_unit}
                </TableCell>
                <TableCell>
                  <Label className="sr-only">Quantity to receive for {item.product_name}</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-8 w-28"
                    value={quantities[item.id] ?? "0"}
                    onChange={(event) => setQuantities((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    disabled={pending}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
          Record received stock
        </Button>
      </div>
    </div>
  );
}
