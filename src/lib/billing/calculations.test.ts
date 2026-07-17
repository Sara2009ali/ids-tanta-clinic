import { describe, it, expect } from "vitest";
import {
  canEditInvoiceItems,
  canRecordPayment,
  computeBalanceDue,
  computeInvoiceTotals,
  computeLineTotal,
  deriveInvoiceStatus,
} from "@/lib/billing/calculations";

describe("computeLineTotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 50 })).toBe(100);
  });

  it("subtracts the discount", () => {
    expect(computeLineTotal({ quantity: 2, unitPrice: 50, discountAmount: 20 })).toBe(80);
  });

  it("floors at 0 when the discount exceeds the raw total", () => {
    expect(computeLineTotal({ quantity: 1, unitPrice: 10, discountAmount: 50 })).toBe(0);
  });

  it("treats a missing discount as 0", () => {
    expect(computeLineTotal({ quantity: 3, unitPrice: 10 })).toBe(30);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeLineTotal({ quantity: 3, unitPrice: 10.005 })).toBe(30.02);
  });
});

describe("computeInvoiceTotals", () => {
  it("sums line totals into subtotal, with no tax", () => {
    const items = [{ quantity: 1, unitPrice: 100 }, { quantity: 2, unitPrice: 50 }];
    expect(computeInvoiceTotals(items, 0)).toEqual({ subtotal: 200, taxAmount: 0, total: 200 });
  });

  it("applies a tax percent on top of the subtotal", () => {
    const items = [{ quantity: 1, unitPrice: 100 }];
    expect(computeInvoiceTotals(items, 14)).toEqual({ subtotal: 100, taxAmount: 14, total: 114 });
  });

  it("accounts for per-item discounts before taxing", () => {
    const items = [{ quantity: 1, unitPrice: 100, discountAmount: 20 }];
    expect(computeInvoiceTotals(items, 10)).toEqual({ subtotal: 80, taxAmount: 8, total: 88 });
  });

  it("returns all zeros for an empty item list", () => {
    expect(computeInvoiceTotals([], 15)).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});

describe("computeBalanceDue", () => {
  it("subtracts paid amount from total", () => {
    expect(computeBalanceDue(100, 40)).toBe(60);
  });

  it("floors at 0 for an overpayment", () => {
    expect(computeBalanceDue(100, 150)).toBe(0);
  });

  it("returns the full total when nothing has been paid", () => {
    expect(computeBalanceDue(100, 0)).toBe(100);
  });
});

describe("deriveInvoiceStatus", () => {
  it("never overrides draft, regardless of payment amounts", () => {
    expect(deriveInvoiceStatus("draft", 100, 100)).toBe("draft");
    expect(deriveInvoiceStatus("draft", 100, 0)).toBe("draft");
  });

  it("never overrides cancelled, regardless of payment amounts", () => {
    expect(deriveInvoiceStatus("cancelled", 100, 100)).toBe("cancelled");
  });

  it("derives unpaid when nothing has been paid", () => {
    expect(deriveInvoiceStatus("unpaid", 100, 0)).toBe("unpaid");
  });

  it("derives partially_paid when paid is less than total", () => {
    expect(deriveInvoiceStatus("unpaid", 100, 40)).toBe("partially_paid");
  });

  it("derives paid when paid meets or exceeds total", () => {
    expect(deriveInvoiceStatus("partially_paid", 100, 100)).toBe("paid");
    expect(deriveInvoiceStatus("partially_paid", 100, 120)).toBe("paid");
  });
});

describe("canEditInvoiceItems", () => {
  it("is true only for draft", () => {
    expect(canEditInvoiceItems("draft")).toBe(true);
    expect(canEditInvoiceItems("unpaid")).toBe(false);
    expect(canEditInvoiceItems("partially_paid")).toBe(false);
    expect(canEditInvoiceItems("paid")).toBe(false);
    expect(canEditInvoiceItems("cancelled")).toBe(false);
  });
});

describe("canRecordPayment", () => {
  it("is true for unpaid and partially_paid", () => {
    expect(canRecordPayment("unpaid")).toBe(true);
    expect(canRecordPayment("partially_paid")).toBe(true);
  });

  it("is false for draft, paid, and cancelled", () => {
    expect(canRecordPayment("draft")).toBe(false);
    expect(canRecordPayment("paid")).toBe(false);
    expect(canRecordPayment("cancelled")).toBe(false);
  });
});
