import { describe, it, expect } from "vitest";
import { computeLineInsuranceSplit, aggregateInvoiceInsurance } from "@/lib/insurance/calculations";
import { computeLineTotal } from "@/lib/billing/calculations";

describe("computeLineInsuranceSplit — the one per-line insurance calculation", () => {
  it("1. no insurance (coveragePercent null): patient owes the full line, nothing recorded as covered — billing behaves exactly as before", () => {
    expect(computeLineInsuranceSplit(1000, null)).toEqual({
      insuranceCoveragePercent: null,
      insuranceCoveredAmount: 0,
      patientResponsibility: 1000,
    });
  });

  it("2. 0% coverage: an active plan that covers nothing is still 'applicable' (percent is 0, not null) — patient still owes the full line", () => {
    expect(computeLineInsuranceSplit(1000, 0)).toEqual({
      insuranceCoveragePercent: 0,
      insuranceCoveredAmount: 0,
      patientResponsibility: 1000,
    });
  });

  it("3. 50% coverage splits the line evenly", () => {
    expect(computeLineInsuranceSplit(1000, 50)).toEqual({
      insuranceCoveragePercent: 50,
      insuranceCoveredAmount: 500,
      patientResponsibility: 500,
    });
  });

  it("4. 80% coverage — the spec's own worked example (service price 900, insurance pays 720, patient owes 180)", () => {
    expect(computeLineInsuranceSplit(900, 80)).toEqual({
      insuranceCoveragePercent: 80,
      insuranceCoveredAmount: 720,
      patientResponsibility: 180,
    });
  });

  it("5. 100% coverage: patient responsibility becomes zero", () => {
    expect(computeLineInsuranceSplit(500, 100)).toEqual({
      insuranceCoveragePercent: 100,
      insuranceCoveredAmount: 500,
      patientResponsibility: 0,
    });
  });

  it("7. quantity > 1 is already baked into lineTotal by computeLineTotal — insurance never needs to know about quantity directly", () => {
    const lineTotal = computeLineTotal({ quantity: 3, unitPrice: 100 });
    expect(lineTotal).toBe(300);
    expect(computeLineInsuranceSplit(lineTotal, 50)).toEqual({
      insuranceCoveragePercent: 50,
      insuranceCoveredAmount: 150,
      patientResponsibility: 150,
    });
  });

  it("8. rounding: an exact-half-cent case resolves the same way round2() resolves it elsewhere in Billing, not naive floating point", () => {
    // 5.75 * 10% is the same half-cent case billing/calculations.ts's round2
    // doc comment calls out (naive Math.round gives 0.57, not 0.58).
    const split = computeLineInsuranceSplit(5.75, 10);
    expect(split.insuranceCoveredAmount).toBe(0.58);
    expect(split.patientResponsibility).toBe(5.17);
    expect(split.insuranceCoveredAmount + split.patientResponsibility).toBe(5.75);
  });

  it("9. price-list override + insurance: the overridden (900, not the catalog 1000) price is what insurance is applied to", () => {
    const overriddenPrice = 900; // as if resolveServicePrice() already resolved this from the patient's Price List
    const split = computeLineInsuranceSplit(overriddenPrice, 80);
    expect(split.insuranceCoveredAmount).toBe(720);
    expect(split.patientResponsibility).toBe(180);
  });

  it("10. a later insurance-plan coverage change never mutates an already-computed split — pure function, no shared state", () => {
    const lineTotal = 1000;
    const originalSplit = computeLineInsuranceSplit(lineTotal, 80);
    // Simulates the plan's coverage_percent changing after the invoice was created.
    const laterSplit = computeLineInsuranceSplit(lineTotal, 50);
    expect(originalSplit).toEqual({ insuranceCoveragePercent: 80, insuranceCoveredAmount: 800, patientResponsibility: 200 });
    expect(laterSplit).toEqual({ insuranceCoveragePercent: 50, insuranceCoveredAmount: 500, patientResponsibility: 500 });
  });

  it("12. patient responsibility can never go negative, even with an out-of-range coverage percent", () => {
    expect(computeLineInsuranceSplit(500, 150).patientResponsibility).toBe(0);
    expect(computeLineInsuranceSplit(500, 150).insuranceCoveragePercent).toBe(100);
    expect(computeLineInsuranceSplit(0, 80).patientResponsibility).toBe(0);
    expect(computeLineInsuranceSplit(500, -10).patientResponsibility).toBe(500);
    expect(computeLineInsuranceSplit(500, -10).insuranceCoveragePercent).toBe(0);
  });

  it("13. insurance amount can never exceed the eligible line amount, even at 100% coverage on an odd-cent line", () => {
    const split = computeLineInsuranceSplit(0.03, 100);
    expect(split.insuranceCoveredAmount).toBeLessThanOrEqual(0.03);
    expect(split.insuranceCoveredAmount).toBe(0.03);
    expect(split.patientResponsibility).toBe(0);
  });
});

describe("aggregateInvoiceInsurance — invoice-level Insurance/Patient responsibility summary", () => {
  it("6. multiple invoice lines aggregate correctly", () => {
    const items = [
      computeLineInsuranceSplitAsRow(900, 80), // 720 / 180
      computeLineInsuranceSplitAsRow(200, 80), // 160 / 40
    ];
    expect(aggregateInvoiceInsurance(items)).toEqual({
      applied: true,
      insuranceTotal: 880,
      patientResponsibilityTotal: 220,
    });
  });

  it("marks the invoice as insurance-applied even when every line is 0% covered", () => {
    const items = [computeLineInsuranceSplitAsRow(500, 0), computeLineInsuranceSplitAsRow(300, 0)];
    expect(aggregateInvoiceInsurance(items)).toEqual({ applied: true, insuranceTotal: 0, patientResponsibilityTotal: 800 });
  });

  it("reports not-applied for a patient with no structured insurance — the UI's cue to hide insurance rows entirely", () => {
    const items = [computeLineInsuranceSplitAsRow(500, null), computeLineInsuranceSplitAsRow(300, null)];
    expect(aggregateInvoiceInsurance(items)).toEqual({ applied: false, insuranceTotal: 0, patientResponsibilityTotal: 800 });
  });

  it("11. a later price-list change never retroactively changes an already-aggregated invoice — aggregation only ever reads the stored per-line values passed in", () => {
    const storedItems = [computeLineInsuranceSplitAsRow(900, 80)]; // as if resolved from a Price List price at creation time
    const totalsAtCreation = aggregateInvoiceInsurance(storedItems);
    // Even if the price list's override for this service changes later, the
    // already-stored row (900 / 80%) is what aggregation reads — never a
    // freshly re-resolved price.
    expect(totalsAtCreation).toEqual({ applied: true, insuranceTotal: 720, patientResponsibilityTotal: 180 });
  });

  it("returns a zeroed, not-applied summary for no items", () => {
    expect(aggregateInvoiceInsurance([])).toEqual({ applied: false, insuranceTotal: 0, patientResponsibilityTotal: 0 });
  });
});

function computeLineInsuranceSplitAsRow(lineTotal: number, coveragePercent: number | null) {
  const split = computeLineInsuranceSplit(lineTotal, coveragePercent);
  return {
    insurance_coverage_percent: split.insuranceCoveragePercent,
    insurance_covered_amount: split.insuranceCoveredAmount,
    patient_responsibility: split.patientResponsibility,
  };
}
