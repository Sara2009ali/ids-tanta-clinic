import Link from "next/link";
import { ArrowLeft, LineChart, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { RevenueBucketSelect } from "@/components/reports/revenue-bucket-select";
import { RevenueChart } from "@/components/reports/revenue-chart";
import { formatCurrency } from "@/lib/billing/format";
import { getBillingDashboardCounts } from "@/lib/billing/queries";
import { getRevenueSeries, getRevenueTotal, type RevenueBucketGranularity } from "@/lib/reports/queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

const VALID_BUCKETS: RevenueBucketGranularity[] = ["day", "week", "month", "year"];

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBucketLabel(bucketStart: string, bucket: RevenueBucketGranularity): string {
  const date = new Date(`${bucketStart}T00:00:00Z`);
  if (bucket === "year") return date.toLocaleDateString(undefined, { year: "numeric" });
  if (bucket === "month") return date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  if (bucket === "week") return `Week of ${date.toLocaleDateString()}`;
  return date.toLocaleDateString();
}

export default async function RevenueReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const staff = await requirePermission([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.BILLING_VIEW]);

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = {
    start: firstParam(sp.from) || defaults.start,
    end: firstParam(sp.to) || defaults.end,
  };
  const bucketParam = firstParam(sp.bucket);
  const bucket: RevenueBucketGranularity = VALID_BUCKETS.includes(bucketParam as RevenueBucketGranularity)
    ? (bucketParam as RevenueBucketGranularity)
    : "day";

  const [revenueTotal, billingCounts, series] = await Promise.all([
    getRevenueTotal(range),
    getBillingDashboardCounts(),
    staff.clinic_id ? getRevenueSeries(staff.clinic_id, range, bucket) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>Revenue</h1>
        <p className="text-sm text-muted-foreground">Completed payments and outstanding balances.</p>
      </div>

      <ReportDateRangeFilter basePath="/reports/revenue" value={range} />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Revenue" value={formatCurrency(revenueTotal)} icon={Wallet} highlight="gold" />
        <StatCard label="Outstanding" value={formatCurrency(billingCounts.outstandingTotal)} icon={Receipt} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Revenue over time</h2>
        <RevenueBucketSelect range={range} value={bucket} />
      </div>

      {!staff.clinic_id ? (
        <EmptyState title="Your account isn't assigned to a clinic yet." />
      ) : series.length === 0 ? (
        <EmptyState icon={LineChart} title={"No revenue recorded in this period."} />
      ) : (
        <div className="space-y-4">
          <RevenueChart
            data={series.map((point) => ({
              label: formatBucketLabel(point.bucketStart, bucket),
              revenue: point.revenue,
            }))}
          />
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {series.map((point) => (
                  <TableRow key={point.bucketStart}>
                    <TableCell>{formatBucketLabel(point.bucketStart, bucket)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(point.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
