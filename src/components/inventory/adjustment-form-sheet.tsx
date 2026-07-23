"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Scale } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAdjustment } from "@/lib/inventory/actions";
import type { InventoryProduct } from "@/types/domain";

/** Manual stock correction — quantity is a single signed field (negative removes stock, positive adds it), gated by inventory.manage. No automatic treatment integration, per the approved architecture. */
export function AdjustmentFormSheet({ products, defaultProductId }: { products: InventoryProduct[]; defaultProductId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setFieldErrors({});
    if (!defaultProductId) setProductId("");
    setQuantity("");
    setNotes("");
  }

  function handleSubmit(formData: FormData) {
    formData.set("product_id", productId);

    startTransition(async () => {
      const result = await createAdjustment(formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Adjustment recorded");
        setOpen(false);
        resetForm();
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
      <SheetTrigger render={<Button variant="outline" />}>
        <Scale className="size-4" />
        Adjust Stock
      </SheetTrigger>
      <SheetContent className="sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>Adjust Stock</SheetTitle>
          <SheetDescription>Correct a stock count — a damaged, lost, or found item.</SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          {!defaultProductId && (
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                items={Object.fromEntries(products.map((p) => [p.id, p.name]))}
                value={productId}
                onValueChange={(v) => v && setProductId(v)}
              >
                <SelectTrigger className="w-full" aria-invalid={!!fieldErrors.product_id}>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.product_id && (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.product_id}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="adjustment_quantity">Quantity *</Label>
            <Input
              id="adjustment_quantity"
              name="quantity"
              type="number"
              step={0.01}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={!!fieldErrors.quantity}
            />
            <p className="text-xs text-muted-foreground">
              Use a positive number to add stock (found), or negative to remove it (damaged, lost).
            </p>
            {fieldErrors.quantity && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.quantity}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustment_notes">Reason *</Label>
            <Textarea
              id="adjustment_notes"
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              aria-invalid={!!fieldErrors.notes}
            />
            {fieldErrors.notes && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.notes}
              </p>
            )}
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Record adjustment
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
