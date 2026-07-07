import {
  Archive,
  ArchiveRestore,
  FileMinus,
  FilePlus,
  Pencil,
  PlusCircle,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { AuditLogEntry, PatientMedicalAlert } from "@/types/domain";

/** Human-readable label for an audit_log `action` string. Falls back to the raw value. */
export function humanizeAuditAction(action: string): string {
  const labels: Record<string, string> = {
    "patient.created": "Patient record created",
    "patient.updated": "Patient details updated",
    "patient.archived": "Patient archived",
    "patient.restored": "Patient restored",
    "patient.deleted": "Patient deleted",
    "patient.file_uploaded": "File uploaded",
    "patient.file_deleted": "File removed",
  };
  return labels[action] ?? action;
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  "patient.created": PlusCircle,
  "patient.updated": Pencil,
  "patient.archived": Archive,
  "patient.restored": ArchiveRestore,
  "patient.deleted": Trash2,
  "patient.file_uploaded": FilePlus,
  "patient.file_deleted": FileMinus,
};

interface TimelineEntry {
  id: string;
  date: string;
  icon: LucideIcon;
  title: string;
  tone?: "default" | "destructive" | "warning";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return formatTimestamp(iso);
}

export function PatientTimeline({
  auditEntries,
  alerts,
}: {
  auditEntries: AuditLogEntry[];
  alerts: PatientMedicalAlert[];
}) {
  const entries: TimelineEntry[] = [
    ...auditEntries.map((entry) => ({
      id: `audit-${entry.id}`,
      date: entry.created_at,
      icon: ACTION_ICONS[entry.action] ?? Pencil,
      title: humanizeAuditAction(entry.action),
      tone:
        entry.action === "patient.deleted"
          ? ("destructive" as const)
          : entry.action === "patient.archived"
            ? ("warning" as const)
            : ("default" as const),
    })),
    ...alerts.map((alert) => ({
      id: `alert-${alert.id}`,
      date: alert.created_at,
      icon: TriangleAlert,
      title: `Medical alert added: ${alert.label}`,
      tone: alert.severity === "critical" ? ("destructive" as const) : ("warning" as const),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        No activity recorded for this patient yet.
      </div>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-border pl-6">
      {entries.map((entry) => {
        const Icon = entry.icon;
        return (
          <li key={entry.id} className="relative pb-6 last:pb-0">
            <span
              className={`absolute -left-[calc(1.5rem+5px)] flex size-6 items-center justify-center rounded-full ring-4 ring-background ${
                entry.tone === "destructive"
                  ? "bg-destructive/10 text-destructive"
                  : entry.tone === "warning"
                    ? "bg-warning/15 text-amber-700 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex flex-col gap-0.5 pt-0.5">
              <p className="text-sm font-medium">{entry.title}</p>
              <p className="text-xs text-muted-foreground" title={formatTimestamp(entry.date)}>
                {formatRelative(entry.date)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
