/**
 * Pure compensation math — no I/O, mirrors billing/calculations.ts's own
 * relationship to its trigger: this module intentionally mirrors
 * compute_full_compensation() and the proration step inside
 * sync_doctor_compensation() (both in
 * supabase/migrations/0014_doctor_compensation.sql) line for line, so a
 * future rule-editor's live preview matches what the database will
 * actually record. The database trigger remains the sole source of truth
 * — it's the only thing that ever writes a doctor_earnings row — this
 * module exists purely for UX preview and unit testing.
 */

import type { CompensationRuleType } from "@/types/domain";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface PercentageConfig {
  rate: number;
}

export interface FixedConfig {
  amount: number;
}

export interface HybridConfig {
  base_amount?: number;
  rate?: number;
}

export type CompensationRuleConfig = PercentageConfig | FixedConfig | HybridConfig;

/** "Compensation owed if this invoice is paid in full" — every rule type resolves to one number, matching compute_full_compensation(). */
export function computeFullCompensation(
  type: CompensationRuleType,
  config: CompensationRuleConfig,
  invoiceSubtotal: number,
): number {
  switch (type) {
    case "percentage":
      return round2((invoiceSubtotal * (Number((config as PercentageConfig).rate) || 0)) / 100);
    case "fixed":
      return round2(Number((config as FixedConfig).amount) || 0);
    case "hybrid": {
      const hybrid = config as HybridConfig;
      return round2((Number(hybrid.base_amount) || 0) + (invoiceSubtotal * (Number(hybrid.rate) || 0)) / 100);
    }
    default:
      return 0;
  }
}

/** Prorates the full-payment compensation by how much of the invoice this specific payment covers. Mirrors sync_doctor_compensation()'s `v_amount` calculation. */
export function proratedEarningAmount(
  fullCompensation: number,
  paymentAmount: number,
  invoiceSubtotal: number,
): number {
  if (invoiceSubtotal <= 0) return 0;
  return round2(paymentAmount * (fullCompensation / invoiceSubtotal));
}

export interface InvoiceLineForGrouping {
  visitTypeId: string | null;
  lineTotal: number;
}

export interface CompensationGroup {
  visitTypeId: string | null;
  /** Sum of line_total across every item in this group — pre-tax, discount-inclusive, exactly like invoices.subtotal itself. */
  groupSubtotal: number;
}

/**
 * Mirrors sync_doctor_compensation()'s `group by ii.visit_type_id` exactly
 * (0026_compensation_procedure_grouping.sql): one group per distinct
 * procedure billed on the invoice, with every custom (non-catalog) item —
 * visitTypeId null — collapsing into a single combined group, the same
 * NULL-collation behavior Postgres's GROUP BY already gives the trigger
 * for free. A JS Map naturally does the same collation, since `null` is a
 * single distinct key like any other.
 */
export function groupInvoiceLinesByVisitType(lines: readonly InvoiceLineForGrouping[]): CompensationGroup[] {
  const totals = new Map<string | null, number>();
  for (const line of lines) {
    totals.set(line.visitTypeId, round2((totals.get(line.visitTypeId) ?? 0) + line.lineTotal));
  }
  return Array.from(totals.entries()).map(([visitTypeId, groupSubtotal]) => ({ visitTypeId, groupSubtotal }));
}
