import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisitTypesFilters } from "@/components/procedures/visit-types-filters";
import { VisitTypesManager } from "@/components/procedures/visit-types-manager";
import type { VisitTypesQueryParams } from "@/components/procedures/visit-types-query-params";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listVisitTypesForManagement, type VisitTypeForManagement } from "@/lib/appointments/queries";
import { typography } from "@/lib/typography";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Filtering happens here, in memory, over the clinic's full visit-type list
 * — no new query/RPC, matching the "fetch broad, filter in JS" convention
 * already accepted at this app's established scale (e.g. filterRules() on
 * /compensation/rules).
 */
function filterVisitTypes(
  visitTypes: VisitTypeForManagement[],
  params: VisitTypesQueryParams,
): VisitTypeForManagement[] {
  const query = params.query?.trim().toLowerCase();

  return visitTypes.filter((visitType) => {
    if (params.status === "active" && !visitType.is_active) return false;
    if (params.status === "inactive" && visitType.is_active) return false;
    if (query && !visitType.name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export default async function ProceduresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Hard-gated (redirects non-admins to /dashboard), same as
  // /appointments/chairs and /appointments/doctor-schedule — this is
  // clinic configuration, not a view every clinic staff member should reach,
  // even though it's now a standalone top-level module rather than nested
  // under Appointments.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const sp = await searchParams;
  const filterValue: VisitTypesQueryParams = {
    query: firstParam(sp.query) || undefined,
    status: (firstParam(sp.status) as VisitTypesQueryParams["status"]) || undefined,
  };
  const hasFilters = Boolean(filterValue.query || filterValue.status);

  const visitTypes = await listVisitTypesForManagement();
  const filteredVisitTypes = filterVisitTypes(visitTypes, filterValue);
  // Suggestions come from the full clinic catalog, not the filtered view —
  // a category shouldn't disappear from the "add procedure" autocomplete
  // just because the admin is currently filtered down to "Disabled".
  const categories = Array.from(
    new Set(visitTypes.map((visitType) => visitType.category).filter((category): category is string => !!category)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>Procedures</h1>
        <p className="text-sm text-muted-foreground">
          Add, rename, enable/disable, or remove the procedures your clinic offers.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All procedures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VisitTypesFilters value={filterValue} />
          <VisitTypesManager visitTypes={filteredVisitTypes} hasFilters={hasFilters} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
