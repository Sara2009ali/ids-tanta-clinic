import { CalendarClock, CheckCircle2, CircleSlash, Clock, RotateCcw, TriangleAlert } from "lucide-react";
import { BackLink } from "@/components/layout/back-link";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { DoctorFilterSelect } from "@/components/reports/doctor-filter-select";
import { getRecallPerformanceSummary } from "@/lib/reports/clinical-queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { listDoctors } from "@/lib/patients/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDays(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)} day${value === 1 ? "" : "s"}`;
}

/**
 * Recall Performance — status is always read from recalls.status directly,
 * never derived from a linked appointment's status (the two are
 * independent by design). Overdue/average-days-overdue are always "as of
 * today," regardless of the selected date range — the same "as of now, not
 * as of range-end" rule the module's own UI (RecallStatusBadge) already
 * follows. No notification-delivery metric appears here — v1 Recalls has
 * no notification integration to measure.
 */
export default async function RecallsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.CLINICAL_VIEW]);

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = {
    start: firstParam(sp.from) || defaults.start,
    end: firstParam(sp.to) || defaults.end,
  };
  const doctorId = firstParam(sp.doctor) ?? "";

  const [summary, doctors] = await Promise.all([
    getRecallPerformanceSummary(range, doctorId || undefined),
    listDoctors(),
  ]);

  const filterValue = { from: range.start, to: range.end, doctor: doctorId || undefined };
  const decidedCount = summary.completedCount + summary.dismissedCount;

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/reports" label="Reports" />
        <h1 className={cn("mt-1", typography.pageTitle)}>Recalls</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Due/scheduled/completed/dismissed reflect current recall status for recalls created or decided within the
          selected period. Overdue and average days overdue are always as of today, independent of the date range —
          a recall&apos;s status is never inferred from a linked appointment&apos;s status.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <ReportDateRangeFilter basePath="/reports/recalls" value={range} />
        <DoctorFilterSelect basePath="/reports/recalls" value={filterValue} doctors={doctors} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Status (this period)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Due" value={summary.statusCounts.due ?? 0} icon={Clock} />
          <StatCard label="Scheduled" value={summary.statusCounts.scheduled ?? 0} icon={CalendarClock} />
          <StatCard label="Completed" value={summary.completedCount} icon={CheckCircle2} />
          <StatCard label="Dismissed" value={summary.dismissedCount} icon={CircleSlash} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Overdue (as of today)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Currently overdue" value={summary.overdueCount} icon={TriangleAlert} />
          <StatCard
            label="Avg. days overdue"
            value={formatDays(summary.averageDaysOverdue)}
            icon={RotateCcw}
            hint="Average across currently-overdue recalls only"
          />
          <StatCard
            label="Completion rate"
            value={summary.completionRate !== null ? `${Math.round(summary.completionRate * 100)}%` : "—"}
            icon={CheckCircle2}
            hint={
              decidedCount > 0
                ? `${summary.completedCount} of ${decidedCount} decided recalls completed`
                : "No recalls decided in this period"
            }
          />
        </div>
      </div>
    </div>
  );
}
