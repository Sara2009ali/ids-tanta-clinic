import Link from "next/link";
import { AlertCircle, FileWarning, HandCoins, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompensationAuditHistory } from "@/components/compensation/compensation-audit-history";
import { formatCurrency } from "@/lib/billing/format";
import {
  getClinicCompensationSummary,
  getCompensationAuditEntries,
  getDoctorsPendingTotals,
  getUnresolvedCompensationEntries,
} from "@/lib/compensation/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

export default async function CompensationDashboardPage() {
  await requirePermission(PERMISSIONS.COMPENSATION_VIEW);

  const [summary, doctorTotals, auditEntries, unresolved, permissions] = await Promise.all([
    getClinicCompensationSummary(),
    getDoctorsPendingTotals(),
    getCompensationAuditEntries(),
    getUnresolvedCompensationEntries(),
    getCurrentPermissions(),
  ]);

  const canManage = hasPermission(permissions, PERMISSIONS.COMPENSATION_MANAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compensation</h1>
          <p className="text-sm text-muted-foreground">Doctor earnings, rates, and settlements.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/compensation/rules" />}>
            Rules
          </Button>
          <Button variant="outline" render={<Link href="/compensation/unresolved" />}>
            Unresolved
          </Button>
          {canManage && (
            <Button render={<Link href="/compensation/settlements" />}>
              <HandCoins className="size-4" />
              Settlements
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={formatCurrency(summary.pendingTotal)} icon={Wallet} />
        <StatCard label="Settled This Month" value={formatCurrency(summary.settledThisMonthTotal)} icon={HandCoins} />
        <StatCard label="Unresolved Entries" value={summary.unresolvedCount} icon={FileWarning} />
        <StatCard label="Active Rules" value={summary.activeRulesCount} icon={AlertCircle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Doctors with pending earnings</CardTitle>
          </CardHeader>
          <CardContent>
            {doctorTotals.length > 0 ? (
              <ul className="space-y-2">
                {doctorTotals.slice(0, 10).map((doctor) => (
                  <li key={doctor.doctorId} className="flex items-center justify-between text-sm">
                    <Link href={`/compensation/doctors/${doctor.doctorId}`} className="hover:underline">
                      Dr. {doctor.fullName}
                    </Link>
                    <span className="tabular-nums">{formatCurrency(doctor.pendingTotal)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No pending earnings right now.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unresolved compensation</CardTitle>
          </CardHeader>
          <CardContent>
            {unresolved.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {unresolved.length} payment{unresolved.length === 1 ? "" : "s"} with no matching rate.
                </p>
                <Button variant="outline" size="sm" render={<Link href="/compensation/unresolved" />}>
                  Review
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No unresolved compensation. Every payment has a matching rule.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Recent Activity</h2>
        <CompensationAuditHistory auditEntries={auditEntries} />
      </div>
    </div>
  );
}
