import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisitTypesFilters } from "@/components/appointments/visit-types-filters";
import { VisitTypesManager } from "@/components/appointments/visit-types-manager";
import type { VisitTypesQueryParams } from "@/components/appointments/visit-types-query-params";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listVisitTypesForManagement, type VisitTypeForManagement } from "@/lib/appointments/queries";

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

export default async function VisitTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Hard-gated (redirects non-admins to /dashboard), same as
  // /appointments/chairs and /appointments/doctor-schedule — this is
  // clinic configuration, not a view every clinic staff member should reach.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const sp = await searchParams;
  const filterValue: VisitTypesQueryParams = {
    query: firstParam(sp.query) || undefined,
    status: (firstParam(sp.status) as VisitTypesQueryParams["status"]) || undefined,
  };
  const hasFilters = Boolean(filterValue.query || filterValue.status);

  const visitTypes = await listVisitTypesForManagement();
  const filteredVisitTypes = filterVisitTypes(visitTypes, filterValue);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          render={<Link href="/appointments" aria-label="Back to appointments" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Procedures</h1>
          <p className="text-sm text-muted-foreground">
            Add, rename, enable/disable, or remove the procedures your clinic offers.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All procedures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VisitTypesFilters value={filterValue} />
          <VisitTypesManager visitTypes={filteredVisitTypes} hasFilters={hasFilters} />
        </CardContent>
      </Card>
    </div>
  );
}
