/**
 * Pure billing math — no I/O, mirrors validation.ts's convention of pure,
 * independently-testable business logic shared between server and client.
 *
 * This module intentionally mirrors recalculate_invoice_totals()'s math in
 * supabase/migrations/0011_billing.sql line for line, so the create/edit
 * form's live total preview matches what the database will actually store
 * after save — the database trigger remains the real authority (it runs
 * regardless of which code path touched invoice_items/payments), the same
 * relationship validation.ts's working-hours/overlap checks have to the
 * appointments exclusion constraints.
 */

import type { InvoiceStatus } from "@/types/domain";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface InvoiceItemInput {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}

/** quantity * unitPrice - discountAmount, floored at 0 (matches invoice_items.line_total's `check (line_total >= 0)`). */
export function computeLineTotal(item: InvoiceItemInput): number {
  const raw = item.quantity * item.unitPrice - (item.discountAmount ?? 0);
  return Math.max(0, round2(raw));
}

export interface InvoiceTotals {
  subtotal: number;
  taxAmount: number;
  total: number;
}

/** subtotal = sum of line totals; taxAmount = subtotal * taxPercent / 100; total = subtotal + taxAmount. */
export function computeInvoiceTotals(items: readonly InvoiceItemInput[], taxPercent: number): InvoiceTotals {
  const subtotal = round2(items.reduce((sum, item) => sum + computeLineTotal(item), 0));
  const taxAmount = round2((subtotal * taxPercent) / 100);
  const total = round2(subtotal + taxAmount);
  return { subtotal, taxAmount, total };
}

/** Floored at 0 — an overpayment never produces a negative balance. */
export function computeBalanceDue(total: number, paidAmount: number): number {
  return Math.max(0, round2(total - paidAmount));
}

/**
 * 'draft' and 'cancelled' are never auto-overridden — both are set
 * explicitly by the application (createInvoice / cancelInvoice), not
 * derived from payment state. Every other status is fully determined by
 * paid vs. total.
 */
export function deriveInvoiceStatus(
  currentStatus: InvoiceStatus,
  total: number,
  paidAmount: number,
): InvoiceStatus {
  if (currentStatus === "draft" || currentStatus === "cancelled") {
    return currentStatus;
  }
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount < total) return "partially_paid";
  return "paid";
}

/** Line items (add/remove/edit) are only mutable while the invoice hasn't been issued yet. */
export function canEditInvoiceItems(status: InvoiceStatus): boolean {
  return status === "draft";
}

/** Payments only make sense against an invoice that's actually been issued and isn't cancelled. */
export function canRecordPayment(status: InvoiceStatus): boolean {
  return status !== "draft" && status !== "cancelled" && status !== "paid";
}
