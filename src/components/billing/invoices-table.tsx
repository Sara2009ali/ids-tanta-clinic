"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { formatCurrency } from "@/lib/billing/format";
import type { InvoiceListRow } from "@/lib/billing/queries";

type SortColumn = "invoice_number" | "patient_name" | "issued_date" | "total" | "balance_due";
type SortDirection = "asc" | "desc";

/**
 * Sorting here is purely client-side over the current page's already-fetched
 * rows — this list is server-paginated (searchInvoices), so sorting only
 * reorders what's already on screen rather than issuing a new query. Kept
 * presentation-only per the "don't touch queries" constraint; a true
 * cross-page sort would need a DAL change, which is out of scope here.
 */
function SortableHead({
  label,
  column,
  sort,
  onSort,
  align,
}: {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  align?: "right";
}) {
  const isActive = sort.column === column;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${isActive ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
        {isActive ? (
          sort.direction === "asc" ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}

export function InvoicesTable({ rows, hasFilters }: { rows: InvoiceListRow[]; hasFilters: boolean }) {
  const [sort, setSort] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: "issued_date",
    direction: "desc",
  });

  const sortedRows = useMemo(() => {
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.column];
      const bv = b[sort.column];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort]);

  function handleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  if (rows.length === 0) {
    return hasFilters ? (
      <EmptyState
        title="No invoices match these filters"
        description="Try a different date range or status to see more results."
      />
    ) : (
      <EmptyState
        illustration="documents"
        title="No invoices yet"
        description="Create an invoice from a patient's profile or an appointment, and it will show up here with its full payment history."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead label="Invoice #" column="invoice_number" sort={sort} onSort={handleSort} />
            <SortableHead label="Patient" column="patient_name" sort={sort} onSort={handleSort} />
            <SortableHead label="Date" column="issued_date" sort={sort} onSort={handleSort} />
            <TableHead>Status</TableHead>
            <SortableHead label="Total" column="total" sort={sort} onSort={handleSort} align="right" />
            <SortableHead label="Balance Due" column="balance_due" sort={sort} onSort={handleSort} align="right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">
                <Link href={`/billing/invoices/${row.id}`} className="hover:underline">
                  {row.invoice_number}
                </Link>
              </TableCell>
              <TableCell>{row.patient_name}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(row.issued_date).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={row.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.total)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.balance_due)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
