import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorsFilters } from "@/components/doctors/doctors-filters";
import { DoctorsTable } from "@/components/doctors/doctors-table";
import { DoctorFormSheet } from "@/components/doctors/doctor-form-sheet";
import type { DoctorsQueryParams } from "@/components/doctors/doctors-query-params";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listDoctorsForManagement, getDoctorAccessMap, type DoctorForManagement } from "@/lib/doctors/queries";
import { typography } from "@/lib/typography";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Filtering happens in memory over the clinic's full doctor list — same "fetch broad, filter in JS" convention as VisitTypesPage/CompensationRulesPage at this app's scale. */
function filterDoctors(doctors: DoctorForManagement[], params: DoctorsQueryParams): DoctorForManagement[] {
  const query = params.query?.trim().toLowerCase();

  return doctors.filter((doctor) => {
    if (params.status === "active" && !doctor.is_active) return false;
    if (params.status === "inactive" && doctor.is_active) return false;
    if (query && !doctor.full_name.toLowerCase().includes(query)) return false;
    return true;
  });
}

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Hard-gated, same as /appointments/visit-types and /appointments/chairs
  // — this is clinic configuration (and now account provisioning), not a
  // view every clinic staff member should reach.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const sp = await searchParams;
  const filterValue: DoctorsQueryParams = {
    query: firstParam(sp.query) || undefined,
    status: (firstParam(sp.status) as DoctorsQueryParams["status"]) || undefined,
  };
  const hasFilters = Boolean(filterValue.query || filterValue.status);

  const doctors = await listDoctorsForManagement();
  const accessById = await getDoctorAccessMap(doctors.map((doctor) => doctor.id));
  const filteredDoctors = filterDoctors(doctors, filterValue);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" render={<Link href="/settings" aria-label="Back to settings" />}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className={typography.pageTitle}>Doctors</h1>
            <p className="text-sm text-muted-foreground">Add and manage the doctors at your clinic.</p>
          </div>
        </div>
        <DoctorFormSheet />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All doctors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DoctorsFilters value={filterValue} />
          <DoctorsTable doctors={filteredDoctors} accessById={accessById} hasFilters={hasFilters} />
        </CardContent>
      </Card>
    </div>
  );
}
