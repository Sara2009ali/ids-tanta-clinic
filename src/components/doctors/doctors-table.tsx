import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { DoctorForManagement } from "@/lib/doctors/queries";

/**
 * Deliberately just four columns (Doctor, Specialty, Status, Account) —
 * everything else (phone, license, bio, schedule, compensation) lives on
 * the doctor's own profile page, one click away via the name link, the
 * same "row links out, actions live on the detail page" shape
 * InvoicesTable already uses. Keeps this list scannable at a glance
 * instead of repeating the Procedures Catalog's column growth.
 */
export function DoctorsTable({
  doctors,
  accessById,
  hasFilters,
}: {
  doctors: DoctorForManagement[];
  accessById: Map<string, boolean>;
  hasFilters: boolean;
}) {
  if (doctors.length === 0) {
    return hasFilters ? (
      <EmptyState title="No doctors match these filters" description="Try a different search or status." />
    ) : (
      <EmptyState
        title="No doctors added yet"
        description="Add your first doctor to start assigning appointments and treatment records."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Doctor</TableHead>
            <TableHead>Specialty</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Account</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {doctors.map((doctor) => (
            <TableRow key={doctor.id}>
              <TableCell className="font-medium">
                <Link href={`/settings/doctors/${doctor.id}`} className="flex items-center gap-2 hover:underline">
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: doctor.color ?? "#6366f1" }}
                  />
                  {doctor.full_name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{doctor.specialty ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={doctor.is_active ? "secondary" : "outline"}>
                  {doctor.is_active ? "Active" : "Inactive"}
                </Badge>
              </TableCell>
              <TableCell>
                <AccountBadge hasAccess={accessById.get(doctor.id)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** undefined = the account lookup itself couldn't run (e.g. admin client unavailable) — shown as "No access" rather than a confusing third visual state. */
function AccountBadge({ hasAccess }: { hasAccess: boolean | undefined }) {
  if (!hasAccess) {
    return <Badge variant="outline">No access</Badge>;
  }
  return <Badge variant="secondary">Active access</Badge>;
}
