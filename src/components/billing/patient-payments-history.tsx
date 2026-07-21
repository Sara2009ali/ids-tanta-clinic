import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/billing/format";
import type { PatientPaymentRow } from "@/lib/billing/queries";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS, type PaymentMethod, type PaymentType } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Read-only across every invoice this patient has — unlike PaymentsHistory
 * (invoice-detail page), there's no single invoiceId to scope a Void action
 * to here, so no actions column. Corrections happen from the linked invoice.
 */
export function PatientPaymentsHistory({ payments }: { payments: PatientPaymentRow[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState title={"No payments recorded yet."} />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-medium">
                <Link href={`/billing/invoices/${payment.invoice_id}`} className="hover:underline">
                  {payment.invoice_number}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={payment.type === "refund" ? "destructive" : "secondary"}>
                  {PAYMENT_TYPE_LABELS[payment.type as PaymentType]}
                </Badge>
              </TableCell>
              <TableCell>{PAYMENT_METHOD_LABELS[payment.method as PaymentMethod]}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(Number(payment.amount))}</TableCell>
              <TableCell className="text-muted-foreground">{formatTimestamp(payment.paid_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
