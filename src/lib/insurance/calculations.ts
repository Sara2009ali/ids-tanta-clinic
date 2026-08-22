/**
 * Pure insurance-billing math — the one place a line's insurance split is
 * computed, reused by the live invoice form preview (client) and the
 * server action that actually writes invoice_items (server), the same
 * "one pure module, two callers" shape billing/calculations.ts already
 * establishes for line totals. Reuses round2() from that module rather
 * than reinventing rounding, so a line's insurance split can never disagree
 * with its own line_total by a rounding quirk.
 *
 * Nothing here talks to Supabase or reads "the patient's current plan" —
 * callers resolve that once (see getPatientBillingInsurance in
 * src/lib/insurance/queries.ts) and pass the coverage percent in. That
 * separation is what makes the result a true snapshot: calling this again
 * later, with a different percent, never touches a value already computed
 * and stored on an existing invoice line.
 */

import { round2 } from "@/lib/billing/calculations";

export interface LineInsuranceSplit {
  /** null = insurance wasn't applicable to this line (no active structured plan) — distinct from 0 (an active plan covering 0%). */
  insuranceCoveragePercent: number | null;
  insuranceCoveredAmount: number;
  patientResponsibility: number;
}

/**
 * Splits one invoice line's total between insurer and patient for a flat
 * coverage percentage — the v1 coverage rule (insurance_plans.coverage_percent).
 * `coveragePercent` is null when the patient has no active structured
 * insurance plan; billing then behaves exactly as before this phase
 * (patient owes the full line, nothing recorded as insurance-covered).
 */
export function computeLineInsuranceSplit(lineTotal: number, coveragePercent: number | null | undefined): LineInsuranceSplit {
  if (coveragePercent == null) {
    return { insuranceCoveragePercent: null, insuranceCoveredAmount: 0, patientResponsibility: Math.max(0, lineTotal) };
  }

  const clampedPercent = Math.min(Math.max(coveragePercent, 0), 100);
  const rawCovered = round2((lineTotal * clampedPercent) / 100);
  // Clamped against lineTotal, not just derived from a <=100% percentage —
  // rounding a fraction of an odd-cent lineTotal up can otherwise overshoot
  // it by a fraction of a cent (e.g. lineTotal=0.03, 100% -> 0.03 exactly,
  // but a mid-range percent can round up past what's actually owed for
  // very small lines). Insurance must never be recorded as covering more
  // than the line was ever worth.
  const insuranceCoveredAmount = Math.max(0, Math.min(rawCovered, lineTotal));
  const patientResponsibility = Math.max(0, round2(lineTotal - insuranceCoveredAmount));

  return { insuranceCoveragePercent: clampedPercent, insuranceCoveredAmount, patientResponsibility };
}

export interface InvoiceLineInsuranceValues {
  insurance_coverage_percent: number | null;
  insurance_covered_amount: number;
  patient_responsibility: number;
}

export interface InvoiceInsuranceTotals {
  /** true if insurance was considered for at least one line — the UI's cue to show the Insurance/Patient responsibility rows at all. */
  applied: boolean;
  insuranceTotal: number;
  patientResponsibilityTotal: number;
}

/** Sums a set of already-split invoice lines (live preview or stored invoice_items rows) into the invoice-level Insurance/Patient responsibility summary. */
export function aggregateInvoiceInsurance(items: readonly InvoiceLineInsuranceValues[]): InvoiceInsuranceTotals {
  const applied = items.some((item) => item.insurance_coverage_percent != null);
  const insuranceTotal = round2(items.reduce((sum, item) => sum + Number(item.insurance_covered_amount), 0));
  const patientResponsibilityTotal = round2(items.reduce((sum, item) => sum + Number(item.patient_responsibility), 0));
  return { applied, insuranceTotal, patientResponsibilityTotal };
}
