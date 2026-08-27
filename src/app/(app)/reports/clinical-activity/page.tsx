import { Stethoscope } from "lucide-react";
import { BackLink } from "@/components/layout/back-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { DoctorFilterSelect } from "@/components/reports/doctor-filter-select";
import { getCompletedAppointmentsByDoctor, getProcedureActivitySummary } from "@/lib/reports/clinical-queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { listVisitTypes } from "@/lib/appointments/queries";
import { listDoctors } from "@/lib/patients/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Procedure Activity + Clinical Workload — both read treatment_records
 * directly (never joined through appointments, since one appointment can
 * carry zero, one, or many records) and are strictly count-based. No
 * revenue/production/collections figure appears anywhere on this page —
 * that's Reports > Doctors / Procedures, which stay billing-derived and
 * untouched by this phase.
 */
export default async function ClinicalActivityReportPage({
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

  const [procedureActivity, completedAppointments, visitTypes, doctors] = await Promise.all([
    getProcedureActivitySummary(range, doctorId || undefined),
    getCompletedAppointmentsByDoctor(range, doctorId || undefined),
    listVisitTypes(),
    listDoctors(),
  ]);

  function doctorName(id: string | null): string {
    if (!id) return "Unattributed";
    const doctor = doctors.find((d) => d.id === id);
    return doctor ? `Dr. ${doctor.full_name}` : "—";
  }

  const procedureRows = procedureActivity.byProcedure
    .map((row) => ({
      ...row,
      name: row.visitTypeId ? (visitTypes.find((v) => v.id === row.visitTypeId)?.name ?? "—") : "Custom procedure",
    }))
    .sort((a, b) => b.count - a.count);

  const workloadRows = procedureActivity.byDoctor
    .map((row) => ({ ...row, name: doctorName(row.doctorId) }))
    .sort((a, b) => b.count - a.count);

  const completedAppointmentRows = completedAppointments
    .map((row) => ({ ...row, name: doctorName(row.doctorId) }))
    .sort((a, b) => b.count - a.count);

  const filterValue = { from: range.start, to: range.end, doctor: doctorId || undefined };

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/reports" label="Reports" />
        <h1 className={cn("mt-1", typography.pageTitle)}>Clinical Activity</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          What was clinically performed, by procedure and by doctor — counted directly from treatment records, not
          billing. Counts only; for revenue or collections, see Reports &gt; Procedures / Doctors instead.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <ReportDateRangeFilter basePath="/reports/clinical-activity" value={range} />
        <DoctorFilterSelect basePath="/reports/clinical-activity" value={filterValue} doctors={doctors} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Procedure Activity</h2>
        <div className="mb-4 max-w-xs">
          <StatCard label="Procedures performed" value={procedureActivity.totalCount} icon={Stethoscope} />
        </div>

        {procedureActivity.totalCount === 0 ? (
          <EmptyState title="No treatment recorded in this period." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Most-performed procedures</p>
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Procedure</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {procedureRows.map((row) => (
                      <TableRow key={row.visitTypeId ?? "custom"}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">By doctor</p>
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead className="text-right">Procedures</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workloadRows.map((row) => (
                      <TableRow key={row.doctorId ?? "unattributed"}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Clinical Workload</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Activity counts only — for production, collections, or compensation, see Reports &gt; Doctors /
          Compensation instead.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Treatment records performed per doctor</p>
            {workloadRows.length === 0 ? (
              <EmptyState title="No treatment recorded in this period." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead className="text-right">Treatment records</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workloadRows.map((row) => (
                      <TableRow key={row.doctorId ?? "unattributed"}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Completed appointments per doctor</p>
            {completedAppointmentRows.length === 0 ? (
              <EmptyState title="No completed appointments in this period." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead className="text-right">Completed appointments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedAppointmentRows.map((row) => (
                      <TableRow key={row.doctorId ?? "unattributed"}>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
