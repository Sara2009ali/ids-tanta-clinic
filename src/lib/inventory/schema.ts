import { z } from "zod";

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

// Categories/Suppliers mirror chair-schema.ts exactly — simple catalog forms.
export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a category name").max(50, "Keep it under 50 characters"),
});
export type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function categoryFormValuesFromFormData(formData: FormData) {
  return { name: str(formData, "name") ?? "" };
}

export const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a supplier name").max(100, "Keep it under 100 characters"),
  contact_name: z.string().trim().max(100, "Keep it under 100 characters").optional(),
  phone: z.string().trim().max(30, "Keep it under 30 characters").optional(),
  email: z.string().trim().max(150).email("Enter a valid email").optional().or(z.literal("")),
});
export type SupplierFormValues = z.infer<typeof supplierFormSchema>;

export function supplierFormValuesFromFormData(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    contact_name: str(formData, "contact_name") || undefined,
    phone: str(formData, "phone") || undefined,
    email: str(formData, "email") || "",
  };
}

// Products — one Sheet-based form (richer than Categories/Suppliers'
// inline-table-edit, since it has category/supplier/unit selects that
// wouldn't fit a compact table row), mirroring SetCompensationRuleSheet's
// shape rather than ChairsManager's.
export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a product name").max(100, "Keep it under 100 characters"),
  category_id: z.string().trim().optional(),
  default_supplier_id: z.string().trim().optional(),
  unit: z.enum(["piece", "box", "pack", "ml", "l", "g", "kg"]),
  sku: z.string().trim().max(50, "Keep it under 50 characters").optional(),
  reorder_threshold: z.coerce.number().min(0, "Can't be negative"),
});
export type ProductFormValues = z.infer<typeof productFormSchema>;

export function productFormValuesFromFormData(formData: FormData) {
  return {
    name: str(formData, "name") ?? "",
    category_id: str(formData, "category_id") || undefined,
    default_supplier_id: str(formData, "default_supplier_id") || undefined,
    unit: (str(formData, "unit") || "piece") as ProductFormValues["unit"],
    sku: str(formData, "sku") || undefined,
    reorder_threshold: str(formData, "reorder_threshold") ?? "0",
  };
}

// Purchase Orders — header + items in one submission, mirroring
// invoiceFormSchema/InvoiceFormSheet exactly (items collected client-side,
// serialized as JSON into one hidden field).
export const purchaseOrderItemInputSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  quantity_ordered: z.coerce.number().positive("Enter a quantity greater than zero"),
  unit_cost: z.coerce.number().min(0, "Can't be negative"),
  expiration_date: z.string().trim().optional(),
});
export type PurchaseOrderItemInputValues = z.infer<typeof purchaseOrderItemInputSchema>;

export const purchaseOrderFormSchema = z.object({
  supplier_id: z.string().uuid("Select a supplier"),
  reference_number: z.string().trim().max(50, "Keep it under 50 characters").optional(),
  order_date: z.string().trim().min(1, "Pick an order date"),
  notes: z.string().trim().max(1000, "Keep it under 1000 characters").optional(),
  items: z.array(purchaseOrderItemInputSchema).min(1, "Add at least one item"),
});
export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderFormSchema>;

export function purchaseOrderFormValuesFromFormData(formData: FormData) {
  const itemsRaw = str(formData, "items") ?? "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  return {
    supplier_id: str(formData, "supplier_id") ?? "",
    reference_number: str(formData, "reference_number") || undefined,
    order_date: str(formData, "order_date") ?? "",
    notes: str(formData, "notes") || undefined,
    items,
  };
}

// Receiving stock against an existing, already-created purchase order.
export const receiveItemInputSchema = z.object({
  item_id: z.string().uuid(),
  quantity_received: z.coerce.number().min(0, "Can't be negative"),
});
export type ReceiveItemInputValues = z.infer<typeof receiveItemInputSchema>;

export const receiveStockFormSchema = z.object({
  items: z.array(receiveItemInputSchema).min(1),
});
export type ReceiveStockFormValues = z.infer<typeof receiveStockFormSchema>;

export function receiveStockFormValuesFromFormData(formData: FormData) {
  const itemsRaw = str(formData, "items") ?? "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }
  return { items };
}

// Manual adjustment — quantity is signed (negative removes stock, positive
// adds it), a single numeric field rather than a separate direction toggle.
export const adjustmentFormSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  quantity: z.coerce.number().refine((value) => value !== 0, "Enter a non-zero quantity"),
  notes: z.string().trim().min(1, "Explain the adjustment").max(500, "Keep it under 500 characters"),
});
export type AdjustmentFormValues = z.infer<typeof adjustmentFormSchema>;

export function adjustmentFormValuesFromFormData(formData: FormData) {
  return {
    product_id: str(formData, "product_id") ?? "",
    quantity: str(formData, "quantity") ?? "0",
    notes: str(formData, "notes") ?? "",
  };
}

// Manual consumption — quantity is always entered as a positive "amount
// used"; the action negates it before writing the movement, so the form
// never asks a clinical user to think in signed numbers.
export const consumptionFormSchema = z.object({
  product_id: z.string().uuid("Select a product"),
  quantity: z.coerce.number().positive("Enter a quantity greater than zero"),
  notes: z.string().trim().max(500, "Keep it under 500 characters").optional(),
});
export type ConsumptionFormValues = z.infer<typeof consumptionFormSchema>;

export function consumptionFormValuesFromFormData(formData: FormData) {
  return {
    product_id: str(formData, "product_id") ?? "",
    quantity: str(formData, "quantity") ?? "0",
    notes: str(formData, "notes") || undefined,
  };
}
