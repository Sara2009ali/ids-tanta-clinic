/**
 * Pure reports math — no I/O, deliberately kept out of queries.ts (which
 * has `import "server-only"` for its real Supabase calls, and that guard
 * throws if the module is ever imported into a test file). Mirrors this
 * exact billing/calculations.ts <-> billing/actions.ts and
 * compensation/calculations.ts <-> compensation/queries.ts split already
 * established in this codebase, for the same reason.
 */

export interface ProcedureAmount {
  visitTypeId: string | null;
  revenue: number;
  /** Count of billed line items for this procedure in range (how many times it was actually charged), not invoices it appeared on — the meaningful volume figure now that one invoice can carry more than one procedure. */
  appointmentCount: number;
}

export interface InvoiceItemProcedureRow {
  visitTypeId: string | null;
  lineTotal: number;
}

/**
 * Groups billed line items by procedure — every custom (non-catalog) item
 * (visitTypeId null) collapses into one combined group, the same
 * NULL-collation grouping sync_doctor_compensation() uses (see
 * compensation/calculations.ts's groupInvoiceLinesByVisitType(), which this
 * mirrors exactly). Multiple items for the same procedure sum together
 * rather than producing duplicate rows.
 */
export function aggregateProcedureRevenue(rows: readonly InvoiceItemProcedureRow[]): ProcedureAmount[] {
  const totals = new Map<string | null, { revenue: number; appointmentCount: number }>();
  for (const row of rows) {
    const existing = totals.get(row.visitTypeId) ?? { revenue: 0, appointmentCount: 0 };
    existing.revenue += row.lineTotal;
    existing.appointmentCount += 1;
    totals.set(row.visitTypeId, existing);
  }
  return Array.from(totals.entries()).map(([visitTypeId, v]) => ({ visitTypeId, ...v }));
}
