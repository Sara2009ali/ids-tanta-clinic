import Link from "next/link";
import { ArrowLeft, ArrowRight, AlertCircle, FileWarning, HandCoins, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency } from "@/lib/billing/format";
import { getClinicCompensationSummary, getDoctorsPendingTotals } from "@/lib/compensation/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

/**
 * A thin Reports lens over Compensation's own numbers — every figure here
 * is getClinicCompensationSummary()/getDoctorsPendingTotals() called
 * directly, not reimplemented, so it's always "this month," exactly what
 * /compensation's own dashboard already shows. No date-range filter here:
 * building one would mean adding range parameters to Compensation's own
 * queries, which is a change to existing, working Compensation code this
 * phase was explicitly not authorized to make.
 */
export default async function CompensationReportPage() {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.COMPENSATION_VIEW]);

  const [summary, doctorTotals] = await Promise.all([getClinicCompensationSummary(), getDoctorsPendingTotals()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
            <ArrowLeft className="size-4" />
            Reports
          </Button>
          <h1 className={cn("mt-1", typography.pageTitle)}>Compensation</h1>
          <p className="text-sm text-muted-foreground">This month&apos;s clinic-wide compensation summary.</p>
        </div>
        <Button variant="outline" render={<Link href="/compensation" />}>
          Open Compensation
          <ArrowRight className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={formatCurrency(summary.pendingTotal)} icon={Wallet} />
        <StatCard label="Settled This Month" value={formatCurrency(summary.settledThisMonthTotal)} icon={HandCoins} />
        <StatCard label="Unresolved Entries" value={summary.unresolvedCount} icon={FileWarning} />
        <StatCard label="Active Rules" value={summary.activeRulesCount} icon={AlertCircle} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Doctors with pending earnings</h2>
        {doctorTotals.length === 0 ? (
          <EmptyState title={"No pending earnings right now."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctorTotals.map((doctor) => (
                  <TableRow key={doctor.doctorId}>
                    <TableCell>
                      <Link href={`/compensation/doctors/${doctor.doctorId}`} className="hover:underline">
                        Dr. {doctor.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(doctor.pendingTotal)}</TableCell>
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
