/**
 * Pure low-stock eligibility + state-transition logic (Batch 8) — no I/O.
 * Kept separate from the scheduler job's own Supabase calls, the same
 * split every other domain module in this codebase already uses.
 *
 * Unlike appointment reminders (a one-shot event, deduped by a database
 * unique event_key), low stock is a *condition* that can stay true across
 * many scheduler runs — a product sitting at zero stock for a week must
 * not renotify every time the job runs. This module decides the edge-
 * triggered transition (inventory_low_stock_alerts, 0041) that makes that
 * possible: notify only the moment a product first crosses at-or-below its
 * threshold, and only notify again after it has genuinely recovered above
 * the threshold and later drops again.
 */

export interface LowStockProductCandidate {
  productId: string;
  clinicId: string;
  isActive: boolean;
  /** inventory_products.reorder_threshold — schema has no nullable "unset" state (not null default 0), so <= 0 is treated as "no meaningful threshold configured," never a fabricated default. */
  reorderThreshold: number;
  /** Sum of inventory_movements.quantity for this product, the same live aggregation getStockLevels() already computes. */
  stockLevel: number;
}

/**
 * Whether a product is currently in a low-stock condition. Inactive
 * products and products with no valid (> 0) reorder threshold are never
 * considered low, regardless of stock level — this is the "do not notify
 * inactive items / do not create a fake threshold" rule, expressed once.
 */
export function isLowStock(product: LowStockProductCandidate): boolean {
  if (!product.isActive) return false;
  if (product.reorderThreshold <= 0) return false;
  return product.stockLevel <= product.reorderThreshold;
}

export type LowStockAction = "notify" | "clear_alert" | "none";

export interface LowStockDecision {
  isLow: boolean;
  /**
   * "notify" — the product just crossed into low stock and has no existing
   * alert row: create the notification and record the alert.
   * "clear_alert" — the product has recovered above its threshold and an
   * alert row still exists from a prior episode: delete it, so a future
   * drop notifies again.
   * "none" — no state change: either still low with an alert already
   * recorded (don't repeat), or normal stock with nothing recorded.
   */
  action: LowStockAction;
}

export function decideLowStockAction(
  product: LowStockProductCandidate,
  hasExistingAlert: boolean,
): LowStockDecision {
  const low = isLowStock(product);

  if (low && !hasExistingAlert) return { isLow: low, action: "notify" };
  if (!low && hasExistingAlert) return { isLow: low, action: "clear_alert" };
  return { isLow: low, action: "none" };
}
