import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogEntry } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";

const ACTION_LABELS: Record<string, string> = {
  "compensation.rule_set": "Rate set",
  "compensation.rule_closed": "Rate closed",
  "compensation.settlement_run": "Settlement run",
  "compensation.entry_resolved": "Entry resolved",
  "compensation.rule_missing": "Missing rate detected",
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

export function CompensationAuditHistory({ auditEntries }: { auditEntries: AuditLogEntry[] }) {
  if (auditEntries.length === 0) {
    return (
      <EmptyState title={"No compensation activity recorded yet."} />
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
