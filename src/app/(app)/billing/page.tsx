import Link from "next/link";
import { AlertCircle, FilePlus2, FileText, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { formatCurrency } from "@/lib/billing/format";
import { typography } from "@/lib/typography";
import { getBillingDashboardCounts, searchInvoices } from "@/lib/billing/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

export default async function BillingDashboardPage() {
  // Hard-gated, unlike /appointments or /reception — billing.view isn't
  // granted to every role (dentist/assistant hold neither billing.view nor
  // billing.edit in 0007_reapply_rbac.sql), and RLS alone would otherwise
  // render this page as a confusing wall of zeros instead of a clean
  // "not for you" redirect.
  await requirePermission(PERMISSIONS.BILLING_VIEW);

  const [counts, recent, permissions] = await Promise.all([
    getBillingDashboardCounts(),
    searchInvoices({ pageSize: 8 }),
    getCurrentPermissions(),
  ]);

  const canEdit = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">Invoices, payments, and outstanding balances.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/billing/invoices" />}>
            <FileText className="size-4" />
            All Invoices
          </Button>
          {canEdit && <InvoiceFormSheet />}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className={typography.eyebrow}>Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Outstanding Balance" value={formatCurrency(counts.outstandingTotal)} icon={AlertCircle} />
          <StatCard label="Paid This Month" value={formatCurrency(counts.paidThisMonth)} icon={Wallet} />
          <StatCard label="Unpaid Invoices" value={counts.unpaidCount} icon={FileText} />
          <StatCard label="Draft Invoices" value={counts.draftCount} icon={FilePlus2} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/billing/invoices/${row.id}`}
                  className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {row.invoice_number} · {row.patient_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(row.issued_date).toLocaleDateString()}
                    </p>
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
    </div>
  );
}
