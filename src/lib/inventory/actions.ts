"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { writeAuditLog } from "@/lib/audit/log";
import {
  adjustmentFormSchema,
  adjustmentFormValuesFromFormData,
  categoryFormSchema,
  categoryFormValuesFromFormData,
  consumptionFormSchema,
  consumptionFormValuesFromFormData,
  productFormSchema,
  productFormValuesFromFormData,
  purchaseOrderFormSchema,
  purchaseOrderFormValuesFromFormData,
  receiveStockFormSchema,
  receiveStockFormValuesFromFormData,
  supplierFormSchema,
  supplierFormValuesFromFormData,
} from "@/lib/inventory/schema";

export interface InventoryActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

export interface PurchaseOrderActionState extends InventoryActionState {
  purchaseOrderId?: string;
}

const UNIQUE_VIOLATION = "23505";

function fieldErrorsFromZod(error: import("zod").ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function revalidateInventoryPaths(extra?: string) {
  revalidatePath("/inventory");
  revalidatePath("/inventory/products");
  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/suppliers");
  revalidatePath("/inventory/purchase-orders");
  revalidatePath("/inventory/movements");
  if (extra) revalidatePath(extra);
}

// ---------------------------------------------------------------------------
// Categories — mirrors chair-actions.ts exactly.
// ---------------------------------------------------------------------------

export async function createCategory(formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = categoryFormSchema.safeParse(categoryFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_categories")
    .insert({ name: parsed.data.name, clinic_id: staff.clinic_id })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "A category with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createCategory: insert failed", error);
    return { error: "Couldn't create the category. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_category.created",
    entityType: "inventory_category",
    entityId: data.id,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function updateCategory(categoryId: string, formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = categoryFormSchema.safeParse(categoryFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_categories").update({ name: parsed.data.name }).eq("id", categoryId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A category with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("updateCategory: update failed", error);
    return { error: "Couldn't update the category. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_category.updated",
    entityType: "inventory_category",
    entityId: categoryId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function toggleCategoryActive(categoryId: string, isActive: boolean): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_categories").update({ is_active: isActive }).eq("id", categoryId);

  if (error) {
    console.error("toggleCategoryActive: update failed", error);
    return { error: "Couldn't update the category. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "inventory_category.enabled" : "inventory_category.disabled",
    entityType: "inventory_category",
    entityId: categoryId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function deleteCategory(categoryId: string): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const { count } = await supabase
    .from("inventory_products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if ((count ?? 0) > 0) {
    return { error: "This category is used by existing products. Disable it instead of deleting." };
  }

  const { error } = await supabase.from("inventory_categories").delete().eq("id", categoryId);

  if (error) {
    console.error("deleteCategory: delete failed", error);
    return { error: "Couldn't delete the category. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_category.deleted",
    entityType: "inventory_category",
    entityId: categoryId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Suppliers — mirrors chair-actions.ts, extended with contact fields.
// ---------------------------------------------------------------------------

export async function createSupplier(formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = supplierFormSchema.safeParse(supplierFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_suppliers")
    .insert({
      name: parsed.data.name,
      contact_name: parsed.data.contact_name ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email || null,
      clinic_id: staff.clinic_id,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "A supplier with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createSupplier: insert failed", error);
    return { error: "Couldn't create the supplier. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_supplier.created",
    entityType: "inventory_supplier",
    entityId: data.id,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function updateSupplier(supplierId: string, formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = supplierFormSchema.safeParse(supplierFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_suppliers")
    .update({
      name: parsed.data.name,
      contact_name: parsed.data.contact_name ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email || null,
    })
    .eq("id", supplierId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A supplier with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("updateSupplier: update failed", error);
    return { error: "Couldn't update the supplier. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_supplier.updated",
    entityType: "inventory_supplier",
    entityId: supplierId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function toggleSupplierActive(supplierId: string, isActive: boolean): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_suppliers").update({ is_active: isActive }).eq("id", supplierId);

  if (error) {
    console.error("toggleSupplierActive: update failed", error);
    return { error: "Couldn't update the supplier. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "inventory_supplier.enabled" : "inventory_supplier.disabled",
    entityType: "inventory_supplier",
    entityId: supplierId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function deleteSupplier(supplierId: string): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const [productsRes, ordersRes] = await Promise.all([
    supabase.from("inventory_products").select("*", { count: "exact", head: true }).eq("default_supplier_id", supplierId),
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("supplier_id", supplierId),
  ]);

  if ((productsRes.count ?? 0) + (ordersRes.count ?? 0) > 0) {
    return { error: "This supplier is used by existing products or purchase orders. Disable it instead of deleting." };
  }

  const { error } = await supabase.from("inventory_suppliers").delete().eq("id", supplierId);

  if (error) {
    console.error("deleteSupplier: delete failed", error);
    return { error: "Couldn't delete the supplier. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_supplier.deleted",
    entityType: "inventory_supplier",
    entityId: supplierId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = productFormSchema.safeParse(productFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_products")
    .insert({
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      default_supplier_id: parsed.data.default_supplier_id || null,
      unit: parsed.data.unit,
      sku: parsed.data.sku ?? null,
      reorder_threshold: parsed.data.reorder_threshold,
      clinic_id: staff.clinic_id,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "A product with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("createProduct: insert failed", error);
    return { error: "Couldn't create the product. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_product.created",
    entityType: "inventory_product",
    entityId: data.id,
  });

  revalidateInventoryPaths(`/inventory/products/${data.id}`);
  return { success: true };
}

export async function updateProduct(productId: string, formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = productFormSchema.safeParse(productFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_products")
    .update({
      name: parsed.data.name,
      category_id: parsed.data.category_id || null,
      default_supplier_id: parsed.data.default_supplier_id || null,
      unit: parsed.data.unit,
      sku: parsed.data.sku ?? null,
      reorder_threshold: parsed.data.reorder_threshold,
    })
    .eq("id", productId);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: "A product with this name already exists.", fieldErrors: { name: "Already in use" } };
    }
    console.error("updateProduct: update failed", error);
    return { error: "Couldn't update the product. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_product.updated",
    entityType: "inventory_product",
    entityId: productId,
  });

  revalidateInventoryPaths(`/inventory/products/${productId}`);
  return { success: true };
}

export async function toggleProductActive(productId: string, isActive: boolean): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();
  const { error } = await supabase.from("inventory_products").update({ is_active: isActive }).eq("id", productId);

  if (error) {
    console.error("toggleProductActive: update failed", error);
    return { error: "Couldn't update the product. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: isActive ? "inventory_product.enabled" : "inventory_product.disabled",
    entityType: "inventory_product",
    entityId: productId,
  });

  revalidateInventoryPaths(`/inventory/products/${productId}`);
  return { success: true };
}

export async function deleteProduct(productId: string): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const [itemsRes, movementsRes] = await Promise.all([
    supabase.from("purchase_order_items").select("*", { count: "exact", head: true }).eq("product_id", productId),
    supabase.from("inventory_movements").select("*", { count: "exact", head: true }).eq("product_id", productId),
  ]);

  if ((itemsRes.count ?? 0) + (movementsRes.count ?? 0) > 0) {
    return { error: "This product has purchase or movement history. Disable it instead of deleting." };
  }

  const { error } = await supabase.from("inventory_products").delete().eq("id", productId);

  if (error) {
    console.error("deleteProduct: delete failed", error);
    return { error: "Couldn't delete the product. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_product.deleted",
    entityType: "inventory_product",
    entityId: productId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Purchase Orders — createPurchaseOrder mirrors createInvoice() exactly:
// header + items in one call, sequential inserts with a compensating
// delete on item-insert failure, not a DB transaction/RPC.
// ---------------------------------------------------------------------------

function purchaseOrderItemRows(
  items: { product_id: string; quantity_ordered: number; unit_cost: number; expiration_date?: string }[],
  purchaseOrderId: string,
  clinicId: string,
) {
  return items.map((item) => ({
    purchase_order_id: purchaseOrderId,
    clinic_id: clinicId,
    product_id: item.product_id,
    quantity_ordered: item.quantity_ordered,
    unit_cost: item.unit_cost,
    expiration_date: item.expiration_date || null,
  }));
}

export async function createPurchaseOrder(formData: FormData): Promise<PurchaseOrderActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = purchaseOrderFormSchema.safeParse(purchaseOrderFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("purchase_orders")
    .insert({
      clinic_id: staff.clinic_id,
      supplier_id: values.supplier_id,
      reference_number: values.reference_number ?? null,
      order_date: values.order_date,
      notes: values.notes ?? null,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !order) {
    console.error("createPurchaseOrder: insert failed", error);
    return { error: "Couldn't create the purchase order. Please try again." };
  }

  const { error: itemsError } = await supabase
    .from("purchase_order_items")
    .insert(purchaseOrderItemRows(values.items, order.id, staff.clinic_id));

  if (itemsError) {
    console.error("createPurchaseOrder: items insert failed", itemsError);
    await supabase.from("purchase_orders").delete().eq("id", order.id);
    return { error: "Couldn't save the purchase order items. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "purchase_order.created",
    entityType: "purchase_order",
    entityId: order.id,
  });

  revalidateInventoryPaths(`/inventory/purchase-orders/${order.id}`);
  return { success: true, purchaseOrderId: order.id };
}

/**
 * Marks each submitted item's received quantity and writes one 'receive'
 * inventory_movements row per item with quantity > 0 — the only insertion
 * point for new stock (per the approved lifecycle). Sequential writes, not
 * an RPC: same reasoning setCompensationRule() gives for its own
 * create-or-replace being plain sequential writes rather than a
 * SECURITY DEFINER function — a transient gap here doesn't corrupt
 * anything, it just leaves a status/quantity mismatch an admin can
 * immediately see and re-run, and this app's general bias is against
 * introducing RPCs unless real concurrent-write atomicity is at stake
 * (unlike settlement, receiving stock isn't racing against other writers
 * at this app's scale).
 */
export async function receivePurchaseOrder(
  purchaseOrderId: string,
  formData: FormData,
): Promise<PurchaseOrderActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = receiveStockFormSchema.safeParse(receiveStockFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please enter valid received quantities." };
  }

  const supabase = await createClient();

  const { data: itemRows, error: itemsError } = await supabase
    .from("purchase_order_items")
    .select("id, product_id, quantity_received")
    .eq("purchase_order_id", purchaseOrderId);

  if (itemsError || !itemRows) {
    console.error("receivePurchaseOrder: items lookup failed", itemsError);
    return { error: "Couldn't load this purchase order's items." };
  }
  const itemsById = new Map(itemRows.map((row) => [row.id, row]));

  for (const submitted of parsed.data.items) {
    const item = itemsById.get(submitted.item_id);
    if (!item) continue;

    const additionalQuantity = submitted.quantity_received - Number(item.quantity_received);
    if (additionalQuantity === 0) continue;
    // A lower submitted total than what's already recorded would update
    // quantity_received without a compensating movement, silently
    // desyncing the item's own running total from the ledger's sum —
    // receiving is only ever additive (matches inventory_movements'
    // 'receive'-must-be-positive check constraint), so reject rather than
    // accept a value the UI's own min={0} "receive now" field can't
    // actually produce but a direct call to this action still could.
    if (additionalQuantity < 0) {
      return { error: "Received quantity can't be lower than what's already recorded." };
    }

    const { error: updateError } = await supabase
      .from("purchase_order_items")
      .update({ quantity_received: submitted.quantity_received })
      .eq("id", submitted.item_id);

    if (updateError) {
      console.error("receivePurchaseOrder: item update failed", updateError);
      return { error: "Couldn't record received quantities. Please try again." };
    }

    if (additionalQuantity > 0) {
      const { error: movementError } = await supabase.from("inventory_movements").insert({
        clinic_id: staff.clinic_id,
        product_id: item.product_id,
        purchase_order_item_id: submitted.item_id,
        movement_type: "receive",
        quantity: additionalQuantity,
        created_by: staff.id,
      });

      if (movementError) {
        console.error("receivePurchaseOrder: movement insert failed", movementError);
        return { error: "Couldn't record the stock movement. Please try again." };
      }
    }
  }

  const { data: allItems } = await supabase
    .from("purchase_order_items")
    .select("quantity_ordered, quantity_received")
    .eq("purchase_order_id", purchaseOrderId);

  const fullyReceived = (allItems ?? []).every((row) => Number(row.quantity_received) >= Number(row.quantity_ordered));
  const anyReceived = (allItems ?? []).some((row) => Number(row.quantity_received) > 0);
  const nextStatus = fullyReceived ? "received" : anyReceived ? "partially_received" : "ordered";

  const { error: statusError } = await supabase
    .from("purchase_orders")
    .update({ status: nextStatus, received_date: fullyReceived ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", purchaseOrderId);

  if (statusError) {
    console.error("receivePurchaseOrder: status update failed", statusError);
    return { error: "Stock was recorded, but the order status couldn't be updated." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "purchase_order.received",
    entityType: "purchase_order",
    entityId: purchaseOrderId,
    changes: { status: nextStatus },
  });

  revalidateInventoryPaths(`/inventory/purchase-orders/${purchaseOrderId}`);
  return { success: true, purchaseOrderId };
}

export async function deletePurchaseOrder(purchaseOrderId: string): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  const { data: order } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (!order) return { error: "Purchase order not found." };
  if (order.status !== "draft") {
    return { error: "Only draft purchase orders can be deleted. Cancel it instead if it's already been ordered." };
  }

  const { error } = await supabase.from("purchase_orders").delete().eq("id", purchaseOrderId);

  if (error) {
    console.error("deletePurchaseOrder: delete failed", error);
    return { error: "Couldn't delete the purchase order. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "purchase_order.deleted",
    entityType: "purchase_order",
    entityId: purchaseOrderId,
  });

  revalidateInventoryPaths();
  return { success: true };
}

export async function cancelPurchaseOrder(purchaseOrderId: string): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const supabase = await createClient();

  // Fetch-then-validate, matching deletePurchaseOrder()'s own pattern —
  // a bare `.neq("status", "received")` filter on the update would match
  // zero rows for an already-received order and return success with
  // nothing actually changed, instead of a real error.
  const { data: order } = await supabase
    .from("purchase_orders")
    .select("status")
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (!order) return { error: "Purchase order not found." };
  if (order.status === "received" || order.status === "cancelled") {
    return { error: "This purchase order can no longer be cancelled." };
  }

  const { error } = await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", purchaseOrderId);

  if (error) {
    console.error("cancelPurchaseOrder: update failed", error);
    return { error: "Couldn't cancel the purchase order. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "purchase_order.cancelled",
    entityType: "purchase_order",
    entityId: purchaseOrderId,
  });

  revalidateInventoryPaths(`/inventory/purchase-orders/${purchaseOrderId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Movements — manual adjustment and manual consumption. Both are single-row
// inserts into the ledger; no automatic treatment integration, per the
// approved architecture.
// ---------------------------------------------------------------------------

export async function createAdjustment(formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.INVENTORY_MANAGE);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = adjustmentFormSchema.safeParse(adjustmentFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .insert({
      clinic_id: staff.clinic_id,
      product_id: parsed.data.product_id,
      movement_type: "adjustment",
      quantity: parsed.data.quantity,
      notes: parsed.data.notes,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createAdjustment: insert failed", error);
    return { error: "Couldn't record the adjustment. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_movement.adjustment",
    entityType: "inventory_movement",
    entityId: data.id,
    changes: { product_id: parsed.data.product_id, quantity: parsed.data.quantity },
  });

  revalidateInventoryPaths(`/inventory/products/${parsed.data.product_id}`);
  return { success: true };
}

/**
 * clinical.edit, not inventory.manage — logging what was used during
 * patient care is a clinical action performed by the doctor, matching the
 * approved architecture's explicit permission-reuse decision (0019's own
 * header comment and RLS's split insert policy enforce the same rule at
 * the database layer too).
 */
export async function createConsumption(formData: FormData): Promise<InventoryActionState> {
  const authz = await ensurePermission(PERMISSIONS.CLINICAL_EDIT);
  if (!authz.ok) return { error: authz.error };
  const staff = authz.staff;
  if (!staff.clinic_id) return { error: "Your account isn't assigned to a clinic yet." };

  const parsed = consumptionFormSchema.safeParse(consumptionFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .insert({
      clinic_id: staff.clinic_id,
      product_id: parsed.data.product_id,
      movement_type: "consumption",
      quantity: -parsed.data.quantity,
      notes: parsed.data.notes ?? null,
      created_by: staff.id,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("createConsumption: insert failed", error);
    return { error: "Couldn't record the consumption. Please try again." };
  }

  await writeAuditLog(supabase, {
    clinicId: staff.clinic_id,
    actorId: staff.id,
    action: "inventory_movement.consumption",
    entityType: "inventory_movement",
    entityId: data.id,
    changes: { product_id: parsed.data.product_id, quantity: parsed.data.quantity },
  });

  revalidateInventoryPaths(`/inventory/products/${parsed.data.product_id}`);
  return { success: true };
}
