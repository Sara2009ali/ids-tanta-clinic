import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown, UserPlus2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PatientStatusBadge } from "@/components/patients/status-badge";
import { PatientRowActions } from "@/components/patients/patient-row-actions";
import { genderLabel, initials } from "@/lib/patients/utils";
import type { DoctorOption } from "@/lib/patients/queries";
import type { PatientSearchRow } from "@/types/domain";
import { buildPatientsHref, type PatientsQueryParams } from "@/components/patients/patients-query-params";
import { hasPermission, PERMISSIONS } from "@/lib/authz/permissions";

type SortableColumn = "name" | "last_visit_at" | "status";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortDir,
  baseParams,
}: {
  label: string;
  column: SortableColumn;
  sortBy: string;
  sortDir: string;
  baseParams: PatientsQueryParams;
}) {
  const isActive = sortBy === column;
  const nextDir = isActive && sortDir === "asc" ? "desc" : "asc";
  const href = buildPatientsHref(baseParams, { sortBy: column, sortDir: nextDir, page: undefined });

  return (
    <Link
      href={href}
      scroll={false}
      className="inline-flex items-center gap-1 text-foreground hover:text-foreground/80"
    >
      {label}
      {isActive ? (
        sortDir === "asc" ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 text-muted-foreground/50" />
      )}
    </Link>
  );
}

export function PatientsTable({
  rows,
  doctors,
  hasFilters,
  sortBy,
  sortDir,
  baseParams,
  permissions,
}: {
  rows: PatientSearchRow[];
  doctors: DoctorOption[];
  hasFilters: boolean;
  sortBy: string;
  sortDir: string;
  baseParams: PatientsQueryParams;
  permissions: string[];
}) {
  const canCreatePatient = hasPermission(permissions, PERMISSIONS.PATIENTS_CREATE);
  const doctorNameById = new Map(doctors.map((doctor) => [doctor.id, doctor.full_name]));

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader
                label="Patient"
                column="name"
                sortBy={sortBy}
                sortDir={sortDir}
                baseParams={baseParams}
              />
            </TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Gender</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>
              <SortableHeader
                label="Last Visit"
                column="last_visit_at"
                sortBy={sortBy}
                sortDir={sortDir}
                baseParams={baseParams}
              />
            </TableHead>
            <TableHead>
              <SortableHeader
                label="Status"
                column="status"
                sortBy={sortBy}
                sortDir={sortDir}
                baseParams={baseParams}
              />
            </TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={7} className="p-0">
                {hasFilters ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <p className="text-sm text-muted-foreground">
                      No patients match your filters.
                    </p>
                    <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
                      Clear filters
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <UserPlus2 className="size-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No patients yet — add your first one to get started.
                    </p>
                    {canCreatePatient && (
                      <Button render={<Link href="/patients/new" />} size="sm">
                        Add Patient
                      </Button>
                    )}
                  </div>
                )}
              </TableCell>
            </TableRow>
          )}
          {rows.map((patient) => {
            const doctorName = patient.preferred_dentist_id
              ? doctorNameById.get(patient.preferred_dentist_id)
              : undefined;

            return (
              <TableRow key={patient.id}>
                <TableCell className="p-0">
                  <Link
                    href={`/patients/${patient.id}`}
                    className="flex items-center gap-3 px-2 py-2.5"
                  >
                    <Avatar>
                      <AvatarFallback>{initials(patient.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{patient.full_name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {patient.patient_number}
                      </div>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{patient.phone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{genderLabel(patient.gender)}</TableCell>
                <TableCell className="text-muted-foreground">{doctorName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(patient.last_visit_at)}
                </TableCell>
                <TableCell>
                  <PatientStatusBadge status={patient.status} />
                </TableCell>
                <TableCell>
                  <PatientRowActions
                    patientId={patient.id}
                    status={patient.status}
                    patientName={patient.full_name}
                    permissions={permissions}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
