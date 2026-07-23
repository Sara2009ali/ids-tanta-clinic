"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Stethoscope } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createConsumption } from "@/lib/inventory/actions";
import type { InventoryProduct } from "@/types/domain";

/** Manual consumption logging — gated by clinical.edit, not inventory.manage (the approved architecture's one permission-reuse decision: this is a clinical action performed by the doctor). No automatic treatment integration; quantity is always entered as a positive "amount used," negated internally. */
export function ConsumptionFormSheet({ products, defaultProductId }: { products: InventoryProduct[]; defaultProductId?: string }) {
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
      const result = await createConsumption(formData);
      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success("Consumption recorded");
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
        <Stethoscope className="size-4" />
        Log Consumption
      </SheetTrigger>
      <SheetContent className="sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>Log Consumption</SheetTitle>
          <SheetDescription>Record supplies used during patient care.</SheetDescription>
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
            <Label htmlFor="consumption_quantity">Quantity used *</Label>
            <Input
              id="consumption_quantity"
              name="quantity"
              type="number"
              min={0.01}
              step={0.01}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              aria-invalid={!!fieldErrors.quantity}
            />
            {fieldErrors.quantity && (
              <p className="text-sm text-destructive" role="alert">
                {fieldErrors.quantity}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumption_notes">Notes</Label>
            <Textarea
              id="consumption_notes"
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Record consumption
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
