import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { formatCurrency } from "@/lib/billing/format";
import { getCashReconciliation } from "@/lib/reports/queries";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * "Daily" is this report's default, not a hard constraint — it reuses the
 * same ReportDateRangeFilter every other report already uses (per the
 * approved architecture: no separate visual language for a single-day
 * picker), just defaulted to today instead of defaultReportRange()'s
 * "this month to date". Widening the range still produces a correct
 * multi-day summary, since summarizeCashReconciliation() has no
 * single-day assumption baked in.
 */
export default async function CashReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.BILLING_VIEW);
  const dict = getDictionary(await getLocale()).reports.cashReconciliation;

  const sp = await searchParams;
  const today = todayDateString();
  const range = { start: firstParam(sp.from) || today, end: firstParam(sp.to) || today };

  const summary = await getCashReconciliation(range);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>{dict.pageTitle}</h1>
        <p className="text-sm text-muted-foreground">{dict.pageDescription}</p>
      </div>

      <ReportDateRangeFilter basePath="/reports/cash-reconciliation" value={range} />

      {summary.paymentCount === 0 ? (
        <EmptyState icon={Wallet} title={dict.emptyTitle} description={dict.emptyDescription} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{dict.pageTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.methodColumn}</TableHead>
                    <TableHead className="text-end">{dict.countColumn}</TableHead>
                    <TableHead className="text-end">{dict.grossColumn}</TableHead>
                    <TableHead className="text-end">{dict.refundsColumn}</TableHead>
                    <TableHead className="text-end">{dict.netColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.methods.map((method) => (
                    <TableRow key={method.method}>
                      <TableCell className="font-medium capitalize">{method.method.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-end tabular-nums">{method.count}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatCurrency(method.gross)}</TableCell>
                      <TableCell className="text-end tabular-nums text-destructive">
                        {method.refunds > 0 ? `-${formatCurrency(method.refunds)}` : formatCurrency(0)}
                      </TableCell>
                      <TableCell className="text-end tabular-nums font-medium">{formatCurrency(method.net)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border">
                    <TableCell className="font-medium">{dict.totalRow}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{summary.paymentCount}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatCurrency(summary.totalGross)}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium text-destructive">
                      {summary.totalRefunds > 0 ? `-${formatCurrency(summary.totalRefunds)}` : formatCurrency(0)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatCurrency(summary.totalNet)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
