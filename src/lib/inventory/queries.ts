import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  InventoryCategory,
  InventoryMovement,
  InventoryProduct,
  InventorySupplier,
  PurchaseOrder,
  PurchaseOrderItem,
} from "@/types/domain";

/**
 * Inventory & Stock Management data layer. Every table shape here mirrors
 * an existing precedent (visit_types/chairs for the three catalogs,
 * invoices/invoice_items for purchase orders, doctor_earnings for the
 * movement ledger) — see 0019_inventory.sql's own header comment. Stock
 * level is always computed as sum(inventory_movements.quantity), never a
 * stored running total, the same "sum the ledger, don't cache a balance"
 * convention doctor_earnings already established.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** Active categories, for selects. */
export async function listCategories(): Promise<InventoryCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_categories").select("*").eq("is_active", true).order("name");
  return data ?? [];
}

export interface CategoryForManagement extends InventoryCategory {
  clinic_name: string | null;
}

/** Every category (active and disabled), for the management page — mirrors listChairsForManagement()/listVisitTypesForManagement() exactly. */
export async function listCategoriesForManagement(): Promise<CategoryForManagement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_categories").select("*, clinics ( name )").order("name");

  if (error) {
    console.error("listCategoriesForManagement failed", error);
    return [];
  }

  return ((data ?? []) as unknown as (InventoryCategory & { clinics: { name: string } | null })[]).map((row) => {
    const { clinics, ...category } = row;
    return { ...category, clinic_name: clinics?.name ?? null };
  });
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

/** Active suppliers, for selects. */
export async function listSuppliers(): Promise<InventorySupplier[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_suppliers").select("*").eq("is_active", true).order("name");
  return data ?? [];
}

export interface SupplierForManagement extends InventorySupplier {
  clinic_name: string | null;
}

export async function listSuppliersForManagement(): Promise<SupplierForManagement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("inventory_suppliers").select("*, clinics ( name )").order("name");

  if (error) {
    console.error("listSuppliersForManagement failed", error);
    return [];
  }

  return ((data ?? []) as unknown as (InventorySupplier & { clinics: { name: string } | null })[]).map((row) => {
    const { clinics, ...supplier } = row;
    return { ...supplier, clinic_name: clinics?.name ?? null };
  });
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

/** Active products, for selects (purchase order items, movements). */
export async function listProducts(): Promise<InventoryProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("inventory_products").select("*").eq("is_active", true).order("name");
  return data ?? [];
}

/**
 * Current stock level per product — sum(quantity) grouped by product_id,
 * scoped to `productIds` when given (keeps the query bounded instead of
 * summing every movement ever recorded when only a handful of products are
 * on screen). Returns a Map so every caller (management list, product
 * detail, low-stock, dashboard) shares this one aggregation instead of
 * re-deriving it.
 */
export async function getStockLevels(productIds?: string[]): Promise<Map<string, number>> {
  const supabase = await createClient();
  let query = supabase.from("inventory_movements").select("product_id, quantity");
  if (productIds && productIds.length > 0) query = query.in("product_id", productIds);

  const { data, error } = await query;
  if (error) {
    console.error("getStockLevels failed", error);
    return new Map();
  }

  const levels = new Map<string, number>();
  for (const row of data ?? []) {
    levels.set(row.product_id, (levels.get(row.product_id) ?? 0) + Number(row.quantity));
  }
  return levels;
}

export interface ProductForManagement extends InventoryProduct {
  category_name: string | null;
  supplier_name: string | null;
  stock_level: number;
}

export async function listProductsForManagement(): Promise<ProductForManagement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_products")
    .select("*, inventory_categories ( name ), inventory_suppliers ( name )")
    .order("name");

  if (error) {
    console.error("listProductsForManagement failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as (InventoryProduct & {
    inventory_categories: { name: string } | null;
    inventory_suppliers: { name: string } | null;
  })[];
  const stockLevels = await getStockLevels(rows.map((row) => row.id));

  return rows.map((row) => {
    const { inventory_categories, inventory_suppliers, ...product } = row;
    return {
      ...product,
      category_name: inventory_categories?.name ?? null,
      supplier_name: inventory_suppliers?.name ?? null,
      stock_level: stockLevels.get(row.id) ?? 0,
    };
  });
}

export interface ProductDetail {
  product: ProductForManagement;
  movements: InventoryMovement[];
  purchaseOrderItems: (PurchaseOrderItem & { purchase_order_reference: string | null; supplier_name: string | null })[];
}

