import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoctorScheduleSelector } from "@/components/appointments/doctor-schedule-selector";
import { WeeklyHoursEditor } from "@/components/appointments/weekly-hours-editor";
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";
import { listDoctors } from "@/lib/patients/queries";
import { listDoctorWeeklyHours } from "@/lib/appointments/queries";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DoctorSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Hard-gated (redirects non-admins to /dashboard), unlike /appointments
  // itself — this is clinic configuration, not a view every clinic staff
  // member should reach.
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const sp = await searchParams;
  const doctors = await listDoctors();
  const requestedDoctorId = firstParam(sp.doctorId);
  const doctorId = doctors.some((doctor) => doctor.id === requestedDoctorId)
    ? requestedDoctorId
    : doctors[0]?.id;

  const weeklyHours = doctorId ? await listDoctorWeeklyHours(doctorId) : [];

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
          <h1 className="text-2xl font-semibold tracking-tight">Doctor Schedules</h1>
          <p className="text-sm text-muted-foreground">Weekly hours, vacations, and one-off exceptions.</p>
        </div>
      </div>

      <DoctorScheduleSelector doctors={doctors} selectedDoctorId={doctorId} />

      {doctorId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Weekly hours</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyHoursEditor doctorId={doctorId} weeklyHours={weeklyHours} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
