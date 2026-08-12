import { describe, it, expect } from "vitest";
import {
  computeFullCompensation,
  proratedEarningAmount,
  groupInvoiceLinesByVisitType,
} from "@/lib/compensation/calculations";

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

describe("groupInvoiceLinesByVisitType", () => {
  // Case C: three items, same procedure, one doctor, one payment.
  it("merges multiple items for the same procedure into one group", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-1", lineTotal: 300 },
      { visitTypeId: "proc-1", lineTotal: 300 },
      { visitTypeId: "proc-1", lineTotal: 400 },
    ]);
    expect(groups).toEqual([{ visitTypeId: "proc-1", groupSubtotal: 1000 }]);
  });

  // Case B: two distinct procedures stay as two separate groups.
  it("keeps distinct procedures as separate groups", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-1", lineTotal: 600 },
      { visitTypeId: "proc-2", lineTotal: 400 },
    ]);
    expect(groups).toEqual([
      { visitTypeId: "proc-1", groupSubtotal: 600 },
      { visitTypeId: "proc-2", groupSubtotal: 400 },
    ]);
  });

  // Case E: every custom item collapses into a single combined group.
  it("merges every null (custom-item) visit_type_id into one combined group", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: null, lineTotal: 100 },
      { visitTypeId: null, lineTotal: 250 },
    ]);
    expect(groups).toEqual([{ visitTypeId: null, groupSubtotal: 350 }]);
  });

  // Case D: a mix of catalog and custom items produces one group per procedure plus one combined custom group.
  it("separates procedure-linked items from the combined custom-item group", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-1", lineTotal: 600 },
      { visitTypeId: null, lineTotal: 200 },
      { visitTypeId: null, lineTotal: 150 },
    ]);
    expect(groups).toEqual([
      { visitTypeId: "proc-1", groupSubtotal: 600 },
      { visitTypeId: null, groupSubtotal: 350 },
    ]);
  });

  it("returns nothing for an invoice with no items", () => {
    expect(groupInvoiceLinesByVisitType([])).toEqual([]);
  });
});

/**
 * These combine groupInvoiceLinesByVisitType + computeFullCompensation +
 * proratedEarningAmount exactly the way sync_doctor_compensation()
 * (0026_compensation_procedure_grouping.sql) combines them per payment —
 * one full-compensation + proration pass per group, never against the
 * whole invoice's subtotal. Scenario letters match the Phase 6
 * implementation-plan review.
 */
