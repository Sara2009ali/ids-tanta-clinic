import { describe, it, expect } from "vitest";
import { aggregateProcedureRevenue } from "@/lib/reports/calculations";

/**
 * Covers the pure grouping/summing step of getProcedureRevenue()
 * (reports/queries.ts) — the actual database round trip isn't testable
 * without a live Postgres (no local harness exists in this repo), so this
 * mirrors the same approach compensation/calculations.test.ts already uses
 * for the identical sync_doctor_compensation() grouping logic: extract the
 * pure step into reports/calculations.ts, test it directly.
 */
describe("aggregateProcedureRevenue", () => {
  // a. one invoice with one procedure
  it("attributes a single line item's revenue to its procedure", () => {
    const result = aggregateProcedureRevenue([{ visitTypeId: "proc-1", lineTotal: 500 }]);
    expect(result).toEqual([{ visitTypeId: "proc-1", revenue: 500, appointmentCount: 1 }]);
  });

  // b. one invoice with multiple procedures
  it("keeps distinct procedures on the same invoice as separate groups, without double-counting", () => {
    const result = aggregateProcedureRevenue([
      { visitTypeId: "proc-1", lineTotal: 600 },
      { visitTypeId: "proc-2", lineTotal: 400 },
    ]);
    expect(result).toEqual([
      { visitTypeId: "proc-1", revenue: 600, appointmentCount: 1 },
      { visitTypeId: "proc-2", revenue: 400, appointmentCount: 1 },
    ]);
    // The two groups' revenue must sum to exactly the two items' total —
    // no invoice-level amount is being repeated across groups.
    expect(result.reduce((sum, row) => sum + row.revenue, 0)).toBe(1000);
  });

  // c. multiple items with the same procedure (same invoice or different invoices in range)
  it("aggregates multiple line items for the same procedure into one row", () => {
    const result = aggregateProcedureRevenue([
      { visitTypeId: "proc-1", lineTotal: 300 },
      { visitTypeId: "proc-1", lineTotal: 300 },
      { visitTypeId: "proc-1", lineTotal: 400 },
    ]);
    expect(result).toEqual([{ visitTypeId: "proc-1", revenue: 1000, appointmentCount: 3 }]);
  });

  // d. procedure changed on the invoice compared with the appointment — the
  // function only ever receives invoice_items data, never appointment data,
  // so it structurally cannot fall back to the appointment's original
  // procedure. This proves the fix by construction: whatever visitTypeId
  // the item itself carries is what gets attributed, full stop.
  it("attributes revenue to the item's own visit_type_id, with no way to read the appointment's original procedure", () => {
    const result = aggregateProcedureRevenue([{ visitTypeId: "proc-changed-to-this", lineTotal: 750 }]);
    expect(result).toEqual([{ visitTypeId: "proc-changed-to-this", revenue: 750, appointmentCount: 1 }]);
  });

  // e. custom invoice item with visit_type_id = null
  it("collapses every custom (null visit_type_id) item into one combined group", () => {
    const result = aggregateProcedureRevenue([
      { visitTypeId: null, lineTotal: 100 },
      { visitTypeId: null, lineTotal: 250 },
    ]);
    expect(result).toEqual([{ visitTypeId: null, revenue: 350, appointmentCount: 2 }]);
  });

  it("keeps the custom-item group separate from procedure-linked groups on the same invoice", () => {
    const result = aggregateProcedureRevenue([
      { visitTypeId: "proc-1", lineTotal: 600 },
      { visitTypeId: null, lineTotal: 200 },
      { visitTypeId: null, lineTotal: 150 },
    ]);
    expect(result).toEqual([
      { visitTypeId: "proc-1", revenue: 600, appointmentCount: 1 },
      { visitTypeId: null, revenue: 350, appointmentCount: 2 },
    ]);
  });

  it("returns nothing for an empty range", () => {
    expect(aggregateProcedureRevenue([])).toEqual([]);
  });
});
