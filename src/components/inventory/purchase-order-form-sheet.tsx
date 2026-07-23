"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPurchaseOrder } from "@/lib/inventory/actions";
import type { PurchaseOrderItemInputValues } from "@/lib/inventory/schema";
import type { InventoryProduct, InventorySupplier } from "@/types/domain";

function emptyItem(): PurchaseOrderItemInputValues {
  return { product_id: "", quantity_ordered: 1, unit_cost: 0, expiration_date: "" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Header + dynamic line items in one submission — mirrors InvoiceFormSheet exactly: items are React state, serialized to JSON in one hidden field on submit, same as createInvoice()'s own items array. */
export function PurchaseOrderFormSheet({
  suppliers,
  products,
}: {
  suppliers: InventorySupplier[];
  products: InventoryProduct[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [supplierId, setSupplierId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [orderDate, setOrderDate] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseOrderItemInputValues[]>([emptyItem()]);

  function resetForm() {
    setFieldErrors({});
    setSupplierId("");
    setReferenceNumber("");
    setOrderDate(todayIso());
    setNotes("");
    setItems([emptyItem()]);
  }

  function updateItem(index: number, patch: Partial<PurchaseOrderItemInputValues>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function handleSubmit(formData: FormData) {
    formData.set("supplier_id", supplierId);
    formData.set("order_date", orderDate);
    formData.set("items", JSON.stringify(items));

    startTransition(async () => {
      const result = await createPurchaseOrder(formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Purchase order created");
        setOpen(false);
        resetForm();
        if (result.purchaseOrderId) router.push(`/inventory/purchase-orders/${result.purchaseOrderId}`);
        router.refresh();
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <SheetTrigger render={<Button />}>
        <Plus className="size-4" />
        New Purchase Order
      </SheetTrigger>
      <SheetContent className="sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle>New Purchase Order</SheetTitle>
          <SheetDescription>Order stock from a supplier — receive it later once it arrives.</SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          <div className="space-y-2">
            <Label>Supplier *</Label>
            <Select
              items={Object.fromEntries(suppliers.map((s) => [s.id, s.name]))}
              value={supplierId}
              onValueChange={(v) => v && setSupplierId(v)}
            >
              <SelectTrigger className="w-full" aria-invalid={!!fieldErrors.supplier_id}>
                <SelectValue placeholder="Select a supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.supplier_id && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.supplier_id}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="po_order_date">Order date *</Label>
              <Input
                id="po_order_date"
                type="date"
                value={orderDate}
                onChange={(event) => setOrderDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="po_reference_number">Reference #</Label>
              <Input
                id="po_reference_number"
                name="reference_number"
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <Plus className="size-3.5" />
                Add item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-border p-2">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">Product</Label>
                    <Select
                      items={Object.fromEntries(products.map((p) => [p.id, p.name]))}
                      value={item.product_id}
                      onValueChange={(v) => v && updateItem(index, { product_id: v })}
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      className="h-8"
                      value={item.quantity_ordered}
                      onChange={(event) => updateItem(index, { quantity_ordered: Number(event.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit cost</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      className="h-8"
                      value={item.unit_cost}
                      onChange={(event) => updateItem(index, { unit_cost: Number(event.target.value) })}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Expires</Label>
                    <Input
                      type="date"
                      className="h-8"
                      value={item.expiration_date}
                      onChange={(event) => updateItem(index, { expiration_date: event.target.value })}
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={items.length === 1}
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Remove item"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {fieldErrors.items && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.items}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="po_notes">Notes</Label>
            <Textarea id="po_notes" name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create order
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