/** One product's full picture: current stock, movement ledger, and every PO line that ever received it — for the product detail page, mirroring /compensation/doctors/[id]'s shape. */
export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  const supabase = await createClient();

  const { data: productRow, error: productError } = await supabase
    .from("inventory_products")
    .select("*, inventory_categories ( name ), inventory_suppliers ( name )")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !productRow) {
    if (productError) console.error("getProductDetail: product lookup failed", productError);
    return null;
  }

  const [movementsRes, itemsRes, stockLevels] = await Promise.all([
    supabase
      .from("inventory_movements")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    supabase
      .from("purchase_order_items")
      .select("*, purchase_orders ( reference_number, inventory_suppliers ( name ) )")
      .eq("product_id", productId)
      .order("created_at", { ascending: false }),
    getStockLevels([productId]),
  ]);

  if (movementsRes.error) console.error("getProductDetail: movements lookup failed", movementsRes.error);
  if (itemsRes.error) console.error("getProductDetail: purchase order items lookup failed", itemsRes.error);

  const productRowTyped = productRow as unknown as InventoryProduct & {
    inventory_categories: { name: string } | null;
    inventory_suppliers: { name: string } | null;
  };
  const { inventory_categories, inventory_suppliers, ...product } = productRowTyped;

  const itemRows = (itemsRes.data ?? []) as unknown as (PurchaseOrderItem & {
    purchase_orders: { reference_number: string | null; inventory_suppliers: { name: string } | null } | null;
  })[];

  return {
    product: {
      ...product,
      category_name: inventory_categories?.name ?? null,
      supplier_name: inventory_suppliers?.name ?? null,
      stock_level: stockLevels.get(productId) ?? 0,
    },
    movements: movementsRes.data ?? [],
    purchaseOrderItems: itemRows.map((row) => {
      const { purchase_orders, ...item } = row;
      return {
        ...item,
        purchase_order_reference: purchase_orders?.reference_number ?? null,
        supplier_name: purchase_orders?.inventory_suppliers?.name ?? null,
      };
    }),
  };
}

export interface LowStockProduct {
  id: string;
  name: string;
  unit: string;
  reorder_threshold: number;
  stock_level: number;
}

/** Active products whose current stock is at or below their reorder threshold — a computed read, not a stored flag, same as every other "pending"-style figure in this app. */
export async function getLowStockProducts(): Promise<LowStockProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_products")
    .select("id, name, unit, reorder_threshold")
    .eq("is_active", true);

  if (error) {
    console.error("getLowStockProducts failed", error);
    return [];
  }

  const stockLevels = await getStockLevels(data.map((row) => row.id));

  return data
    .map((row) => ({ ...row, stock_level: stockLevels.get(row.id) ?? 0 }))
    .filter((row) => row.stock_level <= row.reorder_threshold)
    .sort((a, b) => a.stock_level - b.stock_level);
}

export interface ExpiringItem {
  id: string;
  product_id: string;
  product_name: string;
  expiration_date: string;
  quantity_remaining: number;
}

/** Purchase order lines expiring within `days`, with received stock still remaining — remaining is quantity_received minus whatever's already been moved out against this specific batch. */
export async function getExpiringSoonItems(days = 30): Promise<ExpiringItem[]> {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const { data: items, error } = await supabase
    .from("purchase_order_items")
    .select("id, product_id, expiration_date, quantity_received, inventory_products ( name )")
    .not("expiration_date", "is", null)
    .gt("quantity_received", 0)
    .lte("expiration_date", cutoff.toISOString().slice(0, 10))
    .order("expiration_date", { ascending: true });

  if (error) {
    console.error("getExpiringSoonItems failed", error);
    return [];
  }

  const itemRows = (items ?? []) as unknown as {
    id: string;
    product_id: string;
    expiration_date: string;
    quantity_received: number;
    inventory_products: { name: string } | null;
  }[];
  if (itemRows.length === 0) return [];

  const { data: movements, error: movementsError } = await supabase
    .from("inventory_movements")
    .select("purchase_order_item_id, quantity")
    .in(
      "purchase_order_item_id",
      itemRows.map((row) => row.id),
    );

  if (movementsError) console.error("getExpiringSoonItems: movement lookup failed", movementsError);

  const movedByItem = new Map<string, number>();
  for (const movement of movements ?? []) {
    if (!movement.purchase_order_item_id) continue;
    movedByItem.set(
      movement.purchase_order_item_id,
      (movedByItem.get(movement.purchase_order_item_id) ?? 0) + Number(movement.quantity),
    );
  }

  return itemRows
    .map((row) => ({
      id: row.id,
      product_id: row.product_id,
      product_name: row.inventory_products?.name ?? "—",
      expiration_date: row.expiration_date,
      // movedByItem already nets every movement tagged with this batch's
      // purchase_order_item_id — the original +receive plus any later
      // consumption/adjustment/expiration against it — so it *is* the
      // remaining balance directly, not something to combine with
      // quantity_received again.
      quantity_remaining: movedByItem.get(row.id) ?? 0,
    }))
    .filter((row) => row.quantity_remaining > 0);
}

