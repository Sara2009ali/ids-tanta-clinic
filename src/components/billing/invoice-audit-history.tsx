import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogEntry } from "@/types/domain";

const ACTION_LABELS: Record<string, string> = {
  "invoice.created": "Invoice created",
  "invoice.updated": "Invoice edited",
  "invoice.issued": "Invoice issued",
  "invoice.cancelled": "Invoice cancelled",
  "invoice.deleted": "Invoice deleted",
  "payment.recorded": "Payment recorded",
  "payment.voided": "Payment voided",
  "payment.refunded": "Refund issued",
};

function humanizeAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeChanges(changes: AuditLogEntry["changes"]): string {
  if (!changes || typeof changes !== "object") return "—";
  const entries = Object.entries(changes as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}

export function InvoiceAuditHistory({ auditEntries }: { auditEntries: AuditLogEntry[] }) {
  if (auditEntries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        No audit history recorded for this invoice yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditEntries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{humanizeAction(entry.action)}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground" title={summarizeChanges(entry.changes)}>
                {summarizeChanges(entry.changes)}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatTimestamp(entry.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
