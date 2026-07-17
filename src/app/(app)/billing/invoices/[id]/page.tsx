import Link from "next/link";
import { notFound } from "next/navigation";
import { getInvoiceAuditEntries, getInvoiceDetail } from "@/lib/billing/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { formatCurrency } from "@/lib/billing/format";
import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { InvoiceDetailActions } from "@/components/billing/invoice-detail-actions";
import { InvoiceItemsSummary } from "@/components/billing/invoice-items-summary";
import { PaymentsHistory } from "@/components/billing/payments-history";
import { InvoiceAuditHistory } from "@/components/billing/invoice-audit-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.BILLING_VIEW);

  const { id } = await params;
  const [invoice, auditEntries, permissions] = await Promise.all([
    getInvoiceDetail(id),
    getInvoiceAuditEntries(id),
    getCurrentPermissions(),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/patients/${invoice.patient_id}`} className="hover:underline">
              {invoice.patient_name}
            </Link>
            {invoice.patient_number ? ` · #${invoice.patient_number}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            Issued {new Date(invoice.issued_date).toLocaleDateString()}
            {invoice.appointment_scheduled_start
              ? ` · Appointment ${new Date(invoice.appointment_scheduled_start).toLocaleString()}`
              : ""}
          </p>
        </div>
        <InvoiceDetailActions invoice={invoice} permissions={permissions} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(Number(invoice.total))}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(Number(invoice.paid_amount))}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground">Balance Due</p>
          <p className="text-lg font-semibold tabular-nums">{formatCurrency(Number(invoice.balance_due))}</p>
        </div>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="audit">Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4 pt-6">
          <InvoiceItemsSummary
            items={invoice.items}
            subtotal={Number(invoice.subtotal)}
            taxPercent={Number(invoice.tax_percent)}
            taxAmount={Number(invoice.tax_amount)}
            total={Number(invoice.total)}
          />
          {invoice.notes && (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Notes</p>
              <p className="rounded-xl border border-border p-4 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="pt-6">
          <PaymentsHistory
            invoiceId={invoice.id}
            payments={invoice.payments}
            canEdit={permissions.includes(PERMISSIONS.BILLING_EDIT)}
          />
        </TabsContent>

        <TabsContent value="audit" className="pt-6">
          <InvoiceAuditHistory auditEntries={auditEntries} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
