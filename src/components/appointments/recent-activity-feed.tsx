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

export interface RecentActivityDict {
  emptyTitle: string;
  emptyDescription: string;
  created: string;
  justNow: string;
  minuteAgo: string;
  minutesAgo: string;
  hourAgo: string;
  hoursAgo: string;
  dayAgo: string;
  daysAgo: string;
}

/** English fallback for callers outside the localized Reception Workspace (currently just the Dashboard). */
const DEFAULT_DICT: RecentActivityDict = {
  emptyTitle: "No recent activity",
  emptyDescription: "Appointment status changes will show up here as they happen.",
  created: "Created",
  justNow: "just now",
  minuteAgo: "1 min ago",
  minutesAgo: "{count} mins ago",
  hourAgo: "1 hour ago",
  hoursAgo: "{count} hours ago",
  dayAgo: "1 day ago",
  daysAgo: "{count} days ago",
};

function formatRelative(iso: string, dict: RecentActivityDict): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return dict.justNow;
  if (diffMin < 60) return (diffMin === 1 ? dict.minuteAgo : dict.minutesAgo).replace("{count}", String(diffMin));
  if (diffHour < 24) return (diffHour === 1 ? dict.hourAgo : dict.hoursAgo).replace("{count}", String(diffHour));
  return (diffDay === 1 ? dict.dayAgo : dict.daysAgo).replace("{count}", String(diffDay));
}

export function RecentActivityFeed({ rows, dict = DEFAULT_DICT }: { rows: RecentActivityRow[]; dict?: RecentActivityDict }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={dict.emptyTitle}
        description={dict.emptyDescription}
        className="border-none py-8"
      />
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((row, index) => (
        <li key={row.id} className="relative flex gap-3 text-sm">
          {index < rows.length - 1 && (
            <span aria-hidden="true" className="absolute top-3.5 start-[3px] h-[calc(100%+0.5rem)] w-px bg-border" />
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
                {row.from_status ? APPOINTMENT_STATUS_LABELS[row.from_status] : dict.created} →{" "}
                {APPOINTMENT_STATUS_LABELS[row.to_status]}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{formatRelative(row.created_at, dict)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
