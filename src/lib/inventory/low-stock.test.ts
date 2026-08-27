import { describe, it, expect } from "vitest";
import { isLowStock, decideLowStockAction, type LowStockProductCandidate } from "@/lib/inventory/low-stock";

function product(overrides: Partial<LowStockProductCandidate> = {}): LowStockProductCandidate {
  return {
    productId: "product-1",
    clinicId: "clinic-1",
    isActive: true,
    reorderThreshold: 10,
    stockLevel: 5,
    ...overrides,
  };
}

describe("isLowStock", () => {
  it("is low when stock is below the reorder threshold", () => {
    expect(isLowStock(product({ stockLevel: 5, reorderThreshold: 10 }))).toBe(true);
  });

  it("is low when stock is exactly at the reorder threshold", () => {
    expect(isLowStock(product({ stockLevel: 10, reorderThreshold: 10 }))).toBe(true);
  });

  it("is not low when stock is above the reorder threshold", () => {
    expect(isLowStock(product({ stockLevel: 11, reorderThreshold: 10 }))).toBe(false);
  });

  it("is never low for an inactive item, regardless of stock", () => {
    expect(isLowStock(product({ isActive: false, stockLevel: 0, reorderThreshold: 10 }))).toBe(false);
  });

  it("is never low when the reorder threshold is zero (no valid threshold configured)", () => {
    expect(isLowStock(product({ reorderThreshold: 0, stockLevel: 0 }))).toBe(false);
  });

  it("is never low for a negative threshold (defensive — the schema forbids it, but never trust that alone)", () => {
    expect(isLowStock(product({ reorderThreshold: -1, stockLevel: 0 }))).toBe(false);
  });

  it("handles a negative stock level (over-consumption) as low, given a valid threshold", () => {
    expect(isLowStock(product({ stockLevel: -2, reorderThreshold: 10 }))).toBe(true);
  });
});

describe("decideLowStockAction — edge-triggered state transitions", () => {
  it("notifies when a product first crosses into low stock with no existing alert", () => {
    const decision = decideLowStockAction(product({ stockLevel: 5, reorderThreshold: 10 }), false);
    expect(decision).toEqual({ isLow: true, action: "notify" });
  });

  it("does not renotify while the product remains low and an alert already exists", () => {
    const decision = decideLowStockAction(product({ stockLevel: 5, reorderThreshold: 10 }), true);
    expect(decision).toEqual({ isLow: true, action: "none" });
  });

  it("does nothing when stock is normal and no alert exists", () => {
    const decision = decideLowStockAction(product({ stockLevel: 50, reorderThreshold: 10 }), false);
    expect(decision).toEqual({ isLow: false, action: "none" });
  });

  it("clears the alert once the product recovers above the threshold", () => {
    const decision = decideLowStockAction(product({ stockLevel: 50, reorderThreshold: 10 }), true);
    expect(decision).toEqual({ isLow: false, action: "clear_alert" });
  });

  it("simulates a full recovery-then-redrop cycle across repeated scheduler runs", () => {
    // Run 1: stock drops low, no alert yet -> notify.
    let hasAlert = false;
    let decision = decideLowStockAction(product({ stockLevel: 3, reorderThreshold: 10 }), hasAlert);
    expect(decision.action).toBe("notify");
    hasAlert = true; // job would insert the alert row here

    // Run 2 (scheduler runs again while still low): no repeat notification.
    decision = decideLowStockAction(product({ stockLevel: 2, reorderThreshold: 10 }), hasAlert);
    expect(decision.action).toBe("none");

    // Run 3: stock recovers above threshold -> clear the alert.
    decision = decideLowStockAction(product({ stockLevel: 20, reorderThreshold: 10 }), hasAlert);
    expect(decision.action).toBe("clear_alert");
    hasAlert = false; // job would delete the alert row here

    // Run 4 (still healthy): nothing happens.
    decision = decideLowStockAction(product({ stockLevel: 18, reorderThreshold: 10 }), hasAlert);
    expect(decision.action).toBe("none");

    // Run 5: stock falls low again -> notifies again, since the alert was cleared.
    decision = decideLowStockAction(product({ stockLevel: 4, reorderThreshold: 10 }), hasAlert);
    expect(decision.action).toBe("notify");
  });

  it("never notifies for an inactive item even with an existing (stale) alert row and low stock", () => {
    const decision = decideLowStockAction(product({ isActive: false, stockLevel: 1, reorderThreshold: 10 }), false);
    expect(decision).toEqual({ isLow: false, action: "none" });
  });
});
