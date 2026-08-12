import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, FilePlus2, FileText, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { formatCurrency } from "@/lib/billing/format";
import { typography } from "@/lib/typography";
import { interactiveRowCard } from "@/lib/interactive-styles";
import { getBillingDashboardCounts, searchInvoices } from "@/lib/billing/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import { listVisitTypes } from "@/lib/appointments/queries";

/**
 * Overview KPIs and Recent Invoices each get their own Suspense boundary so
 * the header/New Invoice button (gated only on the already-cached
 * `permissions`) can paint immediately instead of waiting on
 * getBillingDashboardCounts()'s 4-query fan-out or the invoice list.
 */
async function BillingOverviewCards() {
  const counts = await getBillingDashboardCounts();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Outstanding Balance" value={formatCurrency(counts.outstandingTotal)} icon={AlertCircle} />
      <StatCard label="Paid This Month" value={formatCurrency(counts.paidThisMonth)} icon={Wallet} highlight="gold" />
      <StatCard label="Unpaid Invoices" value={counts.unpaidCount} icon={FileText} />
      <StatCard label="Draft Invoices" value={counts.draftCount} icon={FilePlus2} />
    </div>
  );
}

async function RecentInvoicesCard() {
  const recent = await searchInvoices({ pageSize: 8 });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {recent.rows.length === 0 ? (
          <EmptyState
            illustration="documents"
            title="No invoices yet"
            description="Invoices you create will appear here, with quick access to their payment history."
            className="border-none py-8"
          />
        ) : (
          <div className="space-y-2">
            {recent.rows.map((row) => (
              <Link key={row.id} href={`/billing/invoices/${row.id}`} className={interactiveRowCard}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {row.invoice_number} · {row.patient_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(row.issued_date).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm tabular-nums text-foreground">{formatCurrency(row.total)}</span>
                  <InvoiceStatusBadge status={row.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

function RecentInvoicesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </CardContent>
    </Card>
  );
}

export default async function BillingDashboardPage() {
  // Hard-gated, unlike /appointments or /reception — billing.view isn't
  // granted to every role (dentist/assistant hold neither billing.view nor
  // billing.edit in 0007_reapply_rbac.sql), and RLS alone would otherwise
  // render this page as a confusing wall of zeros instead of a clean
  // "not for you" redirect.
  await requirePermission(PERMISSIONS.BILLING_VIEW);

  const [permissions, visitTypes] = await Promise.all([getCurrentPermissions(), listVisitTypes()]);
  const canEdit = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>Billing</h1>
          <p className="text-sm text-muted-foreground">Invoices, payments, and outstanding balances.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" render={<Link href="/billing/invoices" />}>
            <FileText className="size-4" />
            All Invoices
          </Button>
          {canEdit && <InvoiceFormSheet visitTypes={visitTypes} />}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Overview</h2>
        <Suspense fallback={<StatCardsSkeleton />}>
          <BillingOverviewCards />
        </Suspense>
      </div>

      <Suspense fallback={<RecentInvoicesSkeleton />}>
        <RecentInvoicesCard />
      </Suspense>
    </div>
  );
}
