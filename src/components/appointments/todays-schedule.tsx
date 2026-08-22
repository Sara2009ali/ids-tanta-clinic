import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/types/domain";
import type { ScheduleRow } from "@/lib/appointments/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { cardHoverLift } from "@/lib/interactive-styles";
import { cn } from "@/lib/utils";

/** Exported so other appointment-status displays (e.g. PatientTimeline) use the exact same colors instead of re-declaring this map. */
export const STATUS_BADGE_VARIANT: Record<
  AppointmentStatus,
  "default" | "secondary" | "outline" | "destructive" | "success"
> = {
  scheduled: "outline",
  confirmed: "secondary",
  checked_in: "secondary",
  waiting: "default",
  in_treatment: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "destructive",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TodaysSchedule({
  rows,
  emptyMessage = "No appointments scheduled for today.",
  doctorPrefix = "Dr.",
  emergencyLabel = "Emergency",
  urgentLabel = "Urgent",
  highPriorityLabel = "High priority",
  renderActions,
}: {
  rows: ScheduleRow[];
  emptyMessage?: string;
  /** All four default to English — pass the translated labels from a localized caller (Reception Workspace, Appointments day view). */
  doctorPrefix?: string;
  emergencyLabel?: string;
  urgentLabel?: string;
  highPriorityLabel?: string;
  /** Optional per-row actions slot (Reception Workspace, Appointments day view). Omitted everywhere else — same look as before. The whole row is a link to the patient's profile when this is absent; when present, only the patient's name links there instead, since a Link can't safely wrap the interactive buttons this slot renders. */
  renderActions?: (row: ScheduleRow) => ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title={emptyMessage} />
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const content = (
          <>
            <div
              className="h-11 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: row.visit_type_color }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {renderActions ? (
                  // The outer row is a plain div (not a Link) whenever actions
                  // are rendered — a Link can't safely wrap the interactive
                  // buttons that slot contains, so the name itself becomes
                  // the click-through-to-patient affordance instead, same
                  // destination as the whole-row Link used everywhere else.
                  <Link href={`/patients/${row.patient_id}`} className="truncate text-sm font-medium hover:underline">
                    {row.patient_name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-medium">{row.patient_name}</p>
                )}
                {row.is_emergency && <Badge variant="destructive">{emergencyLabel}</Badge>}
                {!row.is_emergency && row.priority === "urgent" && <Badge variant="destructive">{urgentLabel}</Badge>}
                {!row.is_emergency && row.priority === "high" && <Badge variant="outline">{highPriorityLabel}</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {doctorPrefix} {row.doctor_name} · {row.visit_type_name}
                {row.chair_label ? ` · ${row.chair_label}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm tabular-nums text-foreground">
                {formatTime(row.scheduled_start)}–{formatTime(row.scheduled_end)}
              </span>
              <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{APPOINTMENT_STATUS_LABELS[row.status]}</Badge>
            </div>
            {renderActions && <div className="shrink-0">{renderActions(row)}</div>}
          </>
        );

        const rowClassName = "flex items-center gap-3.5 rounded-xl bg-card p-4 ring-1 ring-foreground/10 shadow-elevation-low";

        if (renderActions) {
          return (
            <div key={row.id} className={rowClassName}>
              {content}
            </div>
          );
        }

        return (
          <Link
            key={row.id}
            href={`/patients/${row.patient_id}`}
            className={cn(rowClassName, cardHoverLift)}
          >
            {content}
          </Link>
        );
      })}
    </div>
  );
}
