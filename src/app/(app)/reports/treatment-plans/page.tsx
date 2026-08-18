import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { formatCurrency } from "@/lib/billing/format";
import { getPlanConversionSummary, getPlannedVsPerformedSummary } from "@/lib/reports/clinical-queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import {
  TREATMENT_PLAN_ITEM_STATUS_LABELS,
  TREATMENT_PLAN_STATUS_LABELS,
  type TreatmentPlanItemStatus,
  type TreatmentPlanStatus,
} from "@/types/domain";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { ClipboardList, ClockArrowUp, ListChecks, ListTodo } from "lucide-react";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDays(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)} day${value === 1 ? "" : "s"}`;
}

/**
 * Treatment Plan Conversion + Planned vs Performed. Every status count here
 * is the *current* status of plans/items created or decided in the
 * selected range — this repository keeps no status-history table for
 * treatment_plans/treatment_plan_items, so a true "status as of a past
 * date" figure isn't derivable, and this page never pretends otherwise
 * (see the explanatory copy below).
 */
export default async function TreatmentPlansReportPage({
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

  const [conversion, plannedVsPerformed] = await Promise.all([
    getPlanConversionSummary(range),
    getPlannedVsPerformedSummary(range),
  ]);

  const planStatuses = Object.keys(TREATMENT_PLAN_STATUS_LABELS) as TreatmentPlanStatus[];
  const itemStatuses = Object.keys(TREATMENT_PLAN_ITEM_STATUS_LABELS) as TreatmentPlanItemStatus[];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/reports" />}>
          <ArrowLeft className="size-4" />
          Reports
        </Button>
        <h1 className={cn("mt-1", typography.pageTitle)}>Treatment Plans</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Plan and item counts reflect their current status — this clinic doesn&apos;t keep a history of past status
          changes, so these are current statuses for plans and items created or decided within the selected range,
          not a snapshot as of a past date.
        </p>
      </div>

      <ReportDateRangeFilter basePath="/reports/treatment-plans" value={range} />

      <div>
        <h2 className="mb-2 text-sm font-medium">Treatment Plan Conversion</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Plans created" value={conversion.plansCreated} icon={ClipboardList} />
          <StatCard
            label="Avg. time to decision"
            value={formatDays(conversion.averageDaysToDecision)}
            icon={ClockArrowUp}
            hint="Average days from an item being proposed to being accepted, postponed, or rejected"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Plans by current status</p>
            {conversion.plansCreated === 0 ? (
              <EmptyState title="No treatment plans created in this period." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Plans</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planStatuses.map((status) => (
                      <TableRow key={status}>
                        <TableCell>{TREATMENT_PLAN_STATUS_LABELS[status]}</TableCell>
                        <TableCell className="text-right tabular-nums">{conversion.plansByStatus[status] ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Item disposition</p>
            {Object.keys(conversion.itemsByStatus).length === 0 ? (
              <EmptyState title="No proposed or decided items in this period." />
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itemStatuses.map((status) => (
                      <TableRow key={status}>
                        <TableCell>{TREATMENT_PLAN_ITEM_STATUS_LABELS[status]}</TableCell>
                        <TableCell className="text-right tabular-nums">{conversion.itemsByStatus[status] ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Planned vs. Performed Treatment</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Items proposed in the selected period, and whether they&apos;ve since been fulfilled by at least one
          treatment record. Rejected items are excluded — a declined item isn&apos;t remaining work.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Items fulfilled" value={plannedVsPerformed.fulfilledCount} icon={ListChecks} />
          <StatCard label="Items unfulfilled" value={plannedVsPerformed.unfulfilledCount} icon={ListTodo} />
          <StatCard
            label="Estimated unfulfilled treatment"
            value={formatCurrency(plannedVsPerformed.unfulfilledEstimatedValue)}
            icon={ClockArrowUp}
            hint="Estimated — not billed"
          />
          <StatCard
            label="Ad-hoc performed treatment"
            value={plannedVsPerformed.adHocPerformedCount}
            icon={ClipboardList}
            hint="Treatment records with no linked plan item — recorded separately, never counted as planned"
          />
        </div>
      </div>
    </div>
  );
}
