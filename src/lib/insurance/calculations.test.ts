import { describe, it, expect } from "vitest";
import { computeCoverageSplit } from "@/lib/insurance/calculations";

describe("computeCoverageSplit — insurer/patient share estimate", () => {
  it("splits an 80% coverage plan on a 1000 charge", () => {
    expect(computeCoverageSplit(1000, 80)).toEqual({ insurerAmount: 800, patientAmount: 200 });
  });

  it("covers everything at 100%", () => {
    expect(computeCoverageSplit(500, 100)).toEqual({ insurerAmount: 500, patientAmount: 0 });
  });

  it("covers nothing at 0%", () => {
    expect(computeCoverageSplit(500, 0)).toEqual({ insurerAmount: 0, patientAmount: 500 });
  });

  it("clamps a coverage percent above 100", () => {
    expect(computeCoverageSplit(500, 150)).toEqual({ insurerAmount: 500, patientAmount: 0 });
  });

  it("clamps a negative coverage percent", () => {
    expect(computeCoverageSplit(500, -10)).toEqual({ insurerAmount: 0, patientAmount: 500 });
  });

  it("keeps insurer + patient summing back to the original amount despite rounding", () => {
    const { insurerAmount, patientAmount } = computeCoverageSplit(100, 33);
    expect(insurerAmount + patientAmount).toBe(100);
  });
});
