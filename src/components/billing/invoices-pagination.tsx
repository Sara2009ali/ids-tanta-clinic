import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildInvoicesHref, type InvoicesQueryParams } from "@/components/billing/invoices-query-params";

export function InvoicesPagination({
  page,
  pageSize,
  totalCount,
  baseParams,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  baseParams: InvoicesQueryParams;
}) {
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        {hasPrev ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={buildInvoicesHref(baseParams, { page: String(page - 1) })} scroll={false} />}
          >
            Previous
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {hasNext ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={buildInvoicesHref(baseParams, { page: String(page + 1) })} scroll={false} />}
          >
            Next
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
