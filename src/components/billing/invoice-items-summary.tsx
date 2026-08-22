import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/billing/format";
import { aggregateInvoiceInsurance } from "@/lib/insurance/calculations";
import type { InvoiceItem } from "@/types/domain";

export function InvoiceItemsSummary({
  items,
  subtotal,
  taxPercent,
  taxAmount,
  total,
}: {
  items: InvoiceItem[];
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
}) {
  // Reads only what was actually stored on each invoice_items row at
  // creation time — never re-resolves the patient's *current* insurance —
  // so this stays correct even if the patient's plan or coverage has since
  // changed (see 0033_insurance_billing.sql's header).
  const insuranceTotals = aggregateInvoiceInsurance(items);
  // Every line on one invoice always shares the same patient/plan, so this
  // is the coverage percent, not a computed average — just reading it off
  // whichever line happens to carry it.
  const coveragePercent = items.find((item) => item.insurance_coverage_percent != null)?.insurance_coverage_percent;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead className="text-right">Line Total</TableHead>
              {insuranceTotals.applied && <TableHead className="text-right">Insurance</TableHead>}
              {insuranceTotals.applied && <TableHead className="text-right">Patient Owes</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(item.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(Number(item.unit_price))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(Number(item.discount_amount))}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(Number(item.line_total))}
                </TableCell>
                {insuranceTotals.applied && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.insurance_coverage_percent != null ? `${Number(item.insurance_coverage_percent)}%` : "—"}
                  </TableCell>
                )}
                {insuranceTotals.applied && (
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(item.patient_responsibility))}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="ms-auto max-w-xs space-y-1 rounded-xl bg-muted p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        {insuranceTotals.applied && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Insurance ({Number(coveragePercent ?? 0)}%)</span>
            <span className="tabular-nums">−{formatCurrency(insuranceTotals.insuranceTotal)}</span>
          </div>
        )}
        {insuranceTotals.applied && (
          <div className="flex justify-between font-medium">
            <span>
              Patient responsibility
              {Number(taxPercent) > 0 && <span className="text-muted-foreground"> (before tax)</span>}
            </span>
            <span className="tabular-nums">{formatCurrency(insuranceTotals.patientResponsibilityTotal)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax ({Number(taxPercent)}%)</span>
          <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
