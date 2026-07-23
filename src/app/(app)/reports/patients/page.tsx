import Link from "next/link";
import { ArrowLeft, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { getPatientGrowth, getPatientRetentionSummary } from "@/lib/reports/queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString();
}

export default async function PatientsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.PATIENTS_VIEW]);

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = {
    start: firstParam(sp.from) || defaults.start,
    end: firstParam(sp.to) || defaults.end,
  };

  const [growth, retention] = await Promise.all([getPatientGrowth(range), getPatientRetentionSummary(range)]);

  const totalNew = growth.reduce((sum, point) => sum + point.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>Patients</h1>
        <p className="text-sm text-muted-foreground">Growth, new vs. returning.</p>
      </div>

      <ReportDateRangeFilter basePath="/reports/patients" value={range} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="New patients" value={totalNew} icon={UserPlus} />
        <StatCard label="Seen this period" value={retention.newCount + retention.returningCount} icon={Users} />
        <StatCard label="Returning" value={retention.returningCount} icon={Users} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">New patients by day</h2>
        {growth.length === 0 ? (
          <EmptyState title={"No new patients registered in this period."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">New patients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {growth.map((point) => (
                  <TableRow key={point.day}>
                    <TableCell>{formatDay(point.day)}</TableCell>
                    <TableCell className="text-right tabular-nums">{point.count}</TableCell>
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