export interface InventoryDashboardSummary {
  activeProductCount: number;
  lowStockCount: number;
  expiringSoonCount: number;
  estimatedStockValue: number;
}

/** Hub KPI row — one round trip per figure, run in parallel, same shape getBillingDashboardCounts()/getClinicCompensationSummary() already use. */
export async function getInventoryDashboardSummary(): Promise<InventoryDashboardSummary> {
  const supabase = await createClient();

  const [productCountRes, lowStock, expiringSoon, movementsRes, itemsRes] = await Promise.all([
    supabase.from("inventory_products").select("*", { count: "exact", head: true }).eq("is_active", true),
    getLowStockProducts(),
    getExpiringSoonItems(30),
    supabase.from("inventory_movements").select("product_id, quantity"),
    supabase
      .from("purchase_order_items")
      .select("product_id, unit_cost, created_at")
      .order("created_at", { ascending: false }),
  ]);

  // Estimated stock value: current stock quantity per product, valued at
  // that product's most recently received unit cost. A deliberate
  // simplification (latest-cost, not FIFO/weighted-average) — this app has
  // no batch-level consumption attribution to support real FIFO costing,
  // and inventing that costing model wasn't part of the approved scope.
  const stockByProduct = new Map<string, number>();
  for (const row of movementsRes.data ?? []) {
    stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + Number(row.quantity));
  }
  const latestCostByProduct = new Map<string, number>();
  for (const row of itemsRes.data ?? []) {
    if (!latestCostByProduct.has(row.product_id)) latestCostByProduct.set(row.product_id, Number(row.unit_cost));
  }
  let estimatedStockValue = 0;
  for (const [productId, quantity] of stockByProduct) {
    if (quantity <= 0) continue;
    estimatedStockValue += quantity * (latestCostByProduct.get(productId) ?? 0);
  }

  return {
    activeProductCount: productCountRes.count ?? 0,
    lowStockCount: lowStock.length,
    expiringSoonCount: expiringSoon.length,
    estimatedStockValue,
  };
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------

export interface PurchaseOrderForList extends PurchaseOrder {
  supplier_name: string;
}

export async function listPurchaseOrders(): Promise<PurchaseOrderForList[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select("*, inventory_suppliers ( name )")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listPurchaseOrders failed", error);
    return [];
  }

  return ((data ?? []) as unknown as (PurchaseOrder & { inventory_suppliers: { name: string } | null })[]).map(
    (row) => {
      const { inventory_suppliers, ...order } = row;
      return { ...order, supplier_name: inventory_suppliers?.name ?? "—" };
    },
  );
}

export interface PurchaseOrderItemDetail extends PurchaseOrderItem {
  product_name: string;
  product_unit: string;
}

export interface PurchaseOrderDetail extends PurchaseOrderForList {
  items: PurchaseOrderItemDetail[];
}

export async function getPurchaseOrderDetail(id: string): Promise<PurchaseOrderDetail | null> {
  const supabase = await createClient();

  const [orderRes, itemsRes] = await Promise.all([
    supabase.from("purchase_orders").select("*, inventory_suppliers ( name )").eq("id", id).maybeSingle(),
    supabase
      .from("purchase_order_items")
      .select("*, inventory_products ( name, unit )")
      .eq("purchase_order_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (orderRes.error || !orderRes.data) {
    if (orderRes.error) console.error("getPurchaseOrderDetail: order lookup failed", orderRes.error);
    return null;
  }
  if (itemsRes.error) console.error("getPurchaseOrderDetail: items lookup failed", itemsRes.error);

  const orderRow = orderRes.data as unknown as PurchaseOrder & { inventory_suppliers: { name: string } | null };
  const { inventory_suppliers, ...order } = orderRow;

  const itemRows = (itemsRes.data ?? []) as unknown as (PurchaseOrderItem & {
    inventory_products: { name: string; unit: string } | null;
  })[];

  return {
    ...order,
    supplier_name: inventory_suppliers?.name ?? "—",
    items: itemRows.map((row) => {
      const { inventory_products, ...item } = row;
      return { ...item, product_name: inventory_products?.name ?? "—", product_unit: inventory_products?.unit ?? "piece" };
    }),
  };
}

// ---------------------------------------------------------------------------
// Movements (ledger)
// ---------------------------------------------------------------------------

export interface MovementForHistory extends InventoryMovement {
  product_name: string;
}

/** Clinic-wide movement ledger, most recent first — for the Movements page and the dashboard's "Recent movements" card. */
export async function getInventoryMovements(limit = 50): Promise<MovementForHistory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, inventory_products ( name )")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getInventoryMovements failed", error);
    return [];
  }

  return ((data ?? []) as unknown as (InventoryMovement & { inventory_products: { name: string } | null })[]).map(
    (row) => {
      const { inventory_products, ...movement } = row;
      return { ...movement, product_name: inventory_products?.name ?? "—" };
    },
  );
}
