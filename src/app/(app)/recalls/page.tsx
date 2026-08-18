import { RecallFormSheet } from "@/components/recalls/recall-form-sheet";
import { RecallsFilters } from "@/components/recalls/recalls-filters";
import { RecallsTable } from "@/components/recalls/recalls-table";
import { Pagination } from "@/components/ui/pagination";
import { buildRecallsHref, type RecallsQueryParams } from "@/components/recalls/recalls-query-params";
import { searchRecalls } from "@/lib/recalls/queries";
import { listDoctors } from "@/lib/patients/queries";
import { listVisitTypes } from "@/lib/appointments/queries";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { RecallStatus } from "@/types/domain";
import { typography } from "@/lib/typography";

const PAGE_SIZE = 20;
const STATUS_VALUES = new Set<RecallStatus>(["due", "scheduled", "completed", "dismissed"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** The cross-patient Recall worklist — how the clinic identifies who needs follow-up. Sorted soonest-due-first; overdue items get a clear warning treatment. This is the v1 mechanism for surfacing due/overdue recalls — no notification firing (see 0030_recalls.sql / lib/recalls). */
export default async function RecallsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.CLINICAL_VIEW);

  const sp = await searchParams;
  const query = firstParam(sp.query) ?? "";
  const statusRaw = firstParam(sp.status) ?? "";
  const status = STATUS_VALUES.has(statusRaw as RecallStatus) ? (statusRaw as RecallStatus) : "";
  const doctorId = firstParam(sp.doctor) ?? "";
  const pageRaw = Number(firstParam(sp.page));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const [{ rows, totalCount, pageSize }, permissions, doctors, visitTypes] = await Promise.all([
    searchRecalls({ query: query || undefined, status: status || undefined, doctorId: doctorId || undefined, page, pageSize: PAGE_SIZE }),
    getCurrentPermissions(),
    listDoctors(),
    listVisitTypes(),
  ]);

  const canEdit = hasPermission(permissions, PERMISSIONS.CLINICAL_EDIT);
  const hasFilters = Boolean(query || status || doctorId);

  const filterValue: RecallsQueryParams = {
    query: query || undefined,
    status: status || undefined,
    doctor: doctorId || undefined,
  };
  const baseParams: RecallsQueryParams = {
    ...filterValue,
    page: page > 1 ? String(page) : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className={typography.pageTitle}>Recalls</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} recall{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        {canEdit && <RecallFormSheet doctors={doctors} visitTypes={visitTypes} />}
      </div>

      <RecallsFilters value={filterValue} doctors={doctors} />

      <RecallsTable rows={rows} hasFilters={hasFilters} doctors={doctors} visitTypes={visitTypes} canEdit={canEdit} />

      {totalCount > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          buildHref={(p) => buildRecallsHref(baseParams, { page: String(p) })}
        />
      )}
    </div>
  );
}
