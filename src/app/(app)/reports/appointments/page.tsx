import Link from "next/link";
import { ArrowLeft, CalendarDays, UserX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { CategoryBarChart } from "@/components/reports/category-bar-chart";
import { getCancellationHistory, getCancellationStats } from "@/lib/reports/queries";
import { getScheduleForRange } from "@/lib/appointments/queries";
import { rangeToTimestampBounds, defaultReportRange } from "@/lib/reports/date-range";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { APPOINTMENT_STATUS_LABELS, type AppointmentStatus } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function AppointmentsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.APPOINTMENTS_VIEW]);

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = {
    start: firstParam(sp.from) || defaults.start,
    end: firstParam(sp.to) || defaults.end,
  };
  const { startIso, endIsoExclusive } = rangeToTimestampBounds(range);

  const [schedule, cancellationStats, cancellationHistory] = await Promise.all([
    getScheduleForRange(startIso, endIsoExclusive),
    getCancellationStats(range),
    getCancellationHistory(range),
  ]);

  const cancellationRate =
    cancellationStats.totalCount > 0
      ? Math.round(((cancellationStats.cancelledCount + cancellationStats.noShowCount) / cancellationStats.totalCount) * 100)
      : 0;

  const countsByStatus = new Map<AppointmentStatus, number>();
  for (const row of schedule) {
    const status = row.status as AppointmentStatus;
    countsByStatus.set(status, (countsByStatus.get(status) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>Appointments</h1>
        <p className="text-sm text-muted-foreground">Volume, cancellations, and no-shows.</p>
      </div>

      <ReportDateRangeFilter basePath="/reports/appointments" value={range} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Appointments" value={schedule.length} icon={CalendarDays} />
        <StatCard label="Cancelled" value={cancellationStats.cancelledCount} icon={XCircle} />
        <StatCard label="No-shows" value={cancellationStats.noShowCount} icon={UserX} hint={`${cancellationRate}% of appointments`} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">By status</h2>
        {schedule.length === 0 ? (
          <EmptyState title={"No appointments in this period."} />
        ) : (
          <div className="space-y-4">
            <CategoryBarChart
              data={(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[])
                .filter((status) => (countsByStatus.get(status) ?? 0) > 0)
                .map((status) => ({ label: APPOINTMENT_STATUS_LABELS[status], value: countsByStatus.get(status) ?? 0 }))}
            />
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[])
                    .filter((status) => (countsByStatus.get(status) ?? 0) > 0)
                    .map((status) => (
                      <TableRow key={status}>
                        <TableCell>{APPOINTMENT_STATUS_LABELS[status]}</TableCell>
                        <TableCell className="text-right tabular-nums">{countsByStatus.get(status) ?? 0}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Cancellations &amp; no-shows</h2>
        {cancellationHistory.length === 0 ? (
          <EmptyState title={"No cancellations or no-shows in this period."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cancellationHistory.map((row, i) => (
                  <TableRow key={`${row.appointmentId}-${i}`}>
                    <TableCell className="text-muted-foreground">{formatDateTime(row.changedAt)}</TableCell>
                    <TableCell>{row.toStatus === "no_show" ? "No-show" : "Cancelled"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
