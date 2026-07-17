import { describe, it, expect } from "vitest";
import { computeFullCompensation, proratedEarningAmount } from "@/lib/compensation/calculations";

describe("computeFullCompensation", () => {
  it("percentage: applies the rate to the invoice subtotal", () => {
    expect(computeFullCompensation("percentage", { rate: 30 }, 1000)).toBe(300);
  });

  it("percentage: treats a missing rate as 0", () => {
    expect(computeFullCompensation("percentage", {} as { rate: number }, 1000)).toBe(0);
  });

  it("fixed: ignores the invoice subtotal entirely", () => {
    expect(computeFullCompensation("fixed", { amount: 150 }, 1000)).toBe(150);
    expect(computeFullCompensation("fixed", { amount: 150 }, 5)).toBe(150);
  });

  it("hybrid: sums a base amount and a percentage of the subtotal", () => {
    expect(computeFullCompensation("hybrid", { base_amount: 50, rate: 10 }, 1000)).toBe(150);
  });

  it("hybrid: treats a missing base_amount or rate as 0", () => {
    expect(computeFullCompensation("hybrid", { rate: 10 }, 1000)).toBe(100);
    expect(computeFullCompensation("hybrid", { base_amount: 50 }, 1000)).toBe(50);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeFullCompensation("percentage", { rate: 33.333 }, 100)).toBe(33.33);
  });
});

describe("proratedEarningAmount", () => {
  it("returns the full compensation when the payment covers the entire subtotal", () => {
    expect(proratedEarningAmount(300, 1000, 1000)).toBe(300);
  });

  it("prorates proportionally for a partial payment", () => {
    expect(proratedEarningAmount(300, 500, 1000)).toBe(150);
  });

  it("returns 0 when the invoice subtotal is 0, instead of dividing by zero", () => {
    expect(proratedEarningAmount(300, 100, 0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    expect(proratedEarningAmount(100, 333.33, 1000)).toBe(33.33);
  });
});
