import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  FileMinus,
  FilePlus,
  Pencil,
  PlusCircle,
  Receipt,
  Stethoscope,
  Trash2,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { STATUS_BADGE_VARIANT } from "@/components/appointments/todays-schedule";
import { formatCurrency } from "@/lib/billing/format";
import type { InvoiceListRow, PatientPaymentRow } from "@/lib/billing/queries";
import type { ScheduleRow } from "@/lib/appointments/queries";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type AuditLogEntry,
  type PatientMedicalAlert,
  type TreatmentRecord,
  type VisitType,
} from "@/types/domain";

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
  /** Reuses each entity's own existing status badge (InvoiceStatusBadge, appointments' STATUS_BADGE_VARIANT) rather than a new one per entry type. */
  badge?: ReactNode;
  /** Only set when the caller already knows the viewer can reach it — see the component doc comment. */
  link?: string;
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

/** Groups an already-sorted (newest/most-future first) entry list into reverse-chronological day/week/month buckets for scanability — pure display grouping, doesn't touch how the entries themselves were built or ordered. */
function periodLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (diffDays < 0) return "Upcoming";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) return "This month";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function groupByPeriod<T extends { date: string }>(entries: T[]): { label: string; entries: T[] }[] {
  const groups: { label: string; entries: T[] }[] = [];
  for (const entry of entries) {
    const label = periodLabel(entry.date);
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.entries.push(entry);
    } else {
      groups.push({ label, entries: [entry] });
    }
  }
  return groups;
}

/**
 * The unified patient history feed — audit trail, medical alerts,
 * treatments, appointments, invoices, and payments, merged into one
 * reverse-chronological list. Every optional prop below defaults to []
 * and is expected to already be permission-filtered by the caller (an
 * empty array when the viewer lacks the relevant permission) — this
 * component never checks permissions itself, same "gate the data, not the
 * component" split treatmentRecords already established. `link` is only
 * ever set on an entry when the caller already knows the viewer can reach
 * that destination (invoices are only passed in when canViewBilling is
 * true), so this component can render every `link` unconditionally without
 * its own authorization check.
 */
export function PatientTimeline({
  auditEntries,
  alerts,
  treatmentRecords = [],
  visitTypes = [],
  appointments = [],
  invoices = [],
  payments = [],
}: {
  auditEntries: AuditLogEntry[];
  alerts: PatientMedicalAlert[];
  treatmentRecords?: TreatmentRecord[];
  visitTypes?: VisitType[];
  appointments?: ScheduleRow[];
  invoices?: InvoiceListRow[];
  payments?: PatientPaymentRow[];
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
    ...treatmentRecords.map((record) => ({
      id: `treatment-${record.id}`,
      date: record.created_at,
      icon: Stethoscope,
      title: `Treatment recorded: ${visitTypes.find((v) => v.id === record.visit_type_id)?.name ?? "Procedure"}`,
      tone: "default" as const,
    })),
    ...appointments.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      date: appointment.scheduled_start,
      icon: CalendarDays,
      title: `Appointment: ${appointment.visit_type_name} with Dr. ${appointment.doctor_name}`,
      tone: "default" as const,
      badge: (
        <Badge variant={STATUS_BADGE_VARIANT[appointment.status as AppointmentStatus]}>
          {APPOINTMENT_STATUS_LABELS[appointment.status as AppointmentStatus]}
        </Badge>
      ),
    })),
    ...invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      date: invoice.issued_date,
      icon: Receipt,
      title: `Invoice ${invoice.invoice_number} issued — ${formatCurrency(invoice.total)}`,
      tone: "default" as const,
      badge: <InvoiceStatusBadge status={invoice.status} />,
      link: `/billing/invoices/${invoice.id}`,
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      date: payment.paid_at,
      icon: Wallet,
      title: `Payment received: ${formatCurrency(Number(payment.amount))} (${payment.invoice_number})`,
      tone: "default" as const,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (entries.length === 0) {
    return (
      <EmptyState title={"No activity recorded for this patient yet."} />
    );
  }

  const groups = groupByPeriod(entries);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className={cn(typography.eyebrow, "mb-3")}>{group.label}</p>
          <ol className="relative space-y-0 border-l border-border pl-6">
            {group.entries.map((entry) => {
              const Icon = entry.icon;
              const content = (
                <div className="flex flex-col gap-0.5 pt-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium">{entry.title}</p>
                    {entry.badge}
                  </div>
                  <p className="text-xs text-muted-foreground" title={formatTimestamp(entry.date)}>
                    {formatRelative(entry.date)}
                  </p>
                </div>
              );

              return (
                <li key={entry.id} className="relative pb-5 last:pb-0">
                  <span
                    className={`absolute -left-[calc(1.5rem+5px)] flex size-6 items-center justify-center rounded-full ring-4 ring-background ${
                      entry.tone === "destructive"
                        ? "bg-destructive/10 text-destructive"
                        : entry.tone === "warning"
                          ? "bg-warning/15 text-warning-text"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  {entry.link ? (
                    <Link href={entry.link} className="-m-1 block rounded-lg p-1 transition-colors hover:bg-muted/50">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
