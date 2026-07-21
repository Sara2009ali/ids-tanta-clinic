import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Shared Previous/Next pagination bar — replaces the two near-identical
 * patients-pagination.tsx/invoices-pagination.tsx implementations. Callers
 * keep their own query-param shape by passing a buildHref(page) function
 * rather than this component knowing about any specific filter set.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  buildHref,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  buildHref: (page: number) => string;
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
          <Button variant="outline" size="sm" render={<Link href={buildHref(page - 1)} scroll={false} />}>
            Previous
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {hasNext ? (
          <Button variant="outline" size="sm" render={<Link href={buildHref(page + 1)} scroll={false} />}>
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
