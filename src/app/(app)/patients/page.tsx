import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDoctors, searchPatients } from "@/lib/patients/queries";
import { PatientsFilters } from "@/components/patients/patients-filters";
import { buildPatientsHref, type PatientsQueryParams } from "@/components/patients/patients-query-params";
import { PatientsTable } from "@/components/patients/patients-table";
import { PatientsPagination } from "@/components/patients/patients-pagination";
import { getCurrentPermissions, requirePermission } from "@/lib/authz/session";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";
import type { PatientStatus } from "@/types/domain";

const PAGE_SIZE = 20;
const SORTABLE_COLUMNS = new Set(["name", "last_visit_at", "status", "created_at"]);
const STATUS_VALUES = new Set<PatientStatus>(["active", "inactive", "archived"]);

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.PATIENTS_VIEW);

  const sp = await searchParams;

  const query = firstParam(sp.query) ?? "";
  const gender = firstParam(sp.gender) ?? "";
  const statusRaw = firstParam(sp.status) ?? "";
  const status = STATUS_VALUES.has(statusRaw as PatientStatus) ? (statusRaw as PatientStatus) : "";
  const doctorId = firstParam(sp.doctorId) ?? "";
  const sortByRaw = firstParam(sp.sortBy) ?? "created_at";
  const sortBy = (SORTABLE_COLUMNS.has(sortByRaw) ? sortByRaw : "created_at") as
    | "name"
    | "last_visit_at"
    | "status"
    | "created_at";
  const sortDirRaw = firstParam(sp.sortDir) ?? "desc";
  const sortDir = sortDirRaw === "asc" ? "asc" : "desc";
  const pageRaw = Number(firstParam(sp.page));
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const [{ rows, totalCount, pageSize }, doctors, permissions] = await Promise.all([
    searchPatients({
      query: query || undefined,
      gender: gender || undefined,
      status: status || undefined,
      doctorId: doctorId || undefined,
      sortBy,
      sortDir,
      page,
      pageSize: PAGE_SIZE,
    }),
    listDoctors(),
    getCurrentPermissions(),
  ]);

  const canCreatePatient = hasPermission(permissions, PERMISSIONS.PATIENTS_CREATE);

  const hasFilters = Boolean(query || gender || status || doctorId);

  const filterValue: PatientsQueryParams = {
    query: query || undefined,
    gender: gender || undefined,
    status: status || undefined,
    doctorId: doctorId || undefined,
    sortBy,
    sortDir,
  };

  // A stale bookmark or a page whose last patient just got archived can put
  // `page` past the end of the result set — without this, the table would
  // show "no patients yet" even though patients exist on earlier pages.
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (page > totalPages && totalCount > 0) {
    redirect(
      buildPatientsHref(filterValue, { page: totalPages > 1 ? String(totalPages) : undefined }),
    );
  }

  const baseParams: PatientsQueryParams = {
    ...filterValue,
    page: page > 1 ? String(page) : undefined,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} patient{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        {canCreatePatient && (
          <Button render={<Link href="/patients/new" />}>
            <Plus className="size-4" />
            Add Patient
          </Button>
        )}
      </div>

      <PatientsFilters value={filterValue} doctors={doctors} />

      <PatientsTable
        rows={rows}
        doctors={doctors}
        hasFilters={hasFilters}
        sortBy={sortBy}
        sortDir={sortDir}
        baseParams={baseParams}
        permissions={permissions}
      />

      {totalCount > 0 && (
        <PatientsPagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          baseParams={baseParams}
        />
      )}
    </div>
  );
}
