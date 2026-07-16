import { APPOINTMENT_STATUS_LABELS } from "@/types/domain";
import type { RecentActivityRow } from "@/lib/appointments/queries";

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function RecentActivityFeed({ rows }: { rows: RecentActivityRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-3 text-sm">
          <p className="min-w-0 flex-1">
            <span className="font-medium">{row.patient_name}</span>
            {": "}
            <span className="text-muted-foreground">
              {row.from_status ? APPOINTMENT_STATUS_LABELS[row.from_status] : "Created"} →{" "}
              {APPOINTMENT_STATUS_LABELS[row.to_status]}
            </span>
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(row.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
