import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { DoctorFormSheet } from "@/components/doctors/doctor-form-sheet";
import { DoctorStatusActions } from "@/components/doctors/doctor-status-actions";
import { DoctorAccountPanel } from "@/components/doctors/doctor-account-panel";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { getDoctorDetail } from "@/lib/doctors/queries";
import { typography } from "@/lib/typography";

export default async function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const { id } = await params;
  const doctor = await getDoctorDetail(id);

  if (!doctor) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Doctors", href: "/settings/doctors" }, { label: doctor.full_name }]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-block size-3.5 shrink-0 rounded-full"
            style={{ backgroundColor: doctor.color }}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={typography.pageTitle}>{doctor.full_name}</h1>
              <Badge variant={doctor.is_active ? "secondary" : "outline"}>
                {doctor.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{doctor.specialty ?? "No specialty on file"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DoctorFormSheet doctor={doctor} />
          <DoctorStatusActions doctorId={doctor.id} isActive={doctor.is_active} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Profile</p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{doctor.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">License number</dt>
                <dd>{doctor.license_number ?? "—"}</dd>
              </div>
            </dl>
            {doctor.bio && (
              <div>
                <dt className="text-xs text-muted-foreground">Bio</dt>
                <dd className="text-sm whitespace-pre-wrap">{doctor.bio}</dd>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-sm font-medium">Schedule &amp; compensation</p>
            <p className="text-sm text-muted-foreground">
              Weekly hours, vacations, compensation rules, and earnings live in their own dedicated pages.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<Link href={`/appointments/doctor-schedule?doctorId=${doctor.id}`} />}>
                <Calendar className="size-3.5" />
                View schedule
              </Button>
              <Button variant="outline" size="sm" render={<Link href={`/compensation/doctors/${doctor.id}`} />}>
                <Wallet className="size-3.5" />
                View compensation
              </Button>
            </div>
          </div>
        </div>

        <DoctorAccountPanel doctorId={doctor.id} email={doctor.email} hasAccess={doctor.hasAccess} />
      </div>
    </div>
  );
}
