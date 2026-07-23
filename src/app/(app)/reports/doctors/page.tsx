import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { formatCurrency } from "@/lib/billing/format";
import { getDoctorCollections, getDoctorProduction, type DoctorAmount } from "@/lib/reports/queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { listDoctors } from "@/lib/patients/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface DoctorRow {
  doctorId: string | null;
  name: string;
  production: number;
  collections: number;
}

function mergeByDoctor(production: DoctorAmount[], collections: DoctorAmount[]): Map<string | null, { production: number; collections: number }> {
  const merged = new Map<string | null, { production: number; collections: number }>();
  for (const row of production) {
    merged.set(row.doctorId, { production: row.total, collections: merged.get(row.doctorId)?.collections ?? 0 });
  }
  for (const row of collections) {
    merged.set(row.doctorId, { production: merged.get(row.doctorId)?.production ?? 0, collections: row.total });
  }
  return merged;
}

export default async function DoctorsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.BILLING_VIEW]);
  const permissions = await getCurrentPermissions();
  // Doctor rows would otherwise link to /compensation/doctors/[id], which
  // separately requires compensation.view — billing.view alone (e.g.
  // reception_manager, viewer) doesn't guarantee that, so the link is only
  // rendered when it will actually resolve, not left to dead-end.
  const canViewDoctorDetail = hasPermission(permissions, PERMISSIONS.COMPENSATION_VIEW);

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = {
    start: firstParam(sp.from) || defaults.start,
    end: firstParam(sp.to) || defaults.end,
  };

  const [production, collections, doctors] = await Promise.all([
    getDoctorProduction(range),
    getDoctorCollections(range),
    listDoctors(),
  ]);

  const merged = mergeByDoctor(production, collections);
  const rows: DoctorRow[] = Array.from(merged.entries())
    .map(([doctorId, amounts]) => ({
      doctorId,
      name: doctorId ? `Dr. ${doctors.find((d) => d.id === doctorId)?.full_name ?? "—"}` : "Unattributed",
      production: amounts.production,
      collections: amounts.collections,
    }))
    .sort((a, b) => b.production - a.production);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>Doctors</h1>
        <p className="text-sm text-muted-foreground">
          Production and collections by doctor, ranked highest first. &quot;Unattributed&quot; covers invoices with no
          linked appointment.
        </p>
      </div>

      <ReportDateRangeFilter basePath="/reports/doctors" value={range} />

      {rows.length === 0 ? (
        <EmptyState title={"No billing activity in this period."} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead className="text-right">Production</TableHead>
                <TableHead className="text-right">Collections</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.doctorId ?? "unattributed"}>
                  <TableCell>
                    {row.doctorId && canViewDoctorDetail ? (
                      <Link href={`/compensation/doctors/${row.doctorId}`} className="hover:underline">
                        {row.name}
                      </Link>
                    ) : (
                      row.name
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.production)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(row.collections)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
