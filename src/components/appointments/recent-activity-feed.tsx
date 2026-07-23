import { Activity } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/types/domain";
import type { RecentActivityRow } from "@/lib/appointments/queries";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: "bg-muted-foreground/40",
  confirmed: "bg-muted-foreground/40",
  checked_in: "bg-primary",
  waiting: "bg-primary",
  in_treatment: "bg-primary",
  completed: "bg-success",
  cancelled: "bg-destructive/70",
  no_show: "bg-destructive/70",
};

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
    return (
      <EmptyState
        icon={Activity}
        title="No recent activity"
        description="Appointment status changes will show up here as they happen."
        className="border-none py-8"
      />
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((row, index) => (
        <li key={row.id} className="relative flex gap-3 text-sm">
          {index < rows.length - 1 && (
            <span aria-hidden="true" className="absolute top-3.5 left-[3px] h-[calc(100%+0.5rem)] w-px bg-border" />
          )}
          <span
            aria-hidden="true"
            className={cn("mt-1.5 size-[7px] shrink-0 rounded-full ring-4 ring-background", STATUS_DOT[row.to_status])}
          />
          <div className="min-w-0 flex-1">
            <p className="min-w-0">
              <span className="font-medium">{row.patient_name}</span>
              <span className="text-muted-foreground">
                {" "}
                {row.from_status ? APPOINTMENT_STATUS_LABELS[row.from_status] : "Created"} →{" "}
                {APPOINTMENT_STATUS_LABELS[row.to_status]}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{formatRelative(row.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
