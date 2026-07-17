import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/billing/format";
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="ml-auto max-w-xs space-y-1 rounded-xl bg-muted p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax ({Number(taxPercent)}%)</span>
          <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
