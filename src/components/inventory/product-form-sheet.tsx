"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { createProduct, updateProduct } from "@/lib/inventory/actions";
import { INVENTORY_UNIT_LABELS, type InventoryCategory, type InventorySupplier, type InventoryUnit } from "@/types/domain";
import type { ProductForManagement } from "@/lib/inventory/queries";

const NO_CATEGORY = "none";
const NO_SUPPLIER = "none";

/** Mirrors SetCompensationRuleSheet's shape — richer fields than Categories/Suppliers warrant a Sheet rather than an inline-table-edit row. */
export function ProductFormSheet({
  categories,
  suppliers,
  existingProduct,
  className,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  categories: InventoryCategory[];
  suppliers: InventorySupplier[];
  existingProduct?: ProductForManagement;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEditing = !!existingProduct;
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState(existingProduct?.name ?? "");
  const [categoryId, setCategoryId] = useState(existingProduct?.category_id ?? "");
  const [supplierId, setSupplierId] = useState(existingProduct?.default_supplier_id ?? "");
  const [unit, setUnit] = useState<InventoryUnit>((existingProduct?.unit as InventoryUnit) ?? "piece");
  const [sku, setSku] = useState(existingProduct?.sku ?? "");
  const [reorderThreshold, setReorderThreshold] = useState(String(existingProduct?.reorder_threshold ?? 0));

  function resetForm() {
    setFieldErrors({});
    if (!isEditing) {
      setName("");
      setCategoryId("");
      setSupplierId("");
      setUnit("piece");
      setSku("");
      setReorderThreshold("0");
    }
  }

  function handleSubmit(formData: FormData) {
    formData.set("category_id", categoryId);
    formData.set("default_supplier_id", supplierId);
    formData.set("unit", unit);

    startTransition(async () => {
      const result = isEditing
        ? await updateProduct(existingProduct.id, formData)
        : await createProduct(formData);

      if (result.error) {
        toast.error(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      } else {
        toast.success(isEditing ? "Product updated" : "Product added");
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
      {!isControlled && (
        <SheetTrigger render={<Button className={className} />}>
          <Plus className="size-4" />
          Add Product
        </SheetTrigger>
      )}
      <SheetContent className="sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Product" : "Add Product"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update this product's catalog details." : "Add a new product to the inventory catalog."}
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-5">
          <FormField label="Name" htmlFor="product_name" required error={fieldErrors.name}>
            <Input
              id="product_name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!!fieldErrors.name}
            />
          </FormField>

          <FormField label="Category" htmlFor="product_category">
            <Select
              items={{ [NO_CATEGORY]: "No category", ...Object.fromEntries(categories.map((c) => [c.id, c.name])) }}
              value={categoryId || NO_CATEGORY}
              onValueChange={(v) => setCategoryId(!v || v === NO_CATEGORY ? "" : v)}
            >
              <SelectTrigger id="product_category" className="w-full">
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Default supplier" htmlFor="product_supplier">
            <Select
              items={{ [NO_SUPPLIER]: "No default supplier", ...Object.fromEntries(suppliers.map((s) => [s.id, s.name])) }}
              value={supplierId || NO_SUPPLIER}
              onValueChange={(v) => setSupplierId(!v || v === NO_SUPPLIER ? "" : v)}
            >
              <SelectTrigger id="product_supplier" className="w-full">
                <SelectValue placeholder="No default supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPPLIER}>No default supplier</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unit" htmlFor="product_unit" required>
              <Select items={INVENTORY_UNIT_LABELS} value={unit} onValueChange={(v) => v && setUnit(v as InventoryUnit)}>
                <SelectTrigger id="product_unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(INVENTORY_UNIT_LABELS) as InventoryUnit[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {INVENTORY_UNIT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="SKU" htmlFor="product_sku">
              <Input id="product_sku" name="sku" value={sku} onChange={(event) => setSku(event.target.value)} />
            </FormField>
          </div>

          <FormField
            label="Reorder threshold"
            htmlFor="product_reorder_threshold"
            required
            description="A low-stock alert appears once stock falls to or below this quantity."
            error={fieldErrors.reorder_threshold}
          >
            <Input
              id="product_reorder_threshold"
              name="reorder_threshold"
              type="number"
              min={0}
              step={0.01}
              value={reorderThreshold}
              onChange={(event) => setReorderThreshold(event.target.value)}
              aria-invalid={!!fieldErrors.reorder_threshold}
            />
          </FormField>

          <div className="mt-auto flex justify-end gap-2 pt-2 pb-4">
            <SheetClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancel</SheetClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEditing ? "Save changes" : "Add product"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
