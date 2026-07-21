import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { INVENTORY_MOVEMENT_TYPE_LABELS, type InventoryMovementType } from "@/types/domain";
import type { MovementForHistory } from "@/lib/inventory/queries";
import { EmptyState } from "@/components/ui/empty-state";

// receive is a gain (secondary/positive), consumption/expiration are a
// loss (outline/destructive), adjustment can go either way so it stays
// neutral — same "badge communicates direction, not just a label" instinct
// CompensationEntryType's own badges already use for earning/reversal.
const MOVEMENT_TYPE_VARIANT: Record<InventoryMovementType, "default" | "secondary" | "outline" | "destructive"> = {
  receive: "secondary",
  consumption: "outline",
  adjustment: "default",
  expiration: "destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MovementsTable({
  movements,
  emptyMessage = "No stock movements recorded yet.",
  showProductLink = true,
}: {
  movements: MovementForHistory[];
  emptyMessage?: string;
  /** Off on the product detail page's own history tab, where the product is already the whole context — on everywhere else (clinic-wide ledger, dashboard). */
  showProductLink?: boolean;
}) {
  if (movements.length === 0) {
    return (
      <EmptyState title={emptyMessage} />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            {showProductLink && <TableHead>Product</TableHead>}
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => {
            const type = movement.movement_type as InventoryMovementType;
            const quantity = Number(movement.quantity);
            return (
              <TableRow key={movement.id}>
                <TableCell className="text-muted-foreground">{formatDate(movement.created_at)}</TableCell>
                {showProductLink && (
                  <TableCell>
                    <Link href={`/inventory/products/${movement.product_id}`} className="hover:underline">
                      {movement.product_name}
                    </Link>
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={MOVEMENT_TYPE_VARIANT[type]}>{INVENTORY_MOVEMENT_TYPE_LABELS[type]}</Badge>
                </TableCell>
                <TableCell className={`text-right tabular-nums ${quantity < 0 ? "text-destructive" : ""}`}>
                  {quantity > 0 ? "+" : ""}
                  {quantity}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground" title={movement.notes ?? undefined}>
                  {movement.notes ?? "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
