import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportDateRangeFilter } from "@/components/reports/report-date-range-filter";
import { getReferralSourceBreakdown } from "@/lib/reports/queries";
import { defaultReportRange } from "@/lib/reports/date-range";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { typography } from "@/lib/typography";
import { cn } from "@/lib/utils";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Population = patients *created* within the selected range — the same "created_at defines the period" convention getNewPatientCount()/getPatientGrowth() already use elsewhere in this module. Patient count only: no revenue/appointment attribution is claimed, per the approved v1 scope. */
export default async function ReferralSourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.PATIENTS_VIEW);
  const dict = getDictionary(await getLocale()).reports.referralSources;

  const sp = await searchParams;
  const defaults = defaultReportRange();
  const range = { start: firstParam(sp.from) || defaults.start, end: firstParam(sp.to) || defaults.end };

  const sources = await getReferralSourceBreakdown(range);
  const totalPatients = sources.reduce((sum, source) => sum + source.count, 0);

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

      <ReportDateRangeFilter basePath="/reports/referral-sources" value={range} />

      {sources.length === 0 ? (
        <EmptyState icon={UserPlus} title={dict.emptyTitle} description={dict.emptyDescription} />
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
                    <TableHead>{dict.sourceColumn}</TableHead>
                    <TableHead className="text-end">{dict.patientCountColumn}</TableHead>
                    <TableHead className="text-end">{dict.percentColumn}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.source ?? "__unknown__"}>
                      <TableCell className="font-medium">{source.source ?? dict.unknownSource}</TableCell>
                      <TableCell className="text-end tabular-nums">{source.count}</TableCell>
                      <TableCell className="text-end tabular-nums">{source.percent}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border">
                    <TableCell className="font-medium">{dict.totalRow}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{totalPatients}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">100%</TableCell>
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
