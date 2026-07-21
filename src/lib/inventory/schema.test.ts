import { describe, it, expect } from "vitest";
import {
  adjustmentFormSchema,
  categoryFormSchema,
  consumptionFormSchema,
  productFormSchema,
  purchaseOrderFormSchema,
  purchaseOrderItemInputSchema,
  supplierFormSchema,
} from "@/lib/inventory/schema";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("categoryFormSchema", () => {
  it("parses a valid name", () => {
    const result = categoryFormSchema.safeParse({ name: "Consumables" });
    expect(result.success).toBe(true);
  });

  it("fails on an empty name", () => {
    const result = categoryFormSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("supplierFormSchema", () => {
  it("parses a valid supplier with optional fields omitted", () => {
    const result = supplierFormSchema.safeParse({ name: "Dental Supply Co." });
    expect(result.success).toBe(true);
  });

  it("fails on a malformed email", () => {
    const result = supplierFormSchema.safeParse({ name: "Dental Supply Co.", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("allows an empty email string", () => {
    const result = supplierFormSchema.safeParse({ name: "Dental Supply Co.", email: "" });
    expect(result.success).toBe(true);
  });
});

describe("productFormSchema", () => {
  it("parses a valid product", () => {
    const result = productFormSchema.safeParse({
      name: "Composite Resin",
      unit: "box",
      reorder_threshold: "5",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reorder_threshold).toBe(5);
    }
  });

  it("fails on a negative reorder threshold", () => {
    const result = productFormSchema.safeParse({ name: "Gloves", unit: "box", reorder_threshold: "-1" });
    expect(result.success).toBe(false);
  });

  it("fails on an unrecognized unit", () => {
    const result = productFormSchema.safeParse({ name: "Gloves", unit: "bottle", reorder_threshold: "5" });
    expect(result.success).toBe(false);
  });
});

describe("purchaseOrderItemInputSchema", () => {
  it("parses a valid line item", () => {
    const result = purchaseOrderItemInputSchema.safeParse({
      product_id: VALID_UUID,
      quantity_ordered: 10,
      unit_cost: 2.5,
    });
    expect(result.success).toBe(true);
  });

  it("fails on a zero quantity", () => {
    const result = purchaseOrderItemInputSchema.safeParse({ product_id: VALID_UUID, quantity_ordered: 0, unit_cost: 1 });
    expect(result.success).toBe(false);
  });

  it("fails on a negative unit cost", () => {
    const result = purchaseOrderItemInputSchema.safeParse({ product_id: VALID_UUID, quantity_ordered: 1, unit_cost: -1 });
    expect(result.success).toBe(false);
  });
});

describe("purchaseOrderFormSchema", () => {
  it("fails when there are no items", () => {
    const result = purchaseOrderFormSchema.safeParse({
      supplier_id: VALID_UUID,
      order_date: "2026-01-01",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("parses a valid order with one item", () => {
    const result = purchaseOrderFormSchema.safeParse({
      supplier_id: VALID_UUID,
      order_date: "2026-01-01",
      items: [{ product_id: VALID_UUID, quantity_ordered: 5, unit_cost: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("adjustmentFormSchema", () => {
  it("allows a negative quantity", () => {
    const result = adjustmentFormSchema.safeParse({ product_id: VALID_UUID, quantity: -3, notes: "Damaged in storage" });
    expect(result.success).toBe(true);
  });

  it("fails on a zero quantity", () => {
    const result = adjustmentFormSchema.safeParse({ product_id: VALID_UUID, quantity: 0, notes: "Reason" });
    expect(result.success).toBe(false);
  });

  it("fails when notes are missing", () => {
    const result = adjustmentFormSchema.safeParse({ product_id: VALID_UUID, quantity: 2, notes: "" });
    expect(result.success).toBe(false);
  });
});

describe("consumptionFormSchema", () => {
  it("fails on a negative quantity — consumption is always entered as a positive amount used", () => {
    const result = consumptionFormSchema.safeParse({ product_id: VALID_UUID, quantity: -1 });
    expect(result.success).toBe(false);
  });

  it("allows omitted notes", () => {
    const result = consumptionFormSchema.safeParse({ product_id: VALID_UUID, quantity: 2 });
    expect(result.success).toBe(true);
  });
});
