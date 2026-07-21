import { InvoiceFormSheet } from "@/components/billing/invoice-form-sheet";
import { InvoicesFilters } from "@/components/billing/invoices-filters";
import { InvoicesTable } from "@/components/billing/invoices-table";
import { Pagination } from "@/components/ui/pagination";
import { buildInvoicesHref, type InvoicesQueryParams } from "@/components/billing/invoices-query-params";
import { searchInvoices } from "@/lib/billing/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { InvoiceStatus } from "@/types/domain";

const PAGE_SIZE = 20;
const STATUS_VALUES = new Set<InvoiceStatus>(["draft", "unpaid", "partially_paid", "paid", "cancelled"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.BILLING_VIEW);

  const sp = await searchParams;
  const query = firstParam(sp.query) ?? "";
  const statusRaw = firstParam(sp.status) ?? "";
  const status = STATUS_VALUES.has(statusRaw as InvoiceStatus) ? (statusRaw as InvoiceStatus) : "";
  const pageRaw = Number(firstParam(sp.page));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const [{ rows, totalCount, pageSize }, permissions] = await Promise.all([
    searchInvoices({ query: query || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }),
    getCurrentPermissions(),
  ]);

  const canCreate = hasPermission(permissions, PERMISSIONS.BILLING_EDIT);
  const hasFilters = Boolean(query || status);

  const filterValue: InvoicesQueryParams = {
    query: query || undefined,
    status: status || undefined,
  };
  const baseParams: InvoicesQueryParams = {
    ...filterValue,
    page: page > 1 ? String(page) : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} invoice{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        {canCreate && <InvoiceFormSheet />}
      </div>

      <InvoicesFilters value={filterValue} />

      <InvoicesTable rows={rows} hasFilters={hasFilters} />

      {totalCount > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          buildHref={(p) => buildInvoicesHref(baseParams, { page: String(p) })}
        />
      )}
    </div>
  );
}