describe("grouped compensation scenarios (mirrors sync_doctor_compensation's per-group loop)", () => {
  // Case A: one procedure, one doctor, one full payment.
  it("A: single procedure, fully paid, earns the full rate", () => {
    const groups = groupInvoiceLinesByVisitType([{ visitTypeId: "proc-1", lineTotal: 1000 }]);
    const invoiceSubtotal = 1000;
    const [group] = groups;
    const fullComp = computeFullCompensation("percentage", { rate: 30 }, group.groupSubtotal);
    expect(proratedEarningAmount(fullComp, 1000, invoiceSubtotal)).toBe(300);
  });

  // Case B + the critical fully-paid invariant: sum of grouped earnings ==
  // sum of each group's independently-computed full compensation.
  it("B: two procedures, same doctor, fully paid — sum of groups equals sum of independent full compensation", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-1", lineTotal: 600 },
      { visitTypeId: "proc-2", lineTotal: 400 },
    ]);
    const invoiceSubtotal = 1000;
    const rules: Record<string, () => number> = {
      "proc-1": () => computeFullCompensation("percentage", { rate: 30 }, 600),
      "proc-2": () => computeFullCompensation("fixed", { amount: 50 }, 400),
    };

    const independentFullComps = groups.map((g) => rules[g.visitTypeId as string]());
    const paidInFullEarnings = groups.map((g) =>
      proratedEarningAmount(rules[g.visitTypeId as string](), 1000, invoiceSubtotal),
    );

    expect(independentFullComps).toEqual([180, 50]);
    expect(paidInFullEarnings.reduce((a, b) => a + b, 0)).toBe(
      independentFullComps.reduce((a, b) => a + b, 0),
    );
  });

  // Case D: procedure-linked items and custom items each get their own group and their own rule.
  it("D: procedure items plus custom items resolve as independent groups", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-1", lineTotal: 600 },
      { visitTypeId: null, lineTotal: 200 },
      { visitTypeId: null, lineTotal: 150 },
    ]);
    const invoiceSubtotal = 950;

    const procedureGroup = groups.find((g) => g.visitTypeId === "proc-1")!;
    const customGroup = groups.find((g) => g.visitTypeId === null)!;

    const procedureFullComp = computeFullCompensation("percentage", { rate: 30 }, procedureGroup.groupSubtotal);
    // Doctor-only catch-all rule (compensation_rules.visit_type_id is null) — same resolve_compensation_rule() precedence, unchanged.
    const customFullComp = computeFullCompensation("percentage", { rate: 10 }, customGroup.groupSubtotal);

    expect(proratedEarningAmount(procedureFullComp, 950, invoiceSubtotal)).toBe(180);
    expect(proratedEarningAmount(customFullComp, 950, invoiceSubtotal)).toBe(35);
  });

  // Case F: partial payment prorates each group by the payment's share of the whole invoice, same formula as before.
  it("F: partial payment prorates the group's full compensation by the payment's share of the invoice", () => {
    const groups = groupInvoiceLinesByVisitType([{ visitTypeId: "proc-1", lineTotal: 1000 }]);
    const invoiceSubtotal = 1000;
    const fullComp = computeFullCompensation("percentage", { rate: 20 }, groups[0].groupSubtotal);
    expect(proratedEarningAmount(fullComp, 400, invoiceSubtotal)).toBe(80);
  });

  // Case G: multiple partial payments against the same group sum to exactly the full compensation once the invoice is fully paid.
  it("G: multiple partial payments against one group sum to the full compensation", () => {
    const groups = groupInvoiceLinesByVisitType([{ visitTypeId: "proc-1", lineTotal: 1000 }]);
    const invoiceSubtotal = 1000;
    const fullComp = computeFullCompensation("percentage", { rate: 20 }, groups[0].groupSubtotal);

    const firstPayment = proratedEarningAmount(fullComp, 400, invoiceSubtotal);
    const secondPayment = proratedEarningAmount(fullComp, 600, invoiceSubtotal);

    expect(firstPayment).toBe(80);
    expect(secondPayment).toBe(120);
    expect(firstPayment + secondPayment).toBe(fullComp);
  });

  // Case H: full payment across three groups with three different rule types — the invariant holds regardless of rule mix.
  it("H: fully paid invoice — sum across percentage/fixed/hybrid groups equals sum of independent full compensation", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-pct", lineTotal: 500 },
      { visitTypeId: "proc-fixed", lineTotal: 300 },
      { visitTypeId: "proc-hybrid", lineTotal: 200 },
    ]);
    const invoiceSubtotal = 1000;

    const fullComps = [
      computeFullCompensation("percentage", { rate: 20 }, groups[0].groupSubtotal),
      computeFullCompensation("fixed", { amount: 40 }, groups[1].groupSubtotal),
      computeFullCompensation("hybrid", { base_amount: 10, rate: 10 }, groups[2].groupSubtotal),
    ];
    const earnings = fullComps.map((fullComp) => proratedEarningAmount(fullComp, 1000, invoiceSubtotal));

    expect(fullComps).toEqual([100, 40, 30]);
    expect(earnings).toEqual(fullComps);
    expect(earnings.reduce((a, b) => a + b, 0)).toBe(fullComps.reduce((a, b) => a + b, 0));
  });

  // Case K: a zero-price line still earns under a fixed rule (which ignores subtotal), localized to just that group.
  it("K: a zero-price procedure still earns under a fixed rule, independent of the other group", () => {
    const groups = groupInvoiceLinesByVisitType([
      { visitTypeId: "proc-free", lineTotal: 0 },
      { visitTypeId: "proc-paid", lineTotal: 500 },
    ]);
    const invoiceSubtotal = 500;

    const freeGroupComp = computeFullCompensation("fixed", { amount: 50 }, groups[0].groupSubtotal);
    const paidGroupComp = computeFullCompensation("percentage", { rate: 20 }, groups[1].groupSubtotal);

    expect(proratedEarningAmount(freeGroupComp, 500, invoiceSubtotal)).toBe(50);
    expect(proratedEarningAmount(paidGroupComp, 500, invoiceSubtotal)).toBe(100);
  });

  // Case L: a zero-subtotal invoice can't divide-by-zero for any group, regardless of rule type.
  it("L: a zero-subtotal invoice prorates every group to 0 instead of dividing by zero", () => {
    const groups = groupInvoiceLinesByVisitType([{ visitTypeId: "proc-1", lineTotal: 0 }]);
    const invoiceSubtotal = 0;
    const fullComp = computeFullCompensation("fixed", { amount: 50 }, groups[0].groupSubtotal);
    expect(proratedEarningAmount(fullComp, 0, invoiceSubtotal)).toBe(0);
  });
});
