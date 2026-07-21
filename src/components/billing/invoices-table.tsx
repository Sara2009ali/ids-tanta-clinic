import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { formatCurrency } from "@/lib/billing/format";
import type { InvoiceListRow } from "@/lib/billing/queries";
import { EmptyState } from "@/components/ui/empty-state";

export function InvoicesTable({ rows, hasFilters }: { rows: InvoiceListRow[]; hasFilters: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState title={hasFilters ? "No invoices match these filters." : "No invoices yet."} />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Balance Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
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
