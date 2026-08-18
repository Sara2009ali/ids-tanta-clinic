import { describe, it, expect } from "vitest";
import {
  aggregateCountByDoctor,
  aggregateProcedureActivity,
  aggregateProcedureRevenue,
  averageDaysBetween,
  computeCompletionRate,
  countByStatus,
  partitionFulfillment,
} from "@/lib/reports/calculations";

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

describe("aggregateProcedureActivity — Procedure Activity's count-based procedure breakdown", () => {
  it("counts a single catalog-linked treatment record", () => {
    expect(aggregateProcedureActivity([{ visitTypeId: "proc-1" }])).toEqual([{ visitTypeId: "proc-1", count: 1 }]);
  });

  it("sums multiple records for the same procedure into one row", () => {
    const result = aggregateProcedureActivity([{ visitTypeId: "proc-1" }, { visitTypeId: "proc-1" }, { visitTypeId: "proc-1" }]);
    expect(result).toEqual([{ visitTypeId: "proc-1", count: 3 }]);
  });

  it("collapses every custom (null visit_type_id) record into one combined group, never dropping it", () => {
    const result = aggregateProcedureActivity([{ visitTypeId: null }, { visitTypeId: null }]);
    expect(result).toEqual([{ visitTypeId: null, count: 2 }]);
  });

  it("keeps the custom group separate from catalog-linked groups", () => {
    const result = aggregateProcedureActivity([{ visitTypeId: "proc-1" }, { visitTypeId: null }, { visitTypeId: null }]);
    expect(result).toEqual([
      { visitTypeId: "proc-1", count: 1 },
      { visitTypeId: null, count: 2 },
    ]);
  });

  it("returns nothing for an empty range", () => {
    expect(aggregateProcedureActivity([])).toEqual([]);
  });
});

describe("aggregateCountByDoctor — shared doctor grouping (Procedure Activity + Clinical Workload)", () => {
  it("counts rows for a single doctor", () => {
    expect(aggregateCountByDoctor([{ doctorId: "doc-1" }, { doctorId: "doc-1" }])).toEqual([
      { doctorId: "doc-1", count: 2 },
    ]);
  });

  it("keeps separate doctors as separate groups", () => {
    const result = aggregateCountByDoctor([{ doctorId: "doc-1" }, { doctorId: "doc-2" }, { doctorId: "doc-1" }]);
    expect(result).toEqual([
      { doctorId: "doc-1", count: 2 },
      { doctorId: "doc-2", count: 1 },
    ]);
  });

  it("keeps unattributed (null doctorId) rows as their own group, never dropping them", () => {
    expect(aggregateCountByDoctor([{ doctorId: null }])).toEqual([{ doctorId: null, count: 1 }]);
  });

  it("returns nothing for an empty range", () => {
    expect(aggregateCountByDoctor([])).toEqual([]);
  });
});

describe("countByStatus — shared status tally (plan status, item disposition, recall status)", () => {
  it("tallies a single status", () => {
    expect(countByStatus([{ status: "due" }, { status: "due" }])).toEqual({ due: 2 });
  });

  it("tallies multiple distinct statuses independently", () => {
    expect(countByStatus([{ status: "due" }, { status: "scheduled" }, { status: "due" }])).toEqual({
      due: 2,
      scheduled: 1,
    });
  });

  it("returns an empty object for no rows", () => {
    expect(countByStatus([])).toEqual({});
  });
});

describe("partitionFulfillment — Planned vs Performed's fulfilled/unfulfilled split", () => {
  it("treats an item with a linked treatment record as fulfilled", () => {
    const performedByItem = new Map([["item-1", [{ treatmentRecordId: "rec-1", performedAt: "2026-01-01" }]]]);
    const result = partitionFulfillment([{ id: "item-1", status: "accepted" }], performedByItem);
    expect(result.fulfilled).toEqual([{ id: "item-1", status: "accepted" }]);
    expect(result.unfulfilled).toEqual([]);
  });

  it("treats an item with zero linked treatment records as unfulfilled", () => {
    const result = partitionFulfillment([{ id: "item-1", status: "accepted" }], new Map());
    expect(result.fulfilled).toEqual([]);
    expect(result.unfulfilled).toEqual([{ id: "item-1", status: "accepted" }]);
  });

  it("excludes a rejected item from both buckets — it is not remaining work", () => {
    const result = partitionFulfillment([{ id: "item-1", status: "rejected" }], new Map());
    expect(result.fulfilled).toEqual([]);
    expect(result.unfulfilled).toEqual([]);
  });

  it("a rejected item with a linked record still counts as fulfilled — fulfillment is a fact, not a workflow judgment", () => {
    const performedByItem = new Map([["item-1", [{ treatmentRecordId: "rec-1", performedAt: "2026-01-01" }]]]);
    const result = partitionFulfillment([{ id: "item-1", status: "rejected" }], performedByItem);
    expect(result.fulfilled).toEqual([{ id: "item-1", status: "rejected" }]);
    expect(result.unfulfilled).toEqual([]);
  });

  it("handles a mixed set of items correctly", () => {
    const performedByItem = new Map([["item-1", [{ treatmentRecordId: "rec-1", performedAt: "2026-01-01" }]]]);
    const items = [
      { id: "item-1", status: "completed" },
      { id: "item-2", status: "accepted" },
      { id: "item-3", status: "rejected" },
    ];
    const result = partitionFulfillment(items, performedByItem);
    expect(result.fulfilled).toEqual([{ id: "item-1", status: "completed" }]);
    expect(result.unfulfilled).toEqual([{ id: "item-2", status: "accepted" }]);
  });
});

describe("averageDaysBetween — shared date-math (item time-to-decision, recall average days overdue)", () => {
  it("computes the average number of days across a single span", () => {
    expect(averageDaysBetween([{ from: "2026-01-01T00:00:00.000Z", to: "2026-01-04T00:00:00.000Z" }])).toBe(3);
  });

  it("averages across multiple spans", () => {
    const result = averageDaysBetween([
      { from: "2026-01-01T00:00:00.000Z", to: "2026-01-03T00:00:00.000Z" }, // 2 days
      { from: "2026-01-01T00:00:00.000Z", to: "2026-01-05T00:00:00.000Z" }, // 4 days
    ]);
    expect(result).toBe(3);
  });

  it("returns null for an empty input rather than NaN", () => {
    expect(averageDaysBetween([])).toBeNull();
  });
});

describe("computeCompletionRate — Recall Performance's completed/(completed+dismissed) rate", () => {
  it("computes the rate when both completed and dismissed recalls exist", () => {
    expect(computeCompletionRate(42, 18)).toBe(0.7);
  });

  it("returns 1 when every decided recall was completed", () => {
    expect(computeCompletionRate(10, 0)).toBe(1);
  });

  it("returns 0 when every decided recall was dismissed", () => {
    expect(computeCompletionRate(0, 10)).toBe(0);
  });

  it("returns null when nothing has been decided yet, rather than dividing by zero", () => {
    expect(computeCompletionRate(0, 0)).toBeNull();
  });
});
