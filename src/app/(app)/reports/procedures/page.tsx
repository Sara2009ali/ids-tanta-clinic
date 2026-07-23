import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { formatCurrency } from "@/lib/billing/format";
import { getPaymentMethodDistribution, getProcedureRevenue } from "@/lib/reports/queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { listVisitTypes } from "@/lib/appointments/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/types/domain";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProceduresReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.BILLING_VIEW]);

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = {
    start: firstParam(sp.from) || defaults.start,
    end: firstParam(sp.to) || defaults.end,
  };

  const [procedureRevenue, paymentMethods, visitTypes] = await Promise.all([
    getProcedureRevenue(range),
    getPaymentMethodDistribution(range),
    listVisitTypes(),
  ]);

  const procedureRows = procedureRevenue
    .map((row) => ({
      ...row,
      name: row.visitTypeId ? (visitTypes.find((v) => v.id === row.visitTypeId)?.name ?? "—") : "Unattributed",
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>Procedures</h1>
        <p className="text-sm text-muted-foreground">Top procedures by revenue, and payment-method distribution.</p>
      </div>

      <ReportDateRangeFilter basePath="/reports/procedures" value={range} />

      <div>
        <h2 className="mb-2 text-sm font-medium">Top procedures</h2>
        {procedureRows.length === 0 ? (
          <EmptyState title={"No billing activity in this period."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Procedure</TableHead>
                  <TableHead className="text-right">Appointments</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {procedureRows.map((row) => (
                  <TableRow key={row.visitTypeId ?? "unattributed"}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.appointmentCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Payment methods</h2>
        {paymentMethods.length === 0 ? (
          <EmptyState title={"No payments recorded in this period."} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Payments</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods
                  .sort((a, b) => b.total - a.total)
                  .map((row) => (
                    <TableRow key={row.method}>
                      <TableCell>{PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(row.total)}</TableCell>
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
