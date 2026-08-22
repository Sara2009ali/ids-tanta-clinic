/**
 * Pure, display-only insurance math — "if this plan covers X%, roughly how
 * much would the insurer vs. the patient owe on a given charge". Not wired
 * into Billing: invoices/invoice_items have no insurer-covered/patient-
 * responsibility split yet (see 0032_insurance_foundation.sql's header), so
 * this exists purely to answer "what does insurance cover" on the patient's
 * insurance info, not to compute an actual invoice line.
 */

export interface CoverageSplit {
  insurerAmount: number;
  patientAmount: number;
}

/** Splits a charge into estimated insurer/patient shares for a flat coverage percentage. Rounds to cents; the patient share absorbs the rounding remainder so the two always sum back to `amount`. */
export function computeCoverageSplit(amount: number, coveragePercent: number): CoverageSplit {
  const clampedPercent = Math.min(Math.max(coveragePercent, 0), 100);
  const insurerAmount = Math.round(amount * (clampedPercent / 100) * 100) / 100;
  const patientAmount = Math.round((amount - insurerAmount) * 100) / 100;
  return { insurerAmount, patientAmount };
}
