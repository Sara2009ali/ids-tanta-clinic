import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildPatientsHref, type PatientsQueryParams } from "@/components/patients/patients-query-params";

export function PatientsPagination({
  page,
  pageSize,
  totalCount,
  baseParams,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  baseParams: PatientsQueryParams;
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
            render={<Link href={buildPatientsHref(baseParams, { page: String(page - 1) })} scroll={false} />}
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
            render={<Link href={buildPatientsHref(baseParams, { page: String(page + 1) })} scroll={false} />}
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
