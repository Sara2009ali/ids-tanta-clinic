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

/**
 * Rounds to 2dp with a magnitude-scaled epsilon correction, not a bare
 * `Math.round(value * 100) / 100`. Plain binary floating point can't
 * represent values like 0.575 exactly (it's ~0.57499999999999996), which
 * pushes an exact-half-cent case to the wrong side of Math.round — e.g.
 * 5.75 * 10% naively rounds to 0.57 in JS, while Postgres's exact `numeric`
 * arithmetic (recalculate_invoice_totals in 0011_billing.sql, the real
 * source of truth for what's saved) correctly gives 0.58. Without this, the
 * create/edit form's live total preview can disagree with the saved
 * invoice by a cent.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON * Math.abs(value)) * 100) / 100;
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

/**
 * 'paid'/'cancelled' are terminal. Everything else is cancellable, but only
 * once nothing is still owed to the patient — cancelling an invoice with
 * money collected against it would leave `paid_amount` orphaned with no
 * invoice obligation behind it, so any payments must be refunded first.
 */
export function canCancelInvoice(status: InvoiceStatus, paidAmount: number): boolean {
  if (status === "paid" || status === "cancelled") return false;
  return paidAmount <= 0;
}

/** Refunds only make sense against an invoice that's actually been issued and isn't cancelled — same eligibility as recording a payment, minus the 'paid' exclusion (a fully paid invoice can still need a refund). */
export function canRefundPayment(status: InvoiceStatus): boolean {
  return status !== "draft" && status !== "cancelled";
}

export interface NetPaymentAmountInput {
  amount: number | string;
  type: string;
}

/**
 * A payment row's contribution to revenue: positive for an ordinary
 * payment, negative for a refund. `payments.amount` is always stored
 * positive regardless of `type` (0012_billing_payment_model.sql) — `type`
 * carries the sign instead, so it must be consulted here or a refund
 * inflates revenue instead of reducing it. This is the single definition of
 * "net payment amount" for the whole app: it mirrors
 * recalculate_invoice_totals()'s `case when type = 'refund' then -amount
 * else amount end` in SQL exactly, and getBillingDashboardCounts()
 * ("paidThisMonth") and Reports' revenue figures both reduce over this
 * instead of each re-deriving their own sign logic.
 */
export function netPaymentAmount(payment: NetPaymentAmountInput): number {
  const amount = Number(payment.amount);
  return payment.type === "refund" ? -amount : amount;
}

/** Sum of netPaymentAmount() across every row — "revenue," the one definition every caller (Billing dashboard, Revenue report total and series) reuses rather than re-summing amount directly. */
export function sumNetPayments(payments: readonly NetPaymentAmountInput[]): number {
  return payments.reduce((sum, payment) => sum + netPaymentAmount(payment), 0);
}
