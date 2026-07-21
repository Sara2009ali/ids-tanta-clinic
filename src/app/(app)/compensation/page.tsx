import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, FileWarning, HandCoins, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompensationAuditHistory } from "@/components/compensation/compensation-audit-history";
import { DoctorCompensationPanel } from "@/components/compensation/doctor-compensation-panel";
import { formatCurrency } from "@/lib/billing/format";
import {
  getClinicCompensationSummary,
  getCompensationAuditEntries,
  getCompensationRules,
  getDoctorEarnings,
  getDoctorEarningsSummary,
  getDoctorSettlements,
  getDoctorsPendingTotals,
  getUnresolvedCompensationEntries,
} from "@/lib/compensation/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { requireStaff } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/authz/session";
import { hasAnyPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";
import type { StaffProfile } from "@/types/domain";

/**
 * Same route for both audiences, branched at the top — per the approved
 * Phase 5/6 architecture: dentist is deliberately granted neither
 * compensation.view nor compensation.manage (0014_doctor_compensation.sql),
 * so their visibility comes from RLS's doctor_id = auth.uid() clause, not a
 * permission check. Permission-holders (admin/accountant) always see the
 * management dashboard; a legacy 'doctor' role with neither permission sees
 * the read-only self-service view instead; anyone else is redirected away,
 * same as requirePermission's own behavior.
 */
export default async function CompensationPage() {
  const staff = await requireStaff();
  const permissions = await getCurrentPermissions();

  if (hasAnyPermission(permissions, [PERMISSIONS.COMPENSATION_VIEW, PERMISSIONS.COMPENSATION_MANAGE])) {
    return <CompensationAdminDashboard />;
  }

  if (staff.role === "doctor") {
    return <MyCompensationView doctor={staff} />;
  }

  redirect("/dashboard");
}

async function CompensationAdminDashboard() {
  const [summary, doctorTotals, auditEntries, unresolved] = await Promise.all([
    getClinicCompensationSummary(),
    getDoctorsPendingTotals(),
    getCompensationAuditEntries(),
    getUnresolvedCompensationEntries(),
  ]);

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
        </div>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pending" value={formatCurrency(summary.pendingTotal)} icon={Wallet} />
          <StatCard label="Settled This Month" value={formatCurrency(summary.settledThisMonthTotal)} icon={HandCoins} />
          <StatCard label="Unresolved Entries" value={summary.unresolvedCount} icon={FileWarning} />
          <StatCard label="Active Rules" value={summary.activeRulesCount} icon={AlertCircle} />
        </div>
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

/**
 * Dentist self-service view — read-only, scoped entirely to this doctor's own
 * rows. canManage is always false, which makes DoctorCompensationPanel's
 * CompensationRulesTable suppress its Actions column and every mutation
 * control on its own; no SetCompensationRuleSheet, Replace/Close, settlement-
 * run, or unresolved-resolve action is reachable from this view at all.
 */
async function MyCompensationView({ doctor }: { doctor: StaffProfile }) {
  const [summary, earnings, rules, visitTypes, settlements] = await Promise.all([
    getDoctorEarningsSummary(doctor.id),
    // Full ledger, fetched once — the Pending sub-view below and the Statements
    // drill-down both derive from this single array rather than re-querying.
    getDoctorEarnings({ doctorId: doctor.id }),
    // No doctorId param: the query only adds `.eq("doctor_id", ...)` when one is
    // passed, so calling it bare relies on RLS (doctor_id = auth.uid() OR
    // doctor_id IS NULL) to return this doctor's own rules *and* clinic-wide
    // defaults — passing { doctorId: doctor.id } would incorrectly exclude the
    // clinic-wide rows.
    getCompensationRules(),
    listVisitTypes(),
    getDoctorSettlements(doctor.id),
  ]);

  const doctorOptions = [{ id: doctor.id, full_name: doctor.full_name }];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Compensation</h1>
        <p className="text-sm text-muted-foreground">Your earnings, rates, and settlement statements.</p>
      </div>

      <DoctorCompensationPanel
        summary={summary}
        earnings={earnings}
        rules={rules}
        visitTypes={visitTypes}
        settlements={settlements}
        doctorOptions={doctorOptions}
        canManage={false}
      />
    </div>
  );
}
