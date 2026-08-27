import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification, getStaffIdsWithPermission } from "@/lib/notifications/service";
import { buildLowStockNotification } from "@/lib/notifications/events";
import { decideLowStockAction } from "@/lib/inventory/low-stock";
import { PERMISSIONS } from "@/lib/authz/permissions";
import type { SchedulerJobResult } from "@/lib/scheduler/registry";

/**
 * Runs via the service-role admin client for the same reason
 * appointment-reminders.ts does — no staff session, no single clinic_id.
 * All active AND inactive products are fetched (not filtered to active in
 * SQL) so decideLowStockAction() can correctly clear a stale alert row for
 * a product that was deactivated while still below its threshold; the
 * "never notify inactive items" rule is enforced once, inside that pure
 * function, not duplicated as a second SQL-level filter.
 */
export async function runLowStockNotificationsJob(): Promise<SchedulerJobResult> {
  const admin = createAdminClient();

  const [productsRes, movementsRes, alertsRes] = await Promise.all([
    admin.from("inventory_products").select("id, clinic_id, name, is_active, reorder_threshold"),
    admin.from("inventory_movements").select("product_id, quantity"),
    admin.from("inventory_low_stock_alerts").select("product_id"),
  ]);

  if (productsRes.error) return { ok: false, message: `Failed to load products: ${productsRes.error.message}` };
  if (movementsRes.error) return { ok: false, message: `Failed to load stock movements: ${movementsRes.error.message}` };
  if (alertsRes.error) return { ok: false, message: `Failed to load existing alerts: ${alertsRes.error.message}` };

  const stockByProduct = new Map<string, number>();
  for (const row of movementsRes.data ?? []) {
    stockByProduct.set(row.product_id, (stockByProduct.get(row.product_id) ?? 0) + Number(row.quantity));
  }
  const existingAlertProductIds = new Set((alertsRes.data ?? []).map((row) => row.product_id));

  let notified = 0;
  let cleared = 0;

  for (const product of productsRes.data ?? []) {
    const stockLevel = stockByProduct.get(product.id) ?? 0;
    const hasExistingAlert = existingAlertProductIds.has(product.id);

    const decision = decideLowStockAction(
      {
        productId: product.id,
        clinicId: product.clinic_id,
        isActive: product.is_active,
        reorderThreshold: Number(product.reorder_threshold),
        stockLevel,
      },
      hasExistingAlert,
    );

    if (decision.action === "notify") {
      const recipientStaffIds = await getStaffIdsWithPermission(admin, product.clinic_id, PERMISSIONS.INVENTORY_VIEW);
      const notificationId = await createNotification(
        admin,
        buildLowStockNotification({
          clinicId: product.clinic_id,
          productId: product.id,
          productName: product.name,
          stockLevel,
          reorderThreshold: Number(product.reorder_threshold),
          recipientStaffIds,
        }),
      );

      if (notificationId) {
        const { error: alertError } = await admin
          .from("inventory_low_stock_alerts")
          .insert({ product_id: product.id, clinic_id: product.clinic_id });
        if (alertError) return { ok: false, message: `Failed to record low-stock alert: ${alertError.message}` };
        notified++;
      }
    } else if (decision.action === "clear_alert") {
      const { error: clearError } = await admin.from("inventory_low_stock_alerts").delete().eq("product_id", product.id);
      if (clearError) return { ok: false, message: `Failed to clear low-stock alert: ${clearError.message}` };
      cleared++;
    }
  }

  return { ok: true, message: `low_stock_notifications: notified ${notified}, cleared ${cleared}` };
}
