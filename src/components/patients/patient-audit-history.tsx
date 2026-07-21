import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogEntry } from "@/types/domain";
import { humanizeAuditAction } from "@/components/patients/patient-timeline";
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

function summarizeChanges(changes: AuditLogEntry["changes"]): string {
  if (!changes || typeof changes !== "object") return "—";
  const entries = Object.entries(changes as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
}

export function PatientAuditHistory({ auditEntries }: { auditEntries: AuditLogEntry[] }) {
  if (auditEntries.length === 0) {
    return (
      <EmptyState title={"No audit history recorded for this patient yet."} />
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
              <TableCell className="font-medium">{humanizeAuditAction(entry.action)}</TableCell>
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
