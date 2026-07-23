import Link from "next/link";
import { BarChart3, Boxes, CalendarDays, HandCoins, Receipt, Stethoscope, UserPlus, Users, Wallet, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency } from "@/lib/billing/format";
import { getBillingDashboardCounts } from "@/lib/billing/queries";
import {
  getAppointmentCount,
  getCancellationStats,
  getNewPatientCount,
  getRevenueTotal,
} from "@/lib/reports/queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { cardHoverLift } from "@/lib/interactive-styles";
import { cn } from "@/lib/utils";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { typography } from "@/lib/typography";

const CATEGORIES = [
  { href: "/reports/revenue", label: "Revenue", description: "Collections and outstanding balances.", icon: Wallet, permission: PERMISSIONS.BILLING_VIEW },
  { href: "/reports/appointments", label: "Appointments", description: "Volume, cancellations, and no-shows.", icon: CalendarDays, permission: PERMISSIONS.APPOINTMENTS_VIEW },
  { href: "/reports/patients", label: "Patients", description: "Growth, new vs. returning.", icon: Users, permission: PERMISSIONS.PATIENTS_VIEW },
  { href: "/reports/doctors", label: "Doctors", description: "Production, collections, top doctors.", icon: Stethoscope, permission: PERMISSIONS.BILLING_VIEW },
  { href: "/reports/compensation", label: "Compensation", description: "Clinic-wide compensation summary.", icon: HandCoins, permission: PERMISSIONS.COMPENSATION_VIEW },
  { href: "/reports/procedures", label: "Procedures", description: "Top procedures, payment methods.", icon: Receipt, permission: PERMISSIONS.BILLING_VIEW },
  { href: "/reports/inventory", label: "Inventory", description: "Stock value, low stock, expiring soon.", icon: Boxes, permission: PERMISSIONS.INVENTORY_VIEW },
] as const;

/**
 * reports.view alone is never sufficient here — every KPI and category tile
 * below is additionally gated on the module permission its data actually
 * comes from (billing.view for money, compensation.view for compensation,
 * etc.), per the approved architecture's Security Review. A role like
 * dentist holds reports.view but not billing.view/compensation.view, and
 * must see neither the financial KPIs nor those category tiles — verified
 * against the real role_permissions data in 0007_reapply_rbac.sql, not
 * assumed.
 */
export default async function ReportsHubPage() {
  await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const permissions = await getCurrentPermissions();

  const canViewBilling = hasPermission(permissions, PERMISSIONS.BILLING_VIEW);
  const canViewAppointments = hasPermission(permissions, PERMISSIONS.APPOINTMENTS_VIEW);
  const canViewPatients = hasPermission(permissions, PERMISSIONS.PATIENTS_VIEW);

  const range = defaultReportRange();

  const [revenueTotal, billingCounts, appointmentCount, cancellationStats, newPatientCount] = await Promise.all([
    canViewBilling ? getRevenueTotal(range) : Promise.resolve(0),
    canViewBilling ? getBillingDashboardCounts() : Promise.resolve(null),
    canViewAppointments ? getAppointmentCount(range) : Promise.resolve(0),
    canViewAppointments ? getCancellationStats(range) : Promise.resolve(null),
    canViewPatients ? getNewPatientCount(range) : Promise.resolve(0),
  ]);

  const cancellationRate =
    cancellationStats && cancellationStats.totalCount > 0
      ? Math.round(((cancellationStats.cancelledCount + cancellationStats.noShowCount) / cancellationStats.totalCount) * 100)
      : null;

  const visibleCategories = CATEGORIES.filter((category) => hasPermission(permissions, category.permission));

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>Reports</h1>
        <p className="text-sm text-muted-foreground">Clinic performance this month, with drill-downs by category.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canViewBilling && (
          <>
            <StatCard label="Revenue (this month)" value={formatCurrency(revenueTotal)} icon={Wallet} />
            <StatCard label="Outstanding" value={formatCurrency(billingCounts?.outstandingTotal ?? 0)} icon={Receipt} />
          </>
        )}
        {canViewAppointments && (
          <>
            <StatCard label="Appointments (this month)" value={appointmentCount} icon={CalendarDays} />
            <StatCard
              label="Cancellation rate"
              value={cancellationRate !== null ? `${cancellationRate}%` : "—"}
              icon={XCircle}
            />
          </>
        )}
        {canViewPatients && <StatCard label="New patients (this month)" value={newPatientCount} icon={UserPlus} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleCategories.map((category) => (
          <Link key={category.href} href={category.href}>
            <Card className={cn("h-full", cardHoverLift)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <category.icon className="size-4 text-muted-foreground" />
                  {category.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {visibleCategories.length === 0 && (
        <EmptyState icon={BarChart3} title="No report categories are available for your role yet." />
      )}
    </div>
  );
}
